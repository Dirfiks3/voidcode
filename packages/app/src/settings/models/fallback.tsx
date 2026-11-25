import { Button } from "@opencode/ui/button"
import { IconButton } from "@opencode/ui/icon-button"
import { Switch } from "@opencode/ui/switch"
import { For, Show, createMemo } from "solid-js"
import { ModelLogo } from "@opencode/ui/voidcode"
import { useLanguage } from "@/runtime/i18n/language"
import { useModels } from "@/providers/models/models"
import { defaultModelFallback, type ModelFallbackEntry, useSettings } from "@/settings/model"
import { SettingsList } from "@/settings/list"
import { SettingsRow } from "@/settings/row"

function same(a: Pick<ModelFallbackEntry, "providerID" | "modelID">, b: Pick<ModelFallbackEntry, "providerID" | "modelID">) {
  return a.providerID === b.providerID && a.modelID === b.modelID
}

export function ModelFallbackSettings() {
  const language = useLanguage()
  const models = useModels()
  const settings = useSettings()

  const entries = createMemo(() => settings.general.modelFallback())
  const options = createMemo(() =>
    models
      .list()
      .filter((item) => models.visible({ providerID: item.provider.id, modelID: item.id }))
      .map((item) => ({
        providerID: item.provider.id,
        modelID: item.id,
        name: item.name,
        provider: item.provider.name,
      })),
  )

  const setEntries = (next: readonly ModelFallbackEntry[]) => settings.general.setModelFallback([...next])

  const add = (providerID: string, modelID: string) => {
    if (!providerID || !modelID) return
    const current = entries()
    if (current.some((item) => item.providerID === providerID && item.modelID === modelID)) return
    setEntries([...current, { providerID, modelID, enabled: true }])
  }

  const move = (index: number, dir: -1 | 1) => {
    const list = [...entries()]
    const next = index + dir
    if (next < 0 || next >= list.length) return
    const [item] = list.splice(index, 1)
    if (!item) return
    list.splice(next, 0, item)
    setEntries(list)
  }

  const remove = (index: number) => setEntries(entries().filter((_, i) => i !== index))

  const toggle = (index: number, enabled: boolean) =>
    setEntries(entries().map((item, i) => (i === index ? { ...item, enabled } : item)))

  const label = (item: ModelFallbackEntry) => {
    const found = models.list().find((m) => m.provider.id === item.providerID && m.id === item.modelID)
    if (found) return { name: found.name, provider: found.provider.name }
    return { name: item.modelID, provider: item.providerID }
  }

  return (
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <select
          class="h-9 min-w-[220px] rounded-md border border-border-weak-base bg-background-base px-2 text-12-regular text-text-base"
          aria-label={language.t("settings.models.fallback.pickModel")}
          onChange={(e) => {
            const value = e.currentTarget.value
            const [providerID, modelID] = value.split("::")
            add(providerID ?? "", modelID ?? "")
            e.currentTarget.value = ""
          }}
        >
          <option value="">{language.t("settings.models.fallback.add")}</option>
          <For each={options().filter((opt) => !entries().some((item) => same(item, opt)))}>
            {(opt) => (
              <option value={`${opt.providerID}::${opt.modelID}`}>
                {opt.provider} / {opt.name}
              </option>
            )}
          </For>
        </select>
        <Button size="small" variant="ghost" onClick={() => setEntries(defaultModelFallback)}>
          {language.t("settings.models.fallback.reset")}
        </Button>
      </div>

      <Show
        when={entries().length > 0}
        fallback={<div class="text-12-regular text-text-weak">{language.t("settings.models.fallback.empty")}</div>}
      >
        <SettingsList>
          <For each={entries()}>
            {(item, index) => {
              const info = createMemo(() => label(item))
              return (
                <SettingsRow
                  title={
                    <div class="flex items-center gap-2 min-w-0">
                      <ModelLogo providerID={item.providerID} modelID={item.modelID} size={18} />
                      <span class="truncate">{info().name}</span>
                    </div>
                  }
                  description={info().provider}
                >
                  <div class="flex items-center gap-1">
                    <Switch
                      checked={item.enabled}
                      onChange={(value) => toggle(index(), value)}
                      hideLabel
                      aria-label={language.t(item.enabled ? "settings.models.fallback.disable" : "settings.models.fallback.enable")}
                    />
                    <IconButton
                      icon="arrow-up"
                      variant="ghost"
                      size="small"
                      aria-label={language.t("settings.models.fallback.moveUp")}
                      onClick={() => move(index(), -1)}
                      disabled={index() === 0}
                    />
                    <IconButton
                      icon="arrow-down"
                      variant="ghost"
                      size="small"
                      aria-label={language.t("settings.models.fallback.moveDown")}
                      onClick={() => move(index(), 1)}
                      disabled={index() === entries().length - 1}
                    />
                    <IconButton
                      icon="trash"
                      variant="ghost"
                      size="small"
                      aria-label={language.t("settings.models.fallback.remove")}
                      onClick={() => remove(index())}
                    />
                  </div>
                </SettingsRow>
              )
            }}
          </For>
        </SettingsList>
      </Show>
    </div>
  )
}
