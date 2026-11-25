import { Icon } from "@opencode/ui/icon"
import { VoidLogo } from "@opencode/ui/voidcode"
import { createEffect, createSignal, onMount, Show, type Component } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { useVoidcode, type VoidcodeGreetingLanguage } from "./preferences"
import "./hello.css"

const LANGUAGES: VoidcodeGreetingLanguage[] = ["en", "ru", "es", "fr", "ja"]

const LABELS: Record<VoidcodeGreetingLanguage, string> = {
  en: "EN",
  ru: "RU",
  es: "ES",
  fr: "FR",
  ja: "JA",
}

function nativeUsername() {
  if (typeof window === "undefined") return Promise.resolve("")
  const native = (window as unknown as { electron?: { systemUsername?: Promise<string> } }).electron
  return native?.systemUsername ?? Promise.resolve("")
}

/** First-run greeting, replayable from Settings. One calm moment, five languages, no wizard. */
export const HelloOverlay: Component = () => {
  const preferences = useVoidcode()
  const language = useLanguage()
  const [greeting, setGreeting] = createSignal<VoidcodeGreetingLanguage>("en")
  const [name, setName] = createSignal("")

  createEffect(() => {
    if (!preferences.helloOpen()) return
    setGreeting("en")
    setName(preferences.state.username || "")
  })

  onMount(() => {
    void nativeUsername().then((value) => {
      if (!preferences.state.username && !name()) setName(value)
    })
  })

  const visible = () => !preferences.state.onboardingSeen || preferences.helloOpen()

  const finish = () => {
    const trimmed = name().trim()
    preferences.patch({ onboardingSeen: true, username: trimmed })
    preferences.closeHello()
  }

  const dismiss = () => {
    preferences.patch({ onboardingSeen: true })
    preferences.closeHello()
  }

  const greetingText = () =>
    language.t(`voidcode.hello.greeting.${greeting()}`, { username: name().trim() || language.t("voidcode.hello.username.placeholder") })

  return (
    <Show when={visible()}>
      <div class="voidcode-hello" role="dialog" aria-modal="true" aria-label={language.t("voidcode.hello.title")}>
        <button
          type="button"
          class="voidcode-hello__close"
          aria-label={language.t("voidcode.hello.close")}
          onClick={dismiss}
        >
          <Icon name="close" />
        </button>
        <div class="voidcode-hello__card" data-voidcode-glass>
          <div class="voidcode-hello__logo">
            <VoidLogo />
          </div>
          <div class="voidcode-hello__copy">
            <Show when={greeting()} keyed>
              {(active) => <h1 class="voidcode-hello__greeting">{greetingText()}</h1>}
            </Show>
            <p class="voidcode-hello__subtitle">{language.t("voidcode.hello.subtitle")}</p>
          </div>
          <div class="voidcode-hello__languages" role="group" aria-label={language.t("voidcode.hello.language.label")}>
            {LANGUAGES.map((value) => (
              <button
                type="button"
                class="voidcode-hello__language"
                aria-pressed={greeting() === value}
                onClick={() => setGreeting(value)}
              >
                {LABELS[value]}
              </button>
            ))}
          </div>
          <label class="voidcode-hello__field">
            <span>{language.t("voidcode.hello.username.label")}</span>
            <input
              type="text"
              value={name()}
              placeholder={language.t("voidcode.hello.username.placeholder")}
              autocomplete="nickname"
              spellcheck={false}
              onInput={(event) => setName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") finish()
              }}
            />
          </label>
          <button type="button" class="voidcode-hello__start" onClick={finish}>
            {language.t(`voidcode.hello.start.${greeting()}`)}
          </button>
        </div>
      </div>
    </Show>
  )
}