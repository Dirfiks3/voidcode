import { Popover } from "@kobalte/core/popover"
import { createEffect, createSignal, type Component } from "solid-js"
import { createOverlayFocus } from "../context/overlay-focus"
import { useI18n } from "../context/i18n"
import {
  DEFAULT_EFFORT_LEVEL,
  EffortSlider,
  effortLevelFromVariant,
  effortLevelName,
  effortVariantForLevel,
  readEffortLevel,
  writeEffortLevel,
  type EffortLevel,
  type EffortSelection,
} from "./effort-slider"

// The composer keeps its full effort editor in a popover: the resting toolbar stays one row tall.
export const EffortPill: Component<{
  selection: EffortSelection
  sessionID?: string
}> = (props) => {
  const i18n = useI18n()
  const overlayFocus = createOverlayFocus()
  const [open, setOpen] = createSignal(false)
  const [level, setLevel] = createSignal<EffortLevel>(
    readEffortLevel(props.sessionID, effortLevelFromVariant(props.selection.variant.current()) ?? DEFAULT_EFFORT_LEVEL),
  )
  const label = () => i18n.t(`ui.voidcode.effort.${effortLevelName(level())}`)

  // A variant chosen elsewhere (the session, another window) stays the source of truth while this pill is mounted.
  createEffect(() => {
    const fromSelection = effortLevelFromVariant(props.selection.variant.current())
    if (fromSelection !== undefined && fromSelection !== level()) setLevel(fromSelection)
  })

  // Keep the model's variant in sync even before the popover is opened, so the pill reflects the real selection.
  createEffect(() => {
    const variant = effortVariantForLevel(level(), props.selection.variant.list())
    if (variant && variant !== props.selection.variant.current()) props.selection.variant.set(variant)
  })

  const choose = (next: EffortLevel) => {
    setLevel(next)
    writeEffortLevel(props.sessionID, next)
  }

  return (
    <Popover
      open={open()}
      onOpenChange={(next) => {
        overlayFocus.openChanged(next)
        setOpen(next)
      }}
      placement="top-start"
      gutter={6}
    >
      <Popover.Trigger
        as="button"
        type="button"
        data-voidcode-capsule
        data-slot="composer-effort"
        data-open={open() ? "true" : undefined}
        class="voidcode-effort-pill"
        // The composer is a form and the toolbar scrolls; keep the press here and let the popover own the open state.
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        aria-haspopup="dialog"
        aria-expanded={open()}
        aria-label={`${i18n.t("ui.voidcode.effort.label")}: ${label()}`}
      >
        <span class="voidcode-effort-pill__glyph" aria-hidden="true" />
        <span class="voidcode-effort-pill__level">{label()}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          data-voidcode-glass
          data-slot="composer-effort-popover"
          class="voidcode-effort-popover"
          style={{ "z-index": 80 }}
          aria-label={i18n.t("ui.voidcode.effort.label")}
          onCloseAutoFocus={(event) => overlayFocus.restore(event)}
        >
          <EffortSlider
            compact
            selection={props.selection}
            sessionID={props.sessionID}
            level={level()}
            onLevelChange={choose}
            class="voidcode-effort-popover__slider"
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  )
}
