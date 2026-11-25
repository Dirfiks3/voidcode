import { expect, test } from "bun:test"
import { DEFAULT_THEME_ID } from "./machine"
import { resolveThemeVariant } from "./resolve"
import type { DesktopTheme } from "./types"
import voidcodeThemeJson from "./themes/voidcode.json"

const theme = voidcodeThemeJson as DesktopTheme

test("VoidCode is the default theme", () => {
  expect(DEFAULT_THEME_ID).toBe("voidcode")
})

test.each(["light", "dark"] as const)("VoidCode %s resolves to the Pure AMOLED ramp", (mode) => {
  const tokens = resolveThemeVariant(theme[mode], mode === "dark")

  expect(tokens["background-base"]).toBe("#000000")
  expect(tokens["surface-base"]).toBe("#050507")
  expect(tokens["surface-raised-base"]).toBe("#0a0a0e")
  expect(tokens["border-weak-base"]).toBe("#ffffff14")
})
