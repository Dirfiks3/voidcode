import type { Component } from "solid-js"

type SliderProps = {
  label: string
  min: number
  max: number
  value: number
  display: string
  onChange: (value: number) => void
}

export const Slider: Component<SliderProps> = (props) => {
  return (
    <div class="voidcode-slider">
      <input
        type="range"
        min={props.min}
        max={props.max}
        value={props.value}
        aria-label={props.label}
        onInput={(event) => props.onChange(Number(event.currentTarget.value))}
      />
      <span>{props.display}</span>
    </div>
  )
}
