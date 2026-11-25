import { For, type Component } from "solid-js"
import { useI18n } from "../context/i18n"

type Action = {
  id: "session" | "files" | "commands" | "settings"
  path: string
}

const ACTIONS: Action[] = [
  { id: "session", path: "M12 5v14M5 12h14" },
  { id: "files", path: "M3 6h6l2 2h10v11H3z" },
  { id: "commands", path: "M5 7h14M5 12h9M5 17h14" },
  { id: "settings", path: "M12 9a3 3 0 100 6 3 3 0 000-6zm8 3l-2-1 1-2-2-1-1 1-2-1-1-2h-2l-1 2-2 1-1-1-2 1 1 2-2 1v2l2 1-1 2 2 1 1-1 2 1 1 2h2l1-2 2-1 1 1 2-1-1-2 2-1z" },
]

export const QuickActions: Component<{
  onSelect: (action: Action["id"]) => void
  class?: string
}> = (props) => {
  const i18n = useI18n()

  return (
    <div class={props.class ?? "grid w-full grid-cols-1 gap-3 sm:grid-cols-2"}>
      <For each={ACTIONS}>
        {(action) => (
          <button
            type="button"
            data-voidcode-card
            class="voidcode-quick-card"
            onClick={() => props.onSelect(action.id)}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="shrink-0 text-v2-icon-icon-accent"
              aria-hidden="true"
            >
              <path d={action.path} />
            </svg>
            <span class="min-w-0 flex flex-col gap-0.5 text-start">
              <span class="truncate text-[13px] font-[530] leading-[var(--line-height-compact)] text-v2-text-text-base">
                {i18n.t(`ui.voidcode.quick.${action.id}`)}
              </span>
              <span class="truncate text-[12px] leading-[var(--line-height-tight)] text-v2-text-text-faint">
                {i18n.t(`ui.voidcode.quick.${action.id}.description`)}
              </span>
            </span>
          </button>
        )}
      </For>
    </div>
  )
}
