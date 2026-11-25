import { Icon } from "@opencode/ui/icon"
import { createSignal, onCleanup, onMount, Show, type Component } from "solid-js"
import { Portal } from "solid-js/web"
import { useLanguage } from "@/runtime/i18n/language"
import { useVoidcode } from "./preferences"
import { installPrivacyGuards } from "./privacy-guards"

/** Ctrl+Shift+H reveals or hides everything marked sensitive. */
export function installBlurShortcut(preferences: ReturnType<typeof useVoidcode>) {
  if (typeof document === "undefined") return () => undefined
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || !event.ctrlKey || !event.shiftKey || event.altKey) return
    if (event.key.toLowerCase() !== "h") return
    event.preventDefault()
    preferences.patch({ blurSensitive: !preferences.state.blurSensitive })
  }
  document.addEventListener("keydown", onKeyDown)
  return () => document.removeEventListener("keydown", onKeyDown)
}

export const PrivacyVeil: Component = () => {
  const preferences = useVoidcode()
  const language = useLanguage()
  const [ready, setReady] = createSignal(false)

  onMount(() => {
    installPrivacyGuards()
    setReady(true)
    onCleanup(installBlurShortcut(preferences))
  })

  return (
    <Show when={ready() && preferences.state.blurSensitive}>
      <Portal mount={document.body}>
        <button
          type="button"
          data-voidcode-blur-veil
          aria-label={language.t("voidcode.header.blur.show")}
          onClick={() => preferences.patch({ blurSensitive: false })}
        >
          <Icon name="eye" />
        </button>
      </Portal>
    </Show>
  )
}
