import { For, Show, type Component, createEffect, createMemo, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { useI18n } from "../context/i18n"

export type EffortLevel = 0 | 1 | 2 | 3

export type EffortSelection = {
  variant: {
    current: () => string | undefined
    list: () => string[]
    set: (value: string | undefined) => void
  }
}

const LEVELS: EffortLevel[] = [0, 1, 2, 3]
const NAMES = ["low", "medium", "high", "max"] as const
const ALIASES: Record<string, EffortLevel> = {
  default: 1,
  balanced: 1,
  minimal: 0,
  xhigh: 3,
  none: 0,
}
const HINTS = [
  "ui.voidcode.effort.hint.low",
  "ui.voidcode.effort.hint.medium",
  "ui.voidcode.effort.hint.high",
  "ui.voidcode.effort.hint.max",
] as const

export const DEFAULT_EFFORT_LEVEL: EffortLevel = 1

export function effortLevelName(level: EffortLevel) {
  return NAMES[level]
}

export function effortHintKey(level: EffortLevel) {
  return HINTS[level]
}

export function effortLevelFromVariant(value: string | undefined): EffortLevel | undefined {
  if (!value) return undefined
  const key = value.toLowerCase()
  const named = NAMES.indexOf(key as (typeof NAMES)[number])
  if (named >= 0) return named as EffortLevel
  return ALIASES[key]
}

export function effortVariantForLevel(level: EffortLevel, variants: readonly string[]) {
  const name = NAMES[level]
  const exact = variants.find((variant) => variant.toLowerCase() === name)
  if (exact) return exact
  return variants.find((variant) => ALIASES[variant.toLowerCase()] === level)
}

export function effortStorageKey(sessionID?: string) {
  return `voidcode.effort.${sessionID ?? "global"}`
}

/** The effort saved for this session, or `fallback` when none is stored. Safe without a DOM. */
export function readEffortLevel(sessionID?: string, fallback: EffortLevel = DEFAULT_EFFORT_LEVEL): EffortLevel {
  if (typeof localStorage === "undefined") return fallback

  const stored = Number(localStorage.getItem(effortStorageKey(sessionID)))
  return LEVELS.includes(stored as EffortLevel) ? (stored as EffortLevel) : fallback
}

export function writeEffortLevel(sessionID: string | undefined, level: EffortLevel) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(effortStorageKey(sessionID), String(level))
}

export const EffortSlider: Component<{
  selection: EffortSelection
  sessionID?: string
  class?: string
  compact?: boolean
  /** Controlled level. Omit to keep the level inside the slider. */
  level?: EffortLevel
  onLevelChange?: (level: EffortLevel) => void
}> = (props) => {
  const i18n = useI18n()
  const [state, setState] = createStore<{ level: EffortLevel }>({ level: DEFAULT_EFFORT_LEVEL })
  const variants = createMemo(() => props.selection.variant.list())
  const current = () => props.level ?? state.level

  onMount(() => {
    if (props.level !== undefined) return

    const level = readEffortLevel(
      props.sessionID,
      effortLevelFromVariant(props.selection.variant.current()) ?? DEFAULT_EFFORT_LEVEL,
    )
    setState("level", level)

    const variant = effortVariantForLevel(level, variants())
    if (variant && variant !== props.selection.variant.current()) props.selection.variant.set(variant)
  })

  createEffect(() => {
    if (props.level !== undefined) return

    const fromSelection = effortLevelFromVariant(props.selection.variant.current())
    if (fromSelection !== undefined && fromSelection !== state.level) setState("level", fromSelection)
  })

  const choose = (level: EffortLevel) => {
    if (props.level === undefined) setState("level", level)
    writeEffortLevel(props.sessionID, level)
    props.onLevelChange?.(level)

    const variant = effortVariantForLevel(level, variants())
    if (variant) props.selection.variant.set(variant)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0
    if (delta === 0 && event.key !== "Home" && event.key !== "End") return
    event.preventDefault()
    const next = event.key === "Home" ? 0 : event.key === "End" ? 3 : Math.max(0, Math.min(3, current() + delta))
    choose(next as EffortLevel)
  }

  const label = (level: EffortLevel) => i18n.t(`ui.voidcode.effort.${effortLevelName(level)}`)

  return (
    <div
      class={props.class ? `voidcode-effort ${props.class}` : "voidcode-effort"}
      classList={{ "voidcode-effort--compact": props.compact }}
    >
      <Show when={!props.compact}>
        <div class="flex items-center justify-between gap-2">
          <span class="text-[12px] leading-[var(--line-height-tight)] text-v2-text-text-faint">
            {i18n.t("ui.voidcode.effort.label")}
          </span>
          <span class="text-[12px] font-[530] leading-[var(--line-height-tight)] text-v2-text-text-base">
            {label(current())}
          </span>
        </div>
      </Show>
      <div
        class="voidcode-effort__track"
        role="slider"
        tabindex="0"
        aria-label={i18n.t("ui.voidcode.effort.label")}
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={current()}
        aria-valuetext={label(current())}
        onKeyDown={onKeyDown}
      >
        <div class="voidcode-effort__rail" />
        <div class="voidcode-effort__fill" style={{ width: `calc((100% - 16px) * ${current() / 3})` }} />
        <div class="voidcode-effort__thumb" style={{ left: `calc(8px + (100% - 16px) * ${current() / 3})` }} />
      </div>
      <div class="voidcode-effort__detents" role="group" aria-label={i18n.t("ui.voidcode.effort.label")}>
        <For each={LEVELS}>
          {(level) => (
            <button
              type="button"
              class="voidcode-effort__detent"
              role="radio"
              aria-checked={current() === level}
              onClick={() => choose(level)}
            >
              {label(level)}
            </button>
          )}
        </For>
      </div>
      <div class="voidcode-effort__hint">{i18n.t(effortHintKey(current()))}</div>
    </div>
  )
}
