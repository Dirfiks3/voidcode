import { Button } from "@opencode/ui/button"
import { Select } from "@opencode/ui/select"
import { TextInput } from "@opencode/ui/text-input"
import type { Component } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { createAppearanceSettingsController } from "@/settings/general/controllers"
import { SettingsList } from "@/settings/list"
import { SettingsRow } from "@/settings/row"
import { useVoidcode, type VoidcodeAccent, type VoidcodeDensity, type VoidcodeSurface } from "./preferences"
import "./settings.css"

const accents: { value: VoidcodeAccent; label: Parameters<ReturnType<typeof useLanguage>["t"]>[0] }[] = [
  { value: "obsidian", label: "voidcode.studio.row.accent.obsidian" },
  { value: "antigravity", label: "voidcode.studio.row.accent.antigravity" },
  { value: "emerald", label: "voidcode.studio.row.accent.emerald" },
  { value: "crimson", label: "voidcode.studio.row.accent.crimson" },
]

const surfaces: { value: VoidcodeSurface; label: Parameters<ReturnType<typeof useLanguage>["t"]>[0] }[] = [
  { value: "amoled", label: "voidcode.studio.row.surface.amoled" },
  { value: "graphite", label: "voidcode.studio.row.surface.graphite" },
]

const densities: { value: VoidcodeDensity; label: Parameters<ReturnType<typeof useLanguage>["t"]>[0] }[] = [
  { value: "standard", label: "voidcode.studio.row.density.standard" },
  { value: "compact", label: "voidcode.studio.row.density.compact" },
]

function Slider(props: {
  label: string
  min: number
  max: number
  value: number
  display: string
  onChange: (value: number) => void
}) {
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

export const SettingsCustomization: Component = () => {
  const language = useLanguage()
  const preferences = useVoidcode()
  const appearance = createAppearanceSettingsController()

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
      <div class="settings-tab-body">
        <div class="settings-section">
          <SettingsList>
            <SettingsRow
              title={language.t("voidcode.settings.replayHello")}
              description={language.t("voidcode.settings.replayHello.description")}
            >
              <Button variant="outline" onClick={() => preferences.openHello()}>
                {language.t("voidcode.settings.replayHello")}
              </Button>
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.studio.row.username.title")}
              description={language.t("voidcode.studio.row.username.description")}
            >
              <TextInput
                type="text"
                appearance="base"
                value={preferences.state.username}
                placeholder={language.t("voidcode.hello.username.placeholder")}
                aria-label={language.t("voidcode.studio.row.username.title")}
                spellcheck={false}
                onInput={(event) => preferences.patch({ username: event.currentTarget.value })}
              />
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.studio.row.accent.title")}
              description={language.t("voidcode.studio.row.accent.description")}
            >
              <Select
                options={accents}
                current={accents.find((option) => option.value === preferences.state.accent)}
                placement="bottom-end"
                gutter={6}
                value={(option) => option.value}
                label={(option) => language.t(option.label)}
                onSelect={(option) => option && preferences.patch({ accent: option.value })}
              />
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.studio.row.surface.title")}
              description={language.t("voidcode.studio.row.surface.description")}
            >
              <Select
                options={surfaces}
                current={surfaces.find((option) => option.value === preferences.state.surface)}
                placement="bottom-end"
                gutter={6}
                value={(option) => option.value}
                label={(option) => language.t(option.label)}
                onSelect={(option) => option && preferences.patch({ surface: option.value })}
              />
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.studio.row.density.title")}
              description={language.t("voidcode.studio.row.density.description")}
            >
              <Select
                options={densities}
                current={densities.find((option) => option.value === preferences.state.density)}
                placement="bottom-end"
                gutter={6}
                value={(option) => option.value}
                label={(option) => language.t(option.label)}
                onSelect={(option) => option && preferences.patch({ density: option.value })}
              />
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.studio.row.glassOpacity.title")}
              description={language.t("voidcode.studio.row.glassOpacity.description")}
            >
              <Slider
                label={language.t("voidcode.studio.row.glassOpacity.title")}
                min={0}
                max={100}
                value={preferences.state.glassOpacity}
                display={`${preferences.state.glassOpacity}%`}
                onChange={(glassOpacity) => preferences.patch({ glassOpacity })}
              />
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.studio.row.glassBlur.title")}
              description={language.t("voidcode.studio.row.glassBlur.description")}
            >
              <Slider
                label={language.t("voidcode.studio.row.glassBlur.title")}
                min={0}
                max={32}
                value={preferences.state.glassBlur}
                display={`${preferences.state.glassBlur}px`}
                onChange={(glassBlur) => preferences.patch({ glassBlur })}
              />
            </SettingsRow>
            <SettingsRow
              title={language.t("settings.general.row.font.title")}
              description={language.t("settings.general.row.font.description")}
            >
              <TextInput
                type="text"
                appearance="base"
                value={appearance.fonts.code().value}
                placeholder={appearance.fonts.code().placeholder}
                aria-label={language.t("settings.general.row.font.title")}
                spellcheck={false}
                style={{ "font-family": appearance.fonts.code().family }}
                onInput={(event) => appearance.fonts.setCode(event.currentTarget.value)}
              />
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.studio.row.chatFontSize.title")}
              description={language.t("voidcode.studio.row.chatFontSize.description")}
            >
              <Slider
                label={language.t("voidcode.studio.row.chatFontSize.title")}
                min={11}
                max={22}
                value={preferences.state.chatFontSize}
                display={`${preferences.state.chatFontSize}px`}
                onChange={(chatFontSize) => preferences.patch({ chatFontSize })}
              />
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.studio.reset")}
              description={language.t("voidcode.studio.description")}
            >
              <Button variant="ghost" onClick={() => preferences.reset()}>
                {language.t("voidcode.studio.reset")}
              </Button>
            </SettingsRow>
          </SettingsList>
        </div>
      </div>
    </>
  )
}
