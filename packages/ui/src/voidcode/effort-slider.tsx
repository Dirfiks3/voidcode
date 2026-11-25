import { For, type Component, createEffect, createMemo, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { useI18n } from "../context/i18n"

export type EffortLevel = 0 | 1 | 2 | 3

type EffortSelection = {
  variant: {
    current: () => string | undefined
    list: () => string[]
    set: (value: string | undefined) => void
  }
}

const LEVELS: EffortLevel[] = [0, 1, 2, 3]
const NAMES = ["low", "medium", "high", "max"] as const
const HINTS = [
  "ui.voidcode.effort.hint.low",
  "ui.voidcode.effort.hint.medium",
  "ui.voidcode.effort.hint.high",
  "ui.voidcode.effort.hint.max",
] as const

export const EffortSlider: Component<{
  selection: EffortSelection
  sessionID?: string
  class?: string
}> = (props) => {
  const i18n = useI18n()
  const [state, setState] = createStore({ level: 1 as EffortLevel })
  const storageKey = () => `voidcode.effort.${props.sessionID ?? "global"}`
  const variants = createMemo(() => props.selection.variant.list())

  const matchingVariant = (level: EffortLevel) => {
    const name = NAMES[level]
    return variants().find((variant) => variant.toLowerCase() === name)
  }

  const levelFromVariant = (value: string | undefined): EffortLevel | undefined => {
    if (!value) return undefined
    const index = NAMES.findIndex((name) => name === value.toLowerCase())
    return index < 0 ? undefined : (index as EffortLevel)
  }

  onMount(() => {
    const saved = Number(localStorage.getItem(storageKey()))
    const fromSelection = levelFromVariant(props.selection.variant.current())
    const level = LEVELS.includes(saved as EffortLevel) ? (saved as EffortLevel) : (fromSelection ?? 1)

    setState("level", level)
    const variant = matchingVariant(level)
    if (variant && variant !== props.selection.variant.current()) props.selection.variant.set(variant)
  })

  createEffect(() => {
    const current = levelFromVariant(props.selection.variant.current())
    if (current !== undefined && current !== state.level) setState("level", current)
  })

  const choose = (level: EffortLevel) => {
    setState("level", level)
    localStorage.setItem(storageKey(), String(level))
    const variant = matchingVariant(level)
    if (variant) props.selection.variant.set(variant)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0
    if (delta === 0 && event.key !== "Home" && event.key !== "End") return
    event.preventDefault()
    const next = event.key === "Home" ? 0 : event.key === "End" ? 3 : Math.max(0, Math.min(3, state.level + delta))
    choose(next as EffortLevel)
  }

  const label = (level: EffortLevel) => i18n.t(`ui.voidcode.effort.${NAMES[level]}`)

  return (
    <div class={props.class ? `voidcode-effort ${props.class}` : "voidcode-effort"}>
      <div class="flex items-center justify-between gap-2">
        <span class="text-[12px] leading-[var(--line-height-tight)] text-v2-text-text-faint">
          {i18n.t("ui.voidcode.effort.label")}
        </span>
        <span class="text-[12px] font-[530] leading-[var(--line-height-tight)] text-v2-text-text-base">
          {label(state.level)}
        </span>
      </div>
      <div
        class="voidcode-effort__track"
        role="slider"
        tabindex="0"
        aria-label={i18n.t("ui.voidcode.effort.label")}
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={state.level}
        aria-valuetext={label(state.level)}
        onKeyDown={onKeyDown}
      >
        <div class="voidcode-effort__rail" />
        <div class="voidcode-effort__fill" style={{ width: `calc((100% - 16px) * ${state.level / 3})` }} />
        <div class="voidcode-effort__thumb" style={{ left: `calc(8px + (100% - 16px) * ${state.level / 3})` }} />
      </div>
      <div class="voidcode-effort__detents" role="group" aria-label={i18n.t("ui.voidcode.effort.label")}>
        <For each={LEVELS}>
          {(level) => (
            <button
              type="button"
              class="voidcode-effort__detent"
              role="radio"
              aria-checked={state.level === level}
              onClick={() => choose(level)}
            >
              {label(level)}
            </button>
          )}
        </For>
      </div>
      <div class="voidcode-effort__hint">{i18n.t(HINTS[state.level])}</div>
    </div>
  )
}
