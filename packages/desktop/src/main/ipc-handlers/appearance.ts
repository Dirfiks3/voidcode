import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron"
import { Effect } from "effect"
import { WindowAppearanceChannel, type WindowAppearanceInput } from "../../shared/ipc-transport"

const presets = ["crystal", "frosted", "clear"] as const

function parseInput(value: unknown): WindowAppearanceInput | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return
  const record = value as Record<string, unknown>
  if (typeof record.enabled !== "boolean") return
  if (typeof record.preset !== "string" || !presets.includes(record.preset as WindowAppearanceInput["preset"])) return
  if (typeof record.opacity !== "number" || !Number.isFinite(record.opacity)) return

  return {
    enabled: record.enabled,
    preset: record.preset as WindowAppearanceInput["preset"],
    opacity: Math.min(100, Math.max(60, record.opacity)),
  }
}

function applyAppearance(input: WindowAppearanceInput) {
  const opacity = input.opacity / 100

  for (const win of BrowserWindow.getAllWindows()) {
    win.setOpacity(opacity)

    if (process.platform === "win32" && typeof win.setBackgroundMaterial === "function") {
      const material = input.enabled ? (input.preset === "clear" ? "mica" : "acrylic") : "none"
      // Windows versions below 22H2 reject the material APIs; the renderer stays usable without them.
      try {
        win.setBackgroundMaterial(material)
      } catch {
        // Unsupported platform build.
      }
    }

    if (process.platform === "darwin" && typeof win.setVibrancy === "function") {
      win.setVibrancy(input.enabled ? "under-window" : null)
    }
  }
}

export const appearanceHandlers = Effect.gen(function* () {
  const handle = (_event: IpcMainInvokeEvent, value: unknown) => {
    const input = parseInput(value)
    if (input) applyAppearance(input)
  }

  yield* Effect.sync(() => ipcMain.handle(WindowAppearanceChannel, handle))
  yield* Effect.addFinalizer(() => Effect.sync(() => ipcMain.removeHandler(WindowAppearanceChannel)))
})
