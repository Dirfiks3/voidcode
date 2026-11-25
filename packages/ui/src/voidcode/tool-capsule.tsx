import { type Component, type JSX, splitProps } from "solid-js"

export const ToolCapsule: Component<
  JSX.ButtonHTMLAttributes<HTMLButtonElement> & { open?: boolean; label?: string }
> = (props) => {
  const [local, rest] = splitProps(props, ["class", "classList", "open", "label", "children"])

  return (
    <button
      {...rest}
      type="button"
      data-voidcode-capsule
      data-open={local.open ? "true" : "false"}
      class={local.class}
      classList={local.classList}
      aria-expanded={local.open}
      aria-label={local.label}
    >
      {local.children}
    </button>
  )
}
