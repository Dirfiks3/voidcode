import { createMemo, Show, type Component } from "solid-js"
import { modelMonogram, resolveModelIcon } from "./model-icon"

export const ModelLogo: Component<{
  providerID: string
  modelID: string
  size?: number
  class?: string
}> = (props) => {
  const icon = createMemo(() => resolveModelIcon(props.providerID, props.modelID))
  const dimension = () => props.size ?? 16

  return (
    <Show
      when={icon()}
      fallback={
        <span
          class={props.class ? `voidcode-model-logo voidcode-model-logo--fallback ${props.class}` : "voidcode-model-logo voidcode-model-logo--fallback"}
          style={{ width: `${dimension()}px`, height: `${dimension()}px` }}
          aria-hidden="true"
        >
          {modelMonogram(props.providerID, props.modelID)}
        </span>
      }
    >
      {(name) => (
        <img
          class={props.class ? `voidcode-model-logo ${props.class}` : "voidcode-model-logo"}
          src={`/model-icons/${name()}.svg`}
          width={dimension()}
          height={dimension()}
          alt=""
          aria-hidden="true"
          loading="lazy"
        />
      )}
    </Show>
  )
}
