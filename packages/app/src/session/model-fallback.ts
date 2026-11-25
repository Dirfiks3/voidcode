import type { SessionStructuredError } from "@opencode/client/promise"

export type FallbackModel = { readonly providerID: string; readonly modelID: string }

export type FallbackEntry = FallbackModel & { readonly enabled: boolean }

// Refusals that mean another model is worth trying: the provider said no to this model, not to the request.
const LIMIT_ERROR_TYPES = new Set([
  "provider.rate-limit",
  "provider.quota",
  "provider.free-limit",
  "provider.go-limit",
  "provider.budget-limit",
  "provider.model-budget-limit",
  "provider.chatgpt-limit",
  "provider.chatgpt-workspace-limit",
])

// Provider overload is reported as an internal failure, so only its overload statuses and wording count.
const OVERLOAD_STATUS = new Set([503, 529])
const LIMIT_MESSAGE = /rate.?limit|quota|too many requests|overload|capacity|\b429\b/i

const key = (model: FallbackModel) => `${model.providerID}/${model.modelID}`

/** Whether the failure is a limit or overload refusal that another model can get past. */
export function isLimitFailure(error: Pick<SessionStructuredError, "type" | "message" | "status">) {
  if (LIMIT_ERROR_TYPES.has(error.type)) return true
  if (!error.type.startsWith("provider.")) return false
  if (error.type === "provider.internal" && error.status !== undefined && OVERLOAD_STATUS.has(error.status)) return true
  return LIMIT_MESSAGE.test(error.message)
}

/**
 * The next enabled model after the one that failed, in configured order and wrapping at the end.
 * Models already refused in this turn, the current one and models this client doesn't offer are skipped.
 */
export function nextFallbackModel(input: {
  current: FallbackModel | undefined
  entries: readonly FallbackEntry[]
  attempted: readonly string[]
  available: (model: FallbackModel) => boolean
}): FallbackModel | undefined {
  const enabled = input.entries.filter((entry) => entry.enabled)
  const from = input.current ? enabled.findIndex((entry) => key(entry) === key(input.current!)) : -1
  const ordered = from < 0 ? enabled : [...enabled.slice(from + 1), ...enabled.slice(0, from + 1)]
  const current = input.current && key(input.current)

  for (const entry of ordered) {
    const candidate = key(entry)
    if (candidate === current) continue
    if (input.attempted.includes(candidate)) continue
    if (!input.available(entry)) continue
    return { providerID: entry.providerID, modelID: entry.modelID }
  }
}
