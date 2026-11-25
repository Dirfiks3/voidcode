import { expect, test } from "bun:test"
import { transitionImageImport, transitionThemeImport } from "./studio-machine"

test("theme import ignores results from an earlier attempt", () => {
  const reading = transitionThemeImport({ type: "idle" }, { type: "start", attempt: 1 })
  expect(reading).toEqual({ type: "reading", attempt: 1 })

  const checking = transitionThemeImport(reading, { type: "read", attempt: 1, text: "{}" })
  expect(checking).toEqual({ type: "validating", attempt: 1, text: "{}" })

  const stale = transitionThemeImport(checking, { type: "imported", attempt: 0, id: "old" })
  expect(stale).toBe(checking)

  const imported = transitionThemeImport(checking, { type: "imported", attempt: 1, id: "new" })
  expect(imported).toEqual({ type: "imported", attempt: 1, id: "new" })
})

test("theme import only accepts validation results in the validating phase", () => {
  const idle = transitionThemeImport({ type: "idle" }, { type: "invalid", attempt: 1, reason: "json" })
  expect(idle).toEqual({ type: "idle" })

  const reading = transitionThemeImport({ type: "idle" }, { type: "start", attempt: 1 })
  const early = transitionThemeImport(reading, { type: "invalid", attempt: 1, reason: "shape" })
  expect(early).toBe(reading)

  expect(transitionThemeImport({ type: "imported", attempt: 1, id: "theme" }, { type: "disposed" })).toEqual({
    type: "idle",
  })
})

test("wallpaper image import rejects invalid files and drops stale reads", () => {
  const reading = transitionImageImport({ type: "idle" }, { type: "start", attempt: 2 })
  const invalid = transitionImageImport(reading, { type: "invalid", attempt: 2, reason: "type" })
  expect(invalid).toEqual({ type: "invalid", attempt: 2, reason: "type" })

  const next = transitionImageImport(invalid, { type: "start", attempt: 3 })
  const stale = transitionImageImport(next, { type: "ready", attempt: 2, data: "data:image/png;base64,old" })
  expect(stale).toBe(next)

  const ready = transitionImageImport(next, { type: "ready", attempt: 3, data: "data:image/png;base64,new" })
  expect(ready).toEqual({ type: "ready", attempt: 3, data: "data:image/png;base64,new" })
})
