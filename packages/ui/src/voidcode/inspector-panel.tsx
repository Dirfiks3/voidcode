import { For, type Component, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useI18n } from "../context/i18n"

export type InspectorTab = "artifacts" | "diffs" | "plan" | "files"

const TABS: InspectorTab[] = ["artifacts", "diffs", "plan", "files"]

export const InspectorPanel: Component<{
  active?: InspectorTab
  onChange?: (tab: InspectorTab) => void
  views: Record<InspectorTab, JSX.Element>
  class?: string
}> = (props) => {
  const i18n = useI18n()
  const [state, setState] = createStore<{ tab: InspectorTab }>({ tab: props.active ?? "diffs" })

  const select = (tab: InspectorTab) => {
    setState("tab", tab)
    props.onChange?.(tab)
  }

  return (
    <aside data-voidcode-glass data-voidcode-column class={props.class ?? "h-full w-full overflow-hidden"}>
      <div class="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-v2-border-border-muted px-3">
        <span class="text-[12px] font-[530] leading-[var(--line-height-tight)] text-v2-text-text-muted">
          {i18n.t("ui.voidcode.inspector.title")}
        </span>
      </div>
      <div class="flex shrink-0 gap-1 border-b border-v2-border-border-muted p-2" role="tablist">
        <For each={TABS}>
          {(tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={state.tab === tab}
              class="min-w-0 flex-1 rounded-md px-1 py-1 text-[12px] leading-[var(--line-height-tight)] transition-colors"
              classList={{
                "bg-v2-overlay-simple-overlay-hover text-v2-text-text-base": state.tab === tab,
                "text-v2-text-text-faint hover:text-v2-text-text-base": state.tab !== tab,
              }}
              onClick={() => select(tab)}
            >
              {i18n.t(`ui.voidcode.inspector.${tab}`)}
            </button>
          )}
        </For>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-3" role="tabpanel">
        {props.views[state.tab]}
      </div>
    </aside>
  )
}
