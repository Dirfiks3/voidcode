import { Button } from "@opencode/ui/button"
import { Select } from "@opencode/ui/select"
import { Switch } from "@opencode/ui/switch"
import { useTheme, type DesktopTheme, type ThemeVariant } from "@opencode/ui/theme"
import { showToast } from "@opencode/ui/toast"
import { For, Show, createEffect, createMemo, onCleanup, onMount, untrack, type Component } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/runtime/i18n/language"
import { useSettingsSurface } from "@/settings/surface"
import { SettingsList } from "@/settings/list"
import { SettingsRow } from "@/settings/row"
import { useVoidcode, type VoidcodeLiquidPreset, type VoidcodeWallpaper } from "./preferences"
import { Slider } from "./slider"
import {
  transitionImageImport,
  transitionThemeImport,
  type ImageImportState,
  type ThemeImportState,
} from "./studio-machine"
import "./settings.css"

const THEME_STORAGE_KEY = "voidcode.themes.v1"

const liquidPresets: { value: VoidcodeLiquidPreset; label: Parameters<ReturnType<typeof useLanguage>["t"]>[0] }[] = [
  { value: "crystal", label: "voidcode.studio.row.liquid.preset.crystal" },
  { value: "frosted", label: "voidcode.studio.row.liquid.preset.frosted" },
  { value: "clear", label: "voidcode.studio.row.liquid.preset.clear" },
]

const wallpapers: { value: VoidcodeWallpaper; label: Parameters<ReturnType<typeof useLanguage>["t"]>[0] }[] = [
  { value: "none", label: "voidcode.studio.row.wallpaper.none" },
  { value: "amoled", label: "voidcode.studio.row.wallpaper.amoled" },
  { value: "singularity", label: "voidcode.studio.row.wallpaper.singularity" },
  { value: "mesh", label: "voidcode.studio.row.wallpaper.mesh" },
  { value: "custom", label: "voidcode.studio.row.wallpaper.custom" },
]

const imageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"])

type ThemeDecode = { theme: DesktopTheme } | { reason: "json" | "shape" }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isColor(value: unknown) {
  return (
    typeof value === "string" &&
    (/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(value) || /^var\(--[a-z0-9-]+\)$/.test(value))
  )
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key))
}

function isColorMap(value: unknown) {
  return isRecord(value) && Object.values(value).every(isColor)
}

function isStringMap(value: unknown) {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "string")
}

function isPalette(value: unknown) {
  return (
    isRecord(value) &&
    ["neutral", "ink", "primary", "success", "warning", "error", "info"].every((key) => isColor(value[key])) &&
    (value.accent === undefined || isColor(value.accent)) &&
    (value.interactive === undefined || isColor(value.interactive)) &&
    (value.diffAdd === undefined || isColor(value.diffAdd)) &&
    (value.diffDelete === undefined || isColor(value.diffDelete)) &&
    hasOnlyKeys(value, [
      "neutral",
      "ink",
      "primary",
      "success",
      "warning",
      "error",
      "info",
      "accent",
      "interactive",
      "diffAdd",
      "diffDelete",
    ])
  )
}

function isSeeds(value: unknown) {
  const keys = ["neutral", "primary", "success", "warning", "error", "info", "interactive", "diffAdd", "diffDelete"]

  return isRecord(value) && keys.every((key) => isColor(value[key])) && hasOnlyKeys(value, keys)
}

function isVariant(value: unknown): value is ThemeVariant {
  if (!isRecord(value)) return false
  const hasPalette = "palette" in value
  const hasSeeds = "seeds" in value

  if (hasPalette === hasSeeds) return false
  if (hasPalette && !isPalette(value.palette)) return false
  if (hasSeeds && !isSeeds(value.seeds)) return false
  if (value.overrides !== undefined && !isColorMap(value.overrides)) return false
  if (value.v2Overrides !== undefined && !isStringMap(value.v2Overrides)) return false

  return true
}

function isDesktopTheme(value: unknown): value is DesktopTheme {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    typeof value.id === "string" &&
    /^[a-z0-9-]+$/.test(value.id) &&
    isVariant(value.light) &&
    isVariant(value.dark)
  )
}

function decodeTheme(text: string): ThemeDecode {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { reason: "json" }
  }
  return isDesktopTheme(value) ? { theme: value } : { reason: "shape" }
}

function importedThemeId(id: string) {
  return id.startsWith("voidcode-imported-") ? id : `voidcode-imported-${id}`
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "theme"
}

