export type ThemeImportState =
  | { type: "idle" }
  | { type: "reading"; attempt: number }
  | { type: "validating"; attempt: number; text: string }
  | { type: "imported"; attempt: number; id: string }
  | { type: "invalid"; attempt: number; reason: "json" | "shape" }

export type ThemeImportEvent =
  | { type: "start"; attempt: number }
  | { type: "read"; attempt: number; text: string }
  | { type: "invalid"; attempt: number; reason: "json" | "shape" }
  | { type: "imported"; attempt: number; id: string }
  | { type: "disposed" }

export function transitionThemeImport(state: ThemeImportState, event: ThemeImportEvent): ThemeImportState {
  switch (event.type) {
    case "start":
      return { type: "reading", attempt: event.attempt }
    case "read":
      if (state.type !== "reading" || state.attempt !== event.attempt) return state
      return { type: "validating", attempt: event.attempt, text: event.text }
    case "invalid":
      if (state.type !== "validating" || state.attempt !== event.attempt) return state
      return { type: "invalid", attempt: event.attempt, reason: event.reason }
    case "imported":
      if (state.type !== "validating" || state.attempt !== event.attempt) return state
      return { type: "imported", attempt: event.attempt, id: event.id }
    case "disposed":
      return { type: "idle" }
  }
}

export type ImageImportState =
  | { type: "idle" }
  | { type: "reading"; attempt: number }
  | { type: "ready"; attempt: number; data: string }
  | { type: "invalid"; attempt: number; reason: "type" | "size" }

export type ImageImportEvent =
  | { type: "start"; attempt: number }
  | { type: "ready"; attempt: number; data: string }
  | { type: "invalid"; attempt: number; reason: "type" | "size" }
  | { type: "disposed" }

export function transitionImageImport(state: ImageImportState, event: ImageImportEvent): ImageImportState {
  switch (event.type) {
    case "start":
      return { type: "reading", attempt: event.attempt }
    case "ready":
      if (state.type !== "reading" || state.attempt !== event.attempt) return state
      return { type: "ready", attempt: event.attempt, data: event.data }
    case "invalid":
      if (state.type !== "reading" || state.attempt !== event.attempt) return state
      return { type: "invalid", attempt: event.attempt, reason: event.reason }
    case "disposed":
      return { type: "idle" }
  }
}
