import { Button } from "@opencode/ui/button"
import { Switch } from "@opencode/ui/switch"
import { Icon } from "@opencode/ui/icon"
import type { Component } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { SettingsList } from "@/settings/list"
import { SettingsRow } from "@/settings/row"
import { useVoidcode } from "./preferences"
import "./settings.css"

export const SettingsPrivacy: Component = () => {
  const language = useLanguage()
  const preferences = useVoidcode()

  return (
    <>
      <div class="settings-tab-header">
        <div class="settings-tab-header-row">
          <div class="flex flex-col gap-1">
            <h2 class="settings-tab-title">{language.t("voidcode.privacy.title")}</h2>
            <span class="text-11-regular text-v2-text-text-muted">{language.t("voidcode.privacy.description")}</span>
          </div>
        </div>
      </div>
      <div class="settings-tab-body">
        <div class="settings-section">
          <div class="voidcode-privacy-indicator">
            <Icon name="shield" />
            <span>{language.t("voidcode.privacy.indicator")}</span>
          </div>
          <SettingsList>
            <SettingsRow
              title={language.t("voidcode.privacy.row.localOnly.title")}
              description={language.t("voidcode.privacy.row.localOnly.description")}
            >
              <Switch
                checked={preferences.state.localOnly}
                onChange={(localOnly) => preferences.patch({ localOnly })}
              />
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.privacy.row.zeroTelemetry.title")}
              description={language.t("voidcode.privacy.row.zeroTelemetry.description")}
            >
              <Switch
                checked={preferences.state.zeroTelemetry}
                onChange={(zeroTelemetry) => preferences.patch({ zeroTelemetry })}
              />
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.privacy.row.autoWipe.title")}
              description={language.t("voidcode.privacy.row.autoWipe.description")}
            >
              <Switch checked={preferences.state.autoWipe} onChange={(autoWipe) => preferences.patch({ autoWipe })} />
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.privacy.row.blur.title")}
              description={language.t("voidcode.privacy.row.blur.description", { keybind: "Ctrl+Shift+H" })}
            >
              <Switch
                checked={preferences.state.blurSensitive}
                onChange={(blurSensitive) => preferences.patch({ blurSensitive })}
              />
            </SettingsRow>
            <SettingsRow
              title={language.t("voidcode.privacy.emergency.title")}
              description={language.t("voidcode.privacy.emergency.description")}
            >
              <Button variant="danger" onClick={() => preferences.clearLocalData()}>
                {language.t("voidcode.privacy.emergency.action")}
              </Button>
            </SettingsRow>
          </SettingsList>
        </div>
      </div>
    </>
  )
}