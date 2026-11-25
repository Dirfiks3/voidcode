import type { Component } from "solid-js"

/**
 * The real VoidCode mark, cut out from the source artwork with a transparent field.
 * Sized by its parent; no handmade geometry, halo, or animated glow.
 */
export const VoidLogo: Component<{ class?: string; title?: string }> = (props) => (
  <img
    src="/voidcode-logo.png"
    class={props.class ? `voidcode-logo ${props.class}` : "voidcode-logo"}
    alt={props.title ?? ""}
    aria-hidden={props.title ? undefined : true}
    draggable={false}
  />
)
