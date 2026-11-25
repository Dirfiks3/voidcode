import { createContext, createEffect, createSignal, useContext, type ParentProps } from "solid-js"
import { createStore, produce } from "solid-js/store"

export type VoidcodeAccent = "obsidian" | "antigravity" | "emerald" | "crimson"
export type VoidcodeSurface = "amoled" | "graphite"
export type VoidcodeDensity = "compact" | "standard"
export type VoidcodeGreetingLanguage = "en" | "ru" | "es" | "fr" | "ja"

export type VoidcodePreferences = {
  onboardingSeen: boolean
  username: string
  accent: VoidcodeAccent
  glassOpacity: number
  glassBlur: number
  surface: VoidcodeSurface
  density: VoidcodeDensity
  chatFontSize: number
  localOnly: boolean
  zeroTelemetry: boolean
  autoWipe: boolean
  blurSensitive: boolean
}

export const VOIDCODE_PREFERENCES_KEY = "voidcode.preferences.v1"

export const defaultVoidcodePreferences: VoidcodePreferences = {
  onboardingSeen: false,
  username: "",
  accent: "obsidian",
  glassOpacity: 70,
  glassBlur: 16,
  surface: "amoled",
  density: "standard",
  chatFontSize: 14,
  localOnly: false,
  zeroTelemetry: false,
  autoWipe: false,
  blurSensitive: false,
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function read(): VoidcodePreferences {
  if (typeof localStorage === "undefined") return { ...defaultVoidcodePreferences }
  try {
    const raw = localStorage.getItem(VOIDCODE_PREFERENCES_KEY)
    if (!raw) return { ...defaultVoidcodePreferences }
    const value = JSON.parse(raw) as Partial<VoidcodePreferences>
    return {
      onboardingSeen: value.onboardingSeen === true,
      username: typeof value.username === "string" ? value.username : "",
      accent:
        value.accent === "antigravity" || value.accent === "emerald" || value.accent === "crimson"
          ? value.accent
          : "obsidian",
      glassOpacity: clamp(value.glassOpacity, 0, 100, defaultVoidcodePreferences.glassOpacity),
      glassBlur: clamp(value.glassBlur, 0, 32, defaultVoidcodePreferences.glassBlur),
      surface: value.surface === "graphite" ? "graphite" : "amoled",
      density: value.density === "compact" ? "compact" : "standard",
      chatFontSize: clamp(value.chatFontSize, 11, 22, defaultVoidcodePreferences.chatFontSize),
      localOnly: value.localOnly === true,
      zeroTelemetry: value.zeroTelemetry === true,
      autoWipe: value.autoWipe === true,
      blurSensitive: value.blurSensitive === true,
    }
  } catch {
    return { ...defaultVoidcodePreferences }
  }
}

/** Synchronous read for module init paths that run before the provider mounts. */
export function readVoidcodePreferences(): VoidcodePreferences {
  return read()
}

/** Clear every local app record except the preference key itself. */
export function clearVoidcodeLocalData() {
  if (typeof localStorage !== "undefined") {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index)
      if (key && key !== VOIDCODE_PREFERENCES_KEY) localStorage.removeItem(key)
    }
  }
  if (typeof sessionStorage !== "undefined") sessionStorage.clear()

  if (typeof document !== "undefined") {
    for (const entry of document.cookie.split(";")) {
      const name = entry.split("=")[0]?.trim()
      if (name) document.cookie = name + "=; Max-Age=0; path=/"
    }
  }

  if (typeof window === "undefined") return

  if (window.caches) {
    void window.caches
      .keys()
      .then((keys) => Promise.allSettled(keys.map((key) => window.caches.delete(key))))
  }

  if (navigator.serviceWorker) {
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.allSettled(registrations.map((registration) => registration.unregister())))
  }

  const factory = indexedDB as IDBFactory & { databases?: () => Promise<Array<{ name?: string }>> }
  if (factory.databases) {
    void factory
      .databases()
      .then((databases) =>
        Promise.allSettled(
          databases.filter((database) => !!database.name).map((database) => indexedDB.deleteDatabase(database.name!)),
        ),
      )
  }
}

const accents: Record<VoidcodeAccent, { a: string; b: string; solid: string }> = {
  obsidian: { a: "#e8edf5", b: "#98a4b5", solid: "#c2cad9" },
  antigravity: { a: "#4da6ff", b: "#9b72cb", solid: "#7790eb" },
  emerald: { a: "#49e3a8", b: "#1f9c7a", solid: "#38c896" },
  crimson: { a: "#ff6b7d", b: "#a12b4c", solid: "#d24b64" },
}

function applyRoot(state: VoidcodePreferences) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  const accent = accents[state.accent]
  const opacity = state.glassOpacity / 100

  root.dataset.voidcodeAccent = state.accent
  root.dataset.voidcodeSurface = state.surface
  root.dataset.voidcodeDensity = state.density
  root.dataset.voidcodeBlur = String(state.blurSensitive)
  root.dataset.voidcodeLocalOnly = String(state.localOnly)

  root.style.setProperty("--voidcode-void", state.surface === "amoled" ? "#000000" : "#0a0c10")
  root.style.setProperty("--voidcode-panel", state.surface === "amoled" ? "#030305" : "#11141c")
  root.style.setProperty("--voidcode-card", state.surface === "amoled" ? "#08090c" : "#181c26")
  root.style.setProperty("--voidcode-accent-a", accent.a)
  root.style.setProperty("--voidcode-accent-b", accent.b)
  root.style.setProperty("--voidcode-gradient", `linear-gradient(135deg, ${accent.a} 0%, ${accent.b} 100%)`)
  root.style.setProperty("--voidcode-gradient-solid", accent.solid)
  root.style.setProperty("--voidcode-glass-alpha", String(opacity * 0.06))
  root.style.setProperty("--voidcode-blur", `blur(${state.glassBlur}px)`)
  root.style.setProperty("--voidcode-chat-size", `${state.chatFontSize}px`)
}

export type VoidcodePreferencesApi = {
  state: VoidcodePreferences
  helloOpen: () => boolean
  openHello(): void
  closeHello(): void
  patch(next: Partial<VoidcodePreferences>): void
  reset(): void
  clearLocalData(): void
}

const VoidcodeContext = createContext<VoidcodePreferencesApi>()

export function VoidcodeProvider(props: ParentProps) {
  const [state, setState] = createStore<VoidcodePreferences>(read())
  const [helloOpen, setHelloOpen] = createSignal(false)

  createEffect(() => {
    // Read through the store proxy so every preference is a tracked dependency.
    const snapshot: VoidcodePreferences = {
      onboardingSeen: state.onboardingSeen,
      username: state.username,
      accent: state.accent,
      glassOpacity: state.glassOpacity,
      glassBlur: state.glassBlur,
      surface: state.surface,
      density: state.density,
      chatFontSize: state.chatFontSize,
      localOnly: state.localOnly,
      zeroTelemetry: state.zeroTelemetry,
      autoWipe: state.autoWipe,
      blurSensitive: state.blurSensitive,
    }
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(VOIDCODE_PREFERENCES_KEY, JSON.stringify(snapshot))
      } catch {
        // Storage can be unavailable in private windows; preferences still work for this session.
      }
    }
    applyRoot(snapshot)
  })

  const api: VoidcodePreferencesApi = {
    state,
    helloOpen,
    openHello() {
      setHelloOpen(true)
    },
    closeHello() {
      setHelloOpen(false)
    },
    patch(next) {
      setState(
        produce((draft) => {
          Object.assign(draft, next)
        }),
      )
    },
    reset() {
      setState(
        produce((draft) => {
          Object.assign(draft, defaultVoidcodePreferences)
        }),
      )
    },
    clearLocalData() {
      clearVoidcodeLocalData()
    },
  }

  return <VoidcodeContext.Provider value={api}>{props.children}</VoidcodeContext.Provider>
}

export function useVoidcode() {
  const api = useContext(VoidcodeContext)
  if (!api) throw new Error("VoidcodeProvider is missing")
  return api
}
