import { app } from "electron"
import type { Endpoint } from "@opencode/client/service"
import { Context, Effect, FileSystem, Layer, Option, Path, Schema } from "effect"
import { SidecarChanged } from "../../shared/ipc-rpc/events"
import { CHANNEL } from "../constants"
import { emitIpcEvent } from "../ipc-events"
import { getMainWindows } from "../windows"
import { Shutdown } from "../lifecycle/shutdown"
import { BackgroundServiceMachine } from "./background-service-machine"
import { cleanStages } from "./cli-stages"
import { keptStages, serviceVersion, shouldRetryEnsure } from "./cli-version"
import { DesktopCli } from "./desktop-cli"
import { SidecarCredentials } from "./sidecar-credentials"
import { takeSidecarProbe } from "./sidecar-probe"

export * as BackgroundService from "./background-service"

const RegisteredService = Schema.Struct({ version: Schema.optional(Schema.String) })

// A plain `serve --port 4096` started outside the desktop app has no registration file or password. Attach to it
// directly in dev instead of spawning a second CLI that cannot bind the same port.
const DevServerOrigins = ["http://localhost:4096", "http://127.0.0.1:4096"] as const
const DevServerInfo = Schema.Struct({
  version: Schema.String,
  pid: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
})
const DEV_SERVER_TIMEOUT_MS = 1500

// Set only when this app spawned (or replaced) the service, so quitting never terminates a CLI
// server that VoidCode merely adopted. The registration file is kept for the shutdown and resume
// hooks, which must target the same service the startup path started.
const managed = { owned: false, file: undefined as string | undefined }

export interface Interface {
  readonly connection: Effect.Effect<SidecarCredentials.Data>
  readonly reconnect: Effect.Effect<SidecarCredentials.Data>
}

export class Service extends Context.Service<Service, Interface>()("opencode/desktop/BackgroundService") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const context = yield* Effect.context<FileSystem.FileSystem | Path.Path | DesktopCli.Service>()
    const shutdown = yield* Shutdown.Service

    const remove = yield* shutdown.add({
      stop: Effect.gen(function* () {
        if (!managed.owned) return
        const { Service } = yield* Effect.promise(() => import("@opencode/client/service"))
        yield* Effect.tryPromise(() => Service.stop({ file: managed.file, pty: "clear" }))
      }).pipe(
        Effect.catchCause((cause) => Effect.logWarning("failed to stop VoidCode CLI service", { cause })),
      ),
      resume: Effect.gen(function* () {
        if (!managed.owned) return
        yield* ensure("reconnect").pipe(Effect.provide(context))
      }).pipe(
        Effect.catchCause((cause) => Effect.logWarning("failed to restart VoidCode CLI service", { cause })),
      ),
    })
    yield* Effect.addFinalizer(() => Effect.sync(remove))

    return Service.of(
      yield* BackgroundServiceMachine.make({
        probe: probe().pipe(Effect.provide(context)),
        ensure: (mode) => ensure(mode).pipe(Effect.provide(context)),
        publish: (data) => {
          SidecarCredentials.set(data)
          // Every window moves its requests and event stream to the new origin, not only the one that reconnected.
          const event = new SidecarChanged({ url: data.url })
          getMainWindows().forEach((win) => emitIpcEvent(win.webContents, event))
        },
      }),
    )
  }),
)

// A compatible service the entry module already found is adopted at once; the machine still verifies it with
// `ensure("initial")` (which also completes a terminal handoff), off the renderer's path.
const probe = Effect.fn("BackgroundService.probe")(function* () {
  const existing = yield* existingDevServer()
  if (existing) {
    const setup = yield* prepare("initial")

    return (yield* adopt(setup, existing, true)).credentials
  }

  const service = yield* Effect.promise(takeSidecarProbe)

  if (!service) return undefined
  const setup = yield* prepare("initial")

  return (yield* adopt(setup, service, true)).credentials
})

