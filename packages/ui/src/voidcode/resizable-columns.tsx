import { Show, type Component, type JSX, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { ResizeHandle } from "../components/resize-handle"
import { InspectorPanel, type InspectorTab } from "./inspector-panel"

const LEFT_KEY = "voidcode.columns.left"
const RIGHT_KEY = "voidcode.columns.right"

function persistedWidth(key: string, fallback: number) {
  const value = Number(localStorage.getItem(key))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export const ThreeColumnFrame: Component<{
  left: JSX.Element
  center: JSX.Element
  right: JSX.Element
  leftWidth?: number
  rightWidth?: number
  class?: string
}> = (props) => {
  const [state, setState] = createStore({
    left: props.leftWidth ?? 280,
    right: props.rightWidth ?? 320,
  })
  const [dragging, setDragging] = createStore({ value: false })

  onMount(() => {
    setState({
      left: persistedWidth(LEFT_KEY, props.leftWidth ?? 280),
      right: persistedWidth(RIGHT_KEY, props.rightWidth ?? 320),
    })
  })

  const resizeLeft = (width: number) => {
    setState("left", width)
    localStorage.setItem(LEFT_KEY, String(width))
  }

  const resizeRight = (width: number) => {
    setState("right", width)
    localStorage.setItem(RIGHT_KEY, String(width))
  }

  return (
    <div data-voidcode-shell class={props.class ?? "flex h-full min-h-0 min-w-0 flex-row"}>
      <div data-voidcode-column style={{ width: `${state.left}px` }} class="h-full shrink-0">
        {props.left}
      </div>
      <div data-voidcode-resize data-dragging={dragging.value ? "true" : "false"} class="h-full shrink-0">
        <ResizeHandle
          direction="horizontal"
          size={state.left}
          min={180}
          max={560}
          onResize={resizeLeft}
          onDraggingChange={(value) => setDragging("value", value)}
        />
      </div>
      <div data-voidcode-column class="h-full min-w-0 flex-1">{props.center}</div>
      <div data-voidcode-resize data-dragging={dragging.value ? "true" : "false"} class="h-full shrink-0">
        <ResizeHandle
          direction="horizontal"
          edge="start"
          size={state.right}
          min={240}
          max={640}
          onResize={resizeRight}
          onDraggingChange={(value) => setDragging("value", value)}
        />
      </div>
      <div data-voidcode-column style={{ width: `${state.right}px` }} class="h-full shrink-0">
        {props.right}
      </div>
    </div>
  )
}

export const ResizableInspector: Component<{
  views: Record<InspectorTab, JSX.Element>
  visible: boolean
  onVisibilityChange?: (visible: boolean) => void
  class?: string
}> = (props) => {
  const [state, setState] = createStore({ width: 320 })
  const [dragging, setDragging] = createStore({ value: false })

  onMount(() => setState("width", persistedWidth(RIGHT_KEY, 320)))

  const resize = (width: number) => {
    setState("width", width)
    localStorage.setItem(RIGHT_KEY, String(width))
  }

  return (
    <Show when={props.visible}>
      <div class={props.class ?? "relative h-full shrink-0"}>
        <div data-voidcode-resize data-dragging={dragging.value ? "true" : "false"} class="absolute inset-y-0 start-0 z-10">
          <ResizeHandle
            direction="horizontal"
            edge="start"
            size={state.width}
            min={240}
            max={640}
            onResize={resize}
            onDraggingChange={(value) => setDragging("value", value)}
          />
        </div>
        <div data-voidcode-column style={{ width: `${state.width}px` }} class="h-full">
          <InspectorPanel views={props.views} />
        </div>
      </div>
    </Show>
  )
}
