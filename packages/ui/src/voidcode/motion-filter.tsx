import { type Component } from "solid-js"

/**
 * SVG blur used by the spring/motion-blur CSS keyframes. Kept in the DOM so CSS `filter: url(...)` can resolve it.
 * A plain CSS `blur()` is used for the second half of the animation; this filter gives the opening impulse its
 * directional-looking smear without a second compositor layer.
 */
export const VoidcodeMotionFilter: Component = () => (
  <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute", width: 0, height: 0 }}>
    <defs>
      <filter id="voidcode-motion-blur" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
    </defs>
  </svg>
)