const ensure = Effect.fn("BackgroundService.ensure")(function* (mode: BackgroundServiceMachine.ConnectMode) {
  const existing = yield* existingDevServer()
  if (existing) {
    const setup = yield* prepare(mode)

    return (yield* adopt(setup, existing, false)).credentials
  }

  const runFork = Effect.runForkWith(yield* Effect.context<FileSystem.FileSystem | Path.Path>())
  const setup = yield* prepare(mode)

  const run = (version = setup.version) =>
    setup.client.Service.ensure({
      file: setup.file,
      version,
      // A fixed port makes a second contender fail to bind and back off; port 0 never collides, so two
      // services could boot against the same database.
      command: [
        ...setup.cli.command,
        "serve",
        "--service",
        ...(setup.isolated ? ["--hostname", "0.0.0.0", "--port", String(0x0c0c)] : []),
      ],
      onStart: (reason, previousVersion) => {
        managed.owned = true
        managed.file = setup.file
        runFork(Effect.logInfo("v2 CLI background service starting", { reason, previousVersion }))
      },
    })

  const service = yield* Effect.tryPromise(() =>
    run().catch((error) => {
      if (!shouldRetryEnsure(setup.version, error instanceof Error ? error.message : String(error))) throw error

      return run(setup.cli.version)
    }),
  )

  const ready = yield* adopt(setup, service, false)

  // Only packaged and isolated builds run a staged copy; any other binary sits in the source tree.
  // Keep both the bundled stage and the running server's stage so its executable stays on disk. This runs only
  // once `Service.ensure` settled which server runs, never for a probed one it may still replace.
  if (mode === "initial" && (app.isPackaged || setup.isolated) && setup.cli.binary && ready.runningVersion)
    runFork(
      cleanStages(setup.cli.binary, { keep: keptStages(setup.cli.version, ready.runningVersion) }).pipe(
        Effect.catch((error) => Effect.logError("failed to clean staged v2 CLIs", { error })),
      ),
    )

  return ready.credentials
})

const existingDevServer = Effect.fn("BackgroundService.existingDevServer")(function* () {
  if (app.isPackaged) return undefined

  for (const origin of DevServerOrigins) {
    const response = yield* Effect.tryPromise(() =>
      fetch(new URL("/api/info", origin), { signal: AbortSignal.timeout(DEV_SERVER_TIMEOUT_MS) }),
    ).pipe(Effect.orElseSucceed(() => undefined))
    if (!response?.ok) continue

    const body = yield* Effect.tryPromise(() => response.json() as Promise<unknown>).pipe(
      Effect.orElseSucceed(() => undefined),
    )
    if (Option.isSome(Schema.decodeUnknownOption(DevServerInfo)(body))) return { url: origin } satisfies Endpoint
  }

  return undefined
})

const prepare = Effect.fn("BackgroundService.prepare")(function* (mode: BackgroundServiceMachine.ConnectMode) {
  yield* Effect.logInfo("starting v2 background service")
  const path = yield* Path.Path
  const desktopCli = yield* DesktopCli.Service
  const reuse = !app.isPackaged && process.env.OPENCODE_DESKTOP_REUSE_SERVER === "1"
  const isolated = !app.isPackaged && !reuse && process.env.OPENCODE_DESKTOP_ISOLATED_SERVER === "1"
  const cli = yield* desktopCli.resolve
  const version = reuse ? undefined : serviceVersion({ channel: CHANNEL, isolated, mode, version: cli.version })

  if (isolated) process.env.XDG_STATE_HOME = app.getPath("userData")
  const client = yield* Effect.promise(() => import("@opencode/client/service"))

  const reuseFile = reuse ? process.env.OPENCODE_DESKTOP_REUSE_SERVICE_FILE || undefined : undefined

  const file = reuse
    ? reuseFile
    : process.env.OPENCODE_DESKTOP_SERVER_CHANNEL === "local"
      ? path.join(
          process.env.XDG_STATE_HOME ?? path.join(app.getPath("home"), ".local", "state"),
          "opencode",
          "service-local.json",
        )
      : undefined

  return { cli, client, file, isolated, version }
})

const adopt = Effect.fn("BackgroundService.adopt")(function* (
  setup: Effect.Success<ReturnType<typeof prepare>>,
  service: Endpoint,
  probed: boolean,
) {
  const fs = yield* FileSystem.FileSystem

  // Registered services always use Basic auth; a dev server started directly on port 4096 has none.
  const password = service.auth?.password ?? null
  const url = new URL(service.url)

  if (url.hostname === "0.0.0.0") url.hostname = "127.0.0.1"

  const runningVersion = yield* fs.readFileString(setup.file ?? setup.client.fallback()).pipe(
    Effect.map(
      (text) =>
        Option.getOrUndefined(Schema.decodeUnknownOption(Schema.fromJsonString(RegisteredService))(text))?.version,
    ),
    Effect.orElseSucceed(() => undefined),
  )

  yield* Effect.logInfo("v2 CLI background service ready", {
    version: setup.version,
    runningVersion,
    probed,
    ...endpoint(url.origin),
  })

  return {
    credentials: { url: url.origin, password } satisfies SidecarCredentials.Data,
    runningVersion,
  }
})

function endpoint(url: string | undefined) {
  if (!url || !URL.canParse(url)) return {}
  const parsed = new URL(url)

  return { url, hostname: parsed.hostname, port: parsed.port }
}
