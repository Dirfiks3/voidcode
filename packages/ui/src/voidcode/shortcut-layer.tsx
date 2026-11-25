import { type Component, onCleanup, onMount } from "solid-js"

export const ShortcutLayer: Component<{
  onToggleSidebar: () => void
  onToggleInspector: () => void
  onOpenPalette: () => void
}> = (props) => {
  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !event.ctrlKey || event.altKey) return
      const target = event.target
      if (
        target instanceof Element &&
        (target.closest("input, textarea, select") ||
          (target instanceof HTMLElement && target.isContentEditable))
      )
        return
      const key = event.key.toLowerCase()
      const handler =
        key === "b" ? props.onToggleSidebar : key === "i" ? props.onToggleInspector : key === "k" ? props.onOpenPalette : undefined
      if (!handler) return
      event.preventDefault()
      handler()
    }

    document.addEventListener("keydown", onKeyDown)
    onCleanup(() => document.removeEventListener("keydown", onKeyDown))
  })

  return null
}
