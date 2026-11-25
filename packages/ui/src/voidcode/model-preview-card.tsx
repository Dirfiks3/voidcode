import { For, Show, type Component } from "solid-js"
import { useI18n } from "../context/i18n"
import { ModelLogo } from "./model-logo"

export const ModelPreviewCard: Component<{
  providerID: string
  modelID: string
  providerName?: string
  name: string
  context?: number
  badges?: string[]
  selected?: boolean
  onClick?: () => void
  class?: string
}> = (props) => {
  const i18n = useI18n()
  return (
    <button
      type="button"
      class={props.class ? `voidcode-model-card ${props.class}` : "voidcode-model-card"}
      data-selected={props.selected ? "true" : "false"}
      onClick={() => props.onClick?.()}
    >
      <div class="flex min-w-0 items-center gap-2">
        <ModelLogo
          providerID={props.providerID}
          modelID={props.modelID}
          size={24}
          class="voidcode-model-card__icon"
        />
        <span class="min-w-0 flex-1 truncate text-start text-[13px] font-[530] leading-[var(--line-height-compact)] text-v2-text-text-base">
          {props.name}
        </span>
      </div>
      <Show when={props.providerName}>
        {(name) => (
          <span class="min-w-0 truncate text-start text-[12px] leading-[var(--line-height-tight)] text-v2-text-text-faint">
            {name()}
          </span>
        )}
      </Show>
      <Show when={props.context !== undefined}>
        <span class="text-[12px] leading-[var(--line-height-tight)] text-v2-text-text-muted">
          {i18n.t("ui.voidcode.model.context", { count: props.context!.toLocaleString(i18n.locale()) })}
        </span>
      </Show>
      <Show when={props.badges && props.badges.length > 0}>
        <div class="voidcode-model-card__badges">
          <For each={props.badges}>{(badge) => <span class="voidcode-model-card__badge">{badge}</span>}</For>
        </div>
      </Show>
    </button>
  )
}
