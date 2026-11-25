import { For, Show, type Component, type JSX } from "solid-js"
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
  const index = () => Math.max(0, TABS.indexOf(state.tab))

  const select = (tab: InspectorTab) => {
    if (tab === state.tab) return
    setState("tab", tab)
    props.onChange?.(tab)
  }

  return (
    <aside
      data-voidcode-glass
      data-voidcode-column
      class="voidcode-inspector"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <div class="flex h-10 shrink-0 items-center justify-between gap-2 px-3 pt-1">
        <span class="text-[12px] font-[530] leading-[var(--line-height-tight)] text-v2-text-text-muted">
          {i18n.t("ui.voidcode.inspector.title")}
        </span>
      </div>
      <div
        class="voidcode-inspector__tabs"
        role="tablist"
        aria-label={i18n.t("ui.voidcode.inspector.title")}
        style={{
          "--indicator-width": `${100 / TABS.length}%`,
          "--indicator-x": `${index() * 100}%`,
        }}
      >
        <span class="voidcode-inspector__indicator" aria-hidden="true" />
        <For each={TABS}>
          {(tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={state.tab === tab}
              class="voidcode-inspector__tab"
              onClick={() => select(tab)}
            >
              {i18n.t(`ui.voidcode.inspector.${tab}`)}
            </button>
          )}
        </For>
      </div>
      {/* Keyed by tab so a switch remounts the panel and restarts its motion-blur impulse. */}
      <Show when={state.tab} keyed>
        {(tab) => (
          <div class="voidcode-inspector__body" role="tabpanel" data-tab={tab}>
            {props.views[tab]}
          </div>
        )}
      </Show>
    </aside>
  )
}