function readStoredThemes(): Record<string, DesktopTheme> {
  if (typeof localStorage === "undefined") return {}
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (!raw) return {}
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value)) return {}
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, DesktopTheme] => isDesktopTheme(entry[1])),
    )
  } catch {
    return {}
  }
}

function downloadJson(name: string, value: string) {
  const url = URL.createObjectURL(new Blob([value], { type: "application/json" }))
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error("Image read failed"))
    reader.readAsDataURL(file)
  })
}

export const SettingsStudio: Component = () => {
  const language = useLanguage()
  const preferences = useVoidcode()
  const surface = useSettingsSurface()
  const theme = useTheme()
  const [state, setState] = createStore<{
    preview: string | null
    themeImport: ThemeImportState
    imageImport: ImageImportState
  }>({
    preview: null,
    themeImport: { type: "idle" },
    imageImport: { type: "idle" },
  })
  const [storedThemes, setStoredThemes] = createStore<Record<string, DesktopTheme>>({})
  const unregisterThemes = new Map<string, () => void>()
  let themeFile: HTMLInputElement | undefined
  let imageFile: HTMLInputElement | undefined
  let themeAttempt = 0
  let imageAttempt = 0

  const dispatchTheme = (event: Parameters<typeof transitionThemeImport>[1]) =>
    setState("themeImport", (current) => transitionThemeImport(current, event))

  const dispatchImage = (event: Parameters<typeof transitionImageImport>[1]) =>
    setState("imageImport", (current) => transitionImageImport(current, event))

  const themeNames = createMemo(() => theme.ids())

  const registerImported = (value: DesktopTheme) => {
    unregisterThemes.get(value.id)?.()
    unregisterThemes.set(value.id, theme.registerTheme(value))
    setStoredThemes(value.id, value)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(untrack(() => ({ ...storedThemes }))))
    } catch {
      // Storage can be full or unavailable; the theme remains usable until the window closes.
    }
  }

  onMount(() => {
    void theme.loadThemes()
    for (const value of Object.values(readStoredThemes())) registerImported(value)
  })

  onCleanup(() => {
    dispatchTheme({ type: "disposed" })
    dispatchImage({ type: "disposed" })
    for (const unregister of unregisterThemes.values()) unregister()
    unregisterThemes.clear()
  })

  createEffect(() => {
    const current = state.themeImport

    if (current.type === "invalid") {
      showToast({
        variant: "error",
        title: language.t("voidcode.studio.theme.importError"),
        description: language.t("voidcode.studio.theme.invalidJson"),
      })
    }

    if (current.type !== "validating") return

    const decoded = decodeTheme(current.text)
    if ("reason" in decoded) {
      dispatchTheme({ type: "invalid", attempt: current.attempt, reason: decoded.reason })
      return
    }

    const value = { ...decoded.theme, id: importedThemeId(decoded.theme.id) }
    registerImported(value)
    theme.previewTheme(value.id)
    setState("preview", value.id)
    dispatchTheme({ type: "imported", attempt: current.attempt, id: value.id })
    showToast({
      variant: "success",
      title: language.t("voidcode.studio.theme.importSuccess"),
      description: value.name,
    })
  })

  createEffect(() => {
    const current = state.imageImport

    if (current.type === "invalid") {
      showToast({
        variant: "error",
        title: language.t("voidcode.studio.file.invalidType"),
        description: language.t(current.reason === "size" ? "voidcode.studio.file.tooLarge" : "voidcode.studio.file.invalidType"),
      })
    }

    if (current.type !== "ready") return
    preferences.patch({ wallpaper: "custom", wallpaperImage: current.data })
  })

  const selectThemeFile = async (file: File | undefined) => {
    if (!file) return
    const attempt = ++themeAttempt
    dispatchTheme({ type: "start", attempt })
    try {
      const text = await file.text()
      dispatchTheme({ type: "read", attempt, text })
    } catch {
      dispatchTheme({ type: "invalid", attempt, reason: "json" })
    }
  }

  const selectImageFile = async (file: File | undefined) => {
    if (!file) return
    const attempt = ++imageAttempt
    dispatchImage({ type: "start", attempt })

    if (!imageTypes.has(file.type)) {
      dispatchImage({ type: "invalid", attempt, reason: "type" })
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      dispatchImage({ type: "invalid", attempt, reason: "size" })
      return
    }

    try {
      const data = await readImage(file)
      dispatchImage({ type: "ready", attempt, data })
    } catch {
      dispatchImage({ type: "invalid", attempt, reason: "type" })
    }
  }

  const preview = (id: string) => {
    theme.previewTheme(id)
    setState("preview", id)
  }

  const apply = (id: string) => {
    if (state.preview === id) theme.commitPreview()
    else theme.setTheme(id)
    setState("preview", null)
  }

  const stopPreview = () => {
    theme.cancelPreview()
    setState("preview", null)
  }

  const isApplied = (id: string) => theme.themeId() === id && state.preview !== id

  const exportCurrent = () => {
    const id = theme.themeId()
    const value = theme.themes()[id]
    if (!value) return
    downloadJson(`${slug(value.name)}.json`, JSON.stringify(value, null, 2))
  }

  return (
    <>
      <div class="settings-tab-header">
        <div class="settings-tab-header-row">
          <div class="flex flex-col gap-1">
            <h2 class="settings-tab-title">{language.t("voidcode.studio.title")}</h2>
            <span class="text-11-regular text-v2-text-text-muted">{language.t("voidcode.studio.description")}</span>
          </div>
        </div>
      </div>
      <div class="settings-tab-body voidcode-studio">
        <section class="voidcode-studio-section">
          <h3 class="voidcode-studio-section-title">{language.t("voidcode.studio.section.liquid")}</h3>
          <SettingsList>
            <SettingsRow
              title={language.t("voidcode.studio.row.liquid.enabled.title")}
              description={language.t("voidcode.studio.row.liquid.enabled.description")}
            >
              <Switch
                checked={preferences.state.liquidGlass}
                onChange={(liquidGlass) => preferences.patch({ liquidGlass })}
              />
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.studio.row.liquid.preset.title")}
              description={language.t("voidcode.studio.row.liquid.preset.description")}
            >
              <Select
                options={liquidPresets}
                current={liquidPresets.find((option) => option.value === preferences.state.liquidPreset)}
                placement="bottom-end"
                gutter={6}
                value={(option) => option.value}
                label={(option) => language.t(option.label)}
                onSelect={(option) => option && preferences.patch({ liquidPreset: option.value })}
              />
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.studio.row.liquid.motion.title")}
              description={language.t("voidcode.studio.row.liquid.motion.description")}
            >
              <Switch
                checked={preferences.state.motionBlur}
                onChange={(motionBlur) => preferences.patch({ motionBlur })}
              />
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.studio.row.windowOpacity.title")}
              description={language.t("voidcode.studio.row.windowOpacity.description")}
            >
              <Slider
                label={language.t("voidcode.studio.row.windowOpacity.title")}
                min={60}
                max={100}
                value={preferences.state.windowOpacity}
                display={`${preferences.state.windowOpacity}%`}
                onChange={(windowOpacity) => preferences.patch({ windowOpacity })}
              />
            </SettingsRow>
          </SettingsList>
        </section>

        <section class="voidcode-studio-section">
          <h3 class="voidcode-studio-section-title">{language.t("voidcode.studio.section.wallpaper")}</h3>
          <SettingsList>
            <SettingsRow
              title={language.t("voidcode.studio.row.wallpaper.title")}
              description={language.t("voidcode.studio.row.wallpaper.description")}
            >
              <Select
                options={wallpapers}
                current={wallpapers.find((option) => option.value === preferences.state.wallpaper)}
                placement="bottom-end"
                gutter={6}
                value={(option) => option.value}
                label={(option) => language.t(option.label)}
                onSelect={(option) => option && preferences.patch({ wallpaper: option.value })}
              />
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.studio.row.wallpaper.upload")}
              description={language.t("voidcode.studio.row.wallpaper.fileTypes")}
            >
              <div class="voidcode-studio-actions">
                <input
                  ref={imageFile}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  class="sr-only"
                  aria-label={language.t("voidcode.studio.row.wallpaper.upload")}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    event.currentTarget.value = ""
                    void selectImageFile(file)
                  }}
                />
                <Button variant="outline" onClick={() => imageFile?.click()}>
                  {language.t("voidcode.studio.row.wallpaper.upload")}
                </Button>
                <Show when={preferences.state.wallpaper === "custom"}>
                  <Button
                    variant="ghost"
                    onClick={() => preferences.patch({ wallpaper: "none", wallpaperImage: "" })}
                  >
                    {language.t("voidcode.studio.row.wallpaper.clear")}
                  </Button>
                </Show>
              </div>
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.studio.row.wallpaperDim.title")}
              description={language.t("voidcode.studio.row.wallpaperDim.description")}
            >
              <Slider
                label={language.t("voidcode.studio.row.wallpaperDim.title")}
                min={0}
                max={90}
                value={preferences.state.wallpaperDim}
                display={`${preferences.state.wallpaperDim}%`}
                onChange={(wallpaperDim) => preferences.patch({ wallpaperDim })}
              />
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.studio.row.wallpaperBlur.title")}
              description={language.t("voidcode.studio.row.wallpaperBlur.description")}
            >
              <Slider
                label={language.t("voidcode.studio.row.wallpaperBlur.title")}
                min={0}
                max={32}
                value={preferences.state.wallpaperBlur}
                display={`${preferences.state.wallpaperBlur}px`}
                onChange={(wallpaperBlur) => preferences.patch({ wallpaperBlur })}
              />
            </SettingsRow>
          </SettingsList>
        </section>

        <section class="voidcode-studio-section">
          <h3 class="voidcode-studio-section-title">{language.t("voidcode.studio.section.themes")}</h3>
          <SettingsList>
            <SettingsRow
              title={language.t("voidcode.studio.row.themeList.title")}
              description={language.t("voidcode.studio.row.themeList.description")}
              align="start"
            >
              <div class="voidcode-studio-themes">
                <For each={themeNames()}>
                  {(id) => (
                    <div class="voidcode-studio-theme">
                      <span class="voidcode-studio-theme-name">{theme.name(id)}</span>
                      <div class="voidcode-studio-actions">
                        <Button
                          size="small"
                          variant={isApplied(id) ? "ghost" : "outline"}
                          disabled={isApplied(id)}
                          onClick={() => (state.preview === id ? apply(id) : preview(id))}
                        >
                          {language.t(
                            state.preview === id
                              ? "voidcode.studio.theme.apply"
                              : isApplied(id)
                                ? "voidcode.studio.theme.applied"
                                : "voidcode.studio.theme.preview",
                          )}
                        </Button>
                        <Show when={state.preview === id}>
                          <Button size="small" variant="ghost" onClick={stopPreview}>
                            {language.t("voidcode.studio.theme.stopPreview")}
                          </Button>
                        </Show>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.studio.row.themeImport.title")}
              description={language.t("voidcode.studio.row.themeImport.description")}
            >
              <input
                ref={themeFile}
                type="file"
                accept="application/json,.json"
                class="sr-only"
                aria-label={language.t("voidcode.studio.row.themeImport.action")}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0]
                  event.currentTarget.value = ""
                  void selectThemeFile(file)
                }}
              />
              <Button variant="outline" onClick={() => themeFile?.click()}>
                {language.t("voidcode.studio.row.themeImport.action")}
              </Button>
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.studio.row.themeExport.title")}
              description={language.t("voidcode.studio.row.themeExport.description")}
            >
              <Button variant="outline" onClick={exportCurrent}>
                {language.t("voidcode.studio.row.themeExport.action")}
              </Button>
            </SettingsRow>
          </SettingsList>
        </section>

        <section class="voidcode-studio-section">
          <h3 class="voidcode-studio-section-title">{language.t("voidcode.studio.section.css")}</h3>
          <SettingsList>
            <SettingsRow
              title={language.t("voidcode.studio.row.customCss.enabled")}
              description={language.t("voidcode.studio.row.customCss.description")}
            >
              <Switch
                checked={preferences.state.customCssEnabled}
                onChange={(customCssEnabled) => preferences.patch({ customCssEnabled })}
              />
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.studio.row.customCss.kill")}
              description={language.t("voidcode.studio.row.customCss.description")}
              align="start"
            >
              <textarea
                class="voidcode-studio-css"
                rows={10}
                spellcheck={false}
                value={preferences.state.customCss}
                placeholder={language.t("voidcode.studio.row.customCss.placeholder")}
                aria-label={language.t("voidcode.studio.row.customCss.title")}
                onInput={(event) => preferences.patch({ customCss: event.currentTarget.value })}
              />
            </SettingsRow>
          </SettingsList>
        </section>

        <section class="voidcode-studio-section">
          <h3 class="voidcode-studio-section-title">{language.t("voidcode.studio.section.keybinds")}</h3>
          <SettingsList>
            <SettingsRow
              title={language.t("voidcode.studio.keybinds.title")}
              description={language.t("voidcode.studio.keybinds.description")}
            >
              <Button variant="outline" onClick={() => surface.select("shortcuts")}>
                {language.t("voidcode.studio.keybinds.action")}
              </Button>
            </SettingsRow>
          </SettingsList>
        </section>
      </div>
    </>
  )
}
