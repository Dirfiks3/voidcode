import type { Component } from "solid-js"

export type VoidCodeStatus = "idle" | "running" | "error" | "offline"

export const StatusOrb: Component<{ status: VoidCodeStatus; class?: string; title?: string }> = (props) => (
  <span
    class={props.class ? `voidcode-status-orb ${props.class}` : "voidcode-status-orb"}
    data-status={props.status}
    role="status"
    title={props.title}
  />
)
