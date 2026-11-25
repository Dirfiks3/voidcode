import { useModels } from "@/providers/models/models"
import { useLocal } from "@/providers/models/selection"
import { useLanguage } from "@/runtime/i18n/language"
import { showToast } from "@/shell/notifications/toast"
import { useServerSDK } from "@/runtime/server/client"
import { useData } from "@/runtime/server/current"
import { useSettings } from "@/settings/model"
import { useWorkspaceLocation } from "@/workspaces/location"
import { onCleanup } from "solid-js"
import { useSessionLayout } from "./session-layout"
import { isLimitFailure, nextFallbackModel, type FallbackModel } from "./model-fallback"

// The model reads this as the next user turn, so it has to say where to pick up without apologizing or restarting.
const CONTINUE_PROMPT =
  "The previous model stopped because its provider limit was reached. Continue the work from exactly where it stopped. " +
  "Do not repeat text that was already written, do not apologize, and do not mention this message."

const modelKey = (model: FallbackModel) => `${model.providerID}/${model.modelID}`

/**
 * Keeps a turn going when a provider refuses it for a limit or overload: switch the Session to the next configured
 * fallback model, then resume the same turn with a system notice instead of a user message.
 */
export function useModelFallback() {
  const sdk = useWorkspaceLocation()
  const server = useServerSDK()
  const data = useData()
  const models = useModels()
  const local = useLocal()
  const settings = useSettings()
  const language = useLanguage()
  const { params } = useSessionLayout()

  // Per Session: the models refused in this turn and the last model this driver switched to, which is the current
  // one before the server's selection echo arrives.
  const sessions = new Map<string, { attempted: string[]; current?: FallbackModel }>()
  const running = new Set<string>()

  const state = (sessionID: string) => {
    const existing = sessions.get(sessionID)

    if (existing) return existing

    const durable = data.session.get(sessionID)?.model
    const created = {
      attempted: [],
      current: durable ? { providerID: durable.providerID, modelID: durable.id } : undefined,
    }

    sessions.set(sessionID, created)

    return created
  }

  const name = (model: FallbackModel) => models.find(model)?.name ?? model.modelID

  // The chain has nowhere left to go: offer the same prompt again with the whole chain reset.
  const retry = async (sessionID: string) => {
    sessions.delete(sessionID)

    const first = settings.general.modelFallback().find((entry) => entry.enabled)
    const target = first ? { providerID: first.providerID, modelID: first.modelID } : undefined
    if (target) {
      await server.api.session
        .switchModel({ sessionID, model: { id: target.modelID, providerID: target.providerID } })
        .catch(() => undefined)
      local.model.set(target)
    }

    const messages = data.session.message.list(sessionID)
    const last = messages.findLast((message) => message.type === "user")
    if (!last) return

    await data.session
      .prompt({
        sessionID,
        text: last.text,
        files: last.files?.map((file) => ({
          uri: file.source?.type === "uri" ? file.source.uri : `data:${file.mime};base64,${file.data}`,
          name: file.name,
          description: file.description,
          mention: file.mention,
        })),
        agents: last.agents,
        skills: last.skills,
        metadata: last.metadata,
        delivery: "steer",
      })
      .catch(() => undefined)
  }

  const fall = async (sessionID: string, error: Parameters<typeof isLimitFailure>[0]) => {
    if (!isLimitFailure(error) || running.has(sessionID)) return

    const turn = state(sessionID)
    const target = nextFallbackModel({
      current: turn.current,
      entries: settings.general.modelFallback(),
      attempted: turn.attempted,
      available: (model) => !!models.find(model),
    })

    if (!target) {
      const tried = [
        ...turn.attempted,
        ...(turn.current && !turn.attempted.includes(modelKey(turn.current)) ? [modelKey(turn.current)] : []),
      ].map((key) => {
        const [providerID, ...rest] = key.split("/")
        return name({ providerID: providerID ?? "", modelID: rest.join("/") })
      })
      if (tried.length > 0)
        showToast({
          variant: "error",
          title: language.t("session.modelFallback.exhausted.title"),
          description: language.t("session.modelFallback.exhausted.description", { models: tried.join(", ") }),
          actions: [
            {
              label: language.t("session.modelFallback.exhausted.retry"),
              onClick: () => void retry(sessionID),
            },
          ],
        })
      return
    }

    running.add(sessionID)

    const from = turn.current

    // A model that already ran out stays spent for the rest of this turn, so a later refusal cannot ping-pong back.
    if (from) turn.attempted.push(modelKey(from))
    turn.current = target

    const selection = { providerID: target.providerID, modelID: target.modelID }

    try {
      await server.api.session.switchModel({ sessionID, model: { id: target.modelID, providerID: target.providerID } })
      // The next prompt must not return to the model that just ran out.
      local.model.set(selection)
      await server.api.session.synthetic({
        sessionID,
        text: CONTINUE_PROMPT,
        description: language.t("session.modelFallback.notice", {
          model: from ? name(from) : language.t("session.modelFallback.unknown"),
          next: name(target),
        }),
        metadata: { source: "model-fallback" },
      })
    } catch {
      // The step error already explains the failure; a refused switch or resume leaves that visible.
    } finally {
      running.delete(sessionID)
    }
  }

  const stop = [
    sdk().event.on("session.step.failed", (event) => {
      if (event.data.sessionID !== params.id) return
      void fall(event.data.sessionID, event.data.error)
    }),
    // A new prompt starts a new turn: every configured model is worth trying again.
    sdk().event.on("session.inbox.enqueued", (event) => {
      if (event.data.item.type !== "user") return
      sessions.delete(event.data.sessionID)
    }),
    // A Session that moved to another process follows the model the server now records.
    sdk().event.on("session.model.selected", (event) => {
      const turn = sessions.get(event.data.sessionID)
      if (!turn) return
      const current = { providerID: event.data.model.providerID, modelID: event.data.model.id }
      if (!turn.current || modelKey(turn.current) !== modelKey(current)) turn.current = current
    }),
    sdk().event.on("session.deleted", (event) => sessions.delete(event.data.sessionID)),
  ]

  onCleanup(() => stop.forEach((off) => off()))
}
