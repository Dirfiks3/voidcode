import { Icon } from "@opencode/ui/icon"
import { VoidLogo } from "@opencode/ui/voidcode"
import { createEffect, createSignal, onCleanup, onMount, Show, type Component } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { useVoidcode } from "./preferences"
import "./hello.css"

const GREETINGS = ["Hello", "Hola", "Привет", "Bonjour", "Ciao", "こんにちは", "Hallo", "Olá"]

function nativeUsername() {
  if (typeof window === "undefined") return Promise.resolve("")
  const native = (window as unknown as { electron?: { systemUsername?: Promise<string> } }).electron
  return native?.systemUsername ?? Promise.resolve("")
}

/** First-run registration, then an iOS-style greeting splash on every launch. */
export const HelloOverlay: Component = () => {
  const preferences = useVoidcode()
  const language = useLanguage()
  const [name, setName] = createSignal(preferences.state.username)
  const [splash, setSplash] = createSignal(preferences.state.onboardingSeen)
  const [step, setStep] = createSignal(0)
  const [ready, setReady] = createSignal(false)
  const [leaving, setLeaving] = createSignal(false)

  let timer: ReturnType<typeof setTimeout> | undefined
  let cycle: ReturnType<typeof setInterval> | undefined

  const clearTimers = () => {
    if (timer) clearTimeout(timer)
    if (cycle) clearInterval(cycle)
    timer = undefined
    cycle = undefined
  }

  const stopSplash = () => {
    if (leaving()) return
    clearTimers()
    setLeaving(true)
    timer = setTimeout(() => {
      setSplash(false)
      setReady(false)
      setLeaving(false)
      setStep(0)
      preferences.closeHello()
    }, 420)
  }

  const startSplash = () => {
    clearTimers()
    setLeaving(false)
    setReady(false)
    setStep(0)
    setSplash(true)

    let i = 0
    cycle = setInterval(() => {
      i += 1
      if (i >= GREETINGS.length) {
        if (cycle) clearInterval(cycle)
        cycle = undefined
        setReady(true)
        timer = setTimeout(stopSplash, 1800)
        return
      }
      setStep(i)
    }, 720)
  }

  createEffect(() => {
    if (!preferences.helloOpen()) return
    setName(preferences.state.username || "")
    startSplash()
  })

  onMount(() => {
    void nativeUsername().then((value) => {
      if (!preferences.state.username && !name()) setName(value)
    })
    if (splash()) startSplash()
  })

  onCleanup(clearTimers)

  const firstRun = () => !preferences.state.onboardingSeen
  const visible = () => firstRun() || splash() || preferences.helloOpen()

  const finish = () => {
    const trimmed = name().trim()
    preferences.patch({ onboardingSeen: true, username: trimmed })
    preferences.closeHello()
    setSplash(false)
  }

  const dismiss = () => {
    if (firstRun()) {
      preferences.patch({ onboardingSeen: true })
      preferences.closeHello()
      setSplash(false)
      return
    }
    stopSplash()
  }

  const username = () => name().trim() || language.t("voidcode.hello.username.placeholder")
  const greeting = () => `${GREETINGS[step()]}, ${username()}`

  return (
    <Show when={visible()}>
      <div
        class={`voidcode-hello ${firstRun() ? "voidcode-hello--register" : "voidcode-hello--splash"} ${leaving() ? "voidcode-hello--leaving" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={language.t("voidcode.hello.title")}
        onClick={() => {
          if (!firstRun()) dismiss()
        }}
      >
        <Show when={firstRun()}>
          <button
            type="button"
            class="voidcode-hello__close"
            aria-label={language.t("voidcode.hello.close")}
            onClick={(e) => {
              e.stopPropagation()
              dismiss()
            }}
          >
            <Icon name="close" />
          </button>
          <div class="voidcode-hello__card" data-voidcode-glass onClick={(e) => e.stopPropagation()}>
            <div class="voidcode-hello__logo">
              <VoidLogo />
            </div>
            <div class="voidcode-hello__copy">
              <h1 class="voidcode-hello__greeting">{language.t("voidcode.hello.title")}</h1>
              <p class="voidcode-hello__subtitle">{language.t("voidcode.hello.subtitle")}</p>
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
              {language.t("voidcode.hello.start")}
            </button>
          </div>
        </Show>

        <Show when={!firstRun()}>
          <div class="voidcode-hello__splash" aria-live="polite">
            <Show
              when={!ready()}
              fallback={<p class="voidcode-hello__ready">{language.t("voidcode.hello.ready")}</p>}
            >
              <Show when={greeting()} keyed>
                {(text) => <p class="voidcode-hello__word">{text}</p>}
              </Show>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  )
}
