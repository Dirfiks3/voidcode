import { createContext, createEffect, createSignal, useContext, type ParentProps } from "solid-js"
import { createStore, produce } from "solid-js/store"

export type VoidcodeAccent = "obsidian" | "antigravity" | "emerald" | "crimson"
export type VoidcodeSurface = "amoled" | "graphite"
export type VoidcodeDensity = "compact" | "standard"
export type VoidcodeGreetingLanguage = "en" | "ru" | "es" | "fr" | "ja"
export type VoidcodeLiquidPreset = "crystal" | "frosted" | "clear"
export type VoidcodeWallpaper = "none" | "amoled" | "singularity" | "mesh" | "custom"

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
  liquidGlass: boolean
  liquidPreset: VoidcodeLiquidPreset
  windowOpacity: number
  motionBlur: boolean
  wallpaper: VoidcodeWallpaper
  wallpaperImage: string
  wallpaperDim: number
  wallpaperBlur: number
  customCss: string
  customCssEnabled: boolean
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
  liquidGlass: true,
  liquidPreset: "crystal",
  windowOpacity: 100,
  motionBlur: false,
  wallpaper: "none",
  wallpaperImage: "",
  wallpaperDim: 45,
  wallpaperBlur: 0,
  customCss: "",
  customCssEnabled: false,
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback
}

function imageData(value: unknown) {
  return typeof value === "string" && /^data:image\/(png|jpeg|webp|gif);base64,[\da-z+/=]+$/i.test(value) ? value : ""
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
      accent: oneOf(value.accent, ["obsidian", "antigravity", "emerald", "crimson"], "obsidian"),
      glassOpacity: clamp(value.glassOpacity, 0, 100, defaultVoidcodePreferences.glassOpacity),
      glassBlur: clamp(value.glassBlur, 0, 32, defaultVoidcodePreferences.glassBlur),
      surface: value.surface === "graphite" ? "graphite" : "amoled",
      density: value.density === "compact" ? "compact" : "standard",
      chatFontSize: clamp(value.chatFontSize, 11, 22, defaultVoidcodePreferences.chatFontSize),
      localOnly: value.localOnly === true,
      zeroTelemetry: value.zeroTelemetry === true,
      autoWipe: value.autoWipe === true,
      blurSensitive: value.blurSensitive === true,
      liquidGlass: value.liquidGlass !== false,
      liquidPreset: oneOf(value.liquidPreset, ["crystal", "frosted", "clear"], "crystal"),
      windowOpacity: clamp(value.windowOpacity, 60, 100, defaultVoidcodePreferences.windowOpacity),
      motionBlur: value.motionBlur === true,
      wallpaper: oneOf(value.wallpaper, ["none", "amoled", "singularity", "mesh", "custom"], "none"),
      wallpaperImage: imageData(value.wallpaperImage),
      wallpaperDim: clamp(value.wallpaperDim, 0, 90, defaultVoidcodePreferences.wallpaperDim),
      wallpaperBlur: clamp(value.wallpaperBlur, 0, 32, defaultVoidcodePreferences.wallpaperBlur),
      customCss: typeof value.customCss === "string" ? value.customCss : "",
      customCssEnabled: value.customCssEnabled === true,
    }
  } catch {
    return { ...defaultVoidcodePreferences }
  }
}

/** Synchronous read for module init paths that run before the provider mounts. */
export function readVoidcodePreferences(): VoidcodePreferences {
  return read()
}

/** Clear every local app record except the preference key itself, stripping data the user chose to store there. */
export function clearVoidcodeLocalData() {
  if (typeof localStorage !== "undefined") {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index)
      if (key && key !== VOIDCODE_PREFERENCES_KEY) localStorage.removeItem(key)
    }

    try {
      const raw = localStorage.getItem(VOIDCODE_PREFERENCES_KEY)
      if (raw) {
        const value: unknown = JSON.parse(raw)
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          localStorage.setItem(
            VOIDCODE_PREFERENCES_KEY,
            JSON.stringify({
              ...value,
              wallpaper: "none",
              wallpaperImage: "",
              customCss: "",
              customCssEnabled: false,
            }),
          )
        }
      }
    } catch {
      // A malformed preference payload needs no second write; the next read falls back to defaults.
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

const wallpapers: Record<Exclude<VoidcodeWallpaper, "none" | "custom">, string> = {
  amoled: "linear-gradient(180deg, #000000 0%, #000000 100%)",
  singularity:
    "radial-gradient(circle at 50% 42%, #2b2440 0%, #0b0a12 34%, #000000 72%), linear-gradient(180deg, #05040a 0%, #000000 100%)",
  mesh:
    "linear-gradient(rgba(77,166,255,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(77,166,255,0.10) 1px, transparent 1px), radial-gradient(circle at 50% 40%, #12233b 0%, #05070d 60%, #000000 100%)",
}

const presets: Record<VoidcodeLiquidPreset, { filter: string; shadow: string; border: string }> = {
  crystal: {
    filter: "blur(36px) saturate(210%)",
    shadow: "inset 0 1px 1px rgba(255,255,255,0.26), inset 0 -1px 1px rgba(255,255,255,0.05), 0 20px 50px rgba(0,0,0,0.72)",
    border: "rgba(255,255,255,0.14)",
  },
  frosted: {
    filter: "blur(40px) saturate(170%)",
    shadow: "inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 1px rgba(255,255,255,0.05), 0 24px 60px rgba(0,0,0,0.78)",
    border: "rgba(255,255,255,0.12)",
  },
  clear: {
    filter: "blur(18px) saturate(230%)",
    shadow: "inset 0 1px 1px rgba(255,255,255,0.22), inset 0 -1px 1px rgba(255,255,255,0.07), 0 12px 32px rgba(0,0,0,0.48)",
    border: "rgba(255,255,255,0.18)",
  },
}

function wallpaperImage(state: VoidcodePreferences) {
  if (state.wallpaper === "custom") return state.wallpaperImage ? `url("${state.wallpaperImage}")` : wallpapers.singularity
  if (state.wallpaper === "none") return "none"
  return wallpapers[state.wallpaper]
}

function applyRoot(state: VoidcodePreferences) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  const accent = accents[state.accent]
  const opacity = state.glassOpacity / 100
  const preset = presets[state.liquidPreset]

  root.dataset.voidcodeAccent = state.accent
  root.dataset.voidcodeSurface = state.surface
  root.dataset.voidcodeDensity = state.density
  root.dataset.voidcodeBlur = String(state.blurSensitive)
  root.dataset.voidcodeLocalOnly = String(state.localOnly)
  root.dataset.voidcodeGlass = String(state.liquidGlass)
  root.dataset.voidcodeMotion = String(state.motionBlur)
  root.dataset.voidcodeAgentCapsules = String(state.motionBlur)
  root.dataset.voidcodeWallpaper = state.wallpaper
  root.dataset.voidcodePreset = state.liquidPreset

  const amoled = state.surface === "amoled"
  // Both surfaces stay on the Pure AMOLED ramp; graphite differs only in its raised cards and theme overrides.
  root.style.setProperty("--voidcode-void", "#000000")
  root.style.setProperty("--voidcode-panel", "#050507")
  root.style.setProperty("--voidcode-card", amoled ? "#08090c" : "#181c26")

  // Pure AMOLED is the theme's own ramp; let the active theme own those tokens. Graphite keeps its own inline steps.
  const baseTokens = {
    "--background-base": "#0a0c10",
    "--background-weak": "#11141c",
    "--background-strong": "#0a0c10",
    "--background-stronger": "#11141c",
    "--surface-base": "#11141c",
    "--surface-base-hover": "#181c26",
    "--surface-raised-base": "#181c26",
    "--surface-raised-base-hover": "#202635",
  }
  for (const [token, value] of Object.entries(baseTokens)) {
    if (amoled) root.style.removeProperty(token)
    else root.style.setProperty(token, value)
  }
  root.style.setProperty("--voidcode-accent-a", accent.a)
  root.style.setProperty("--voidcode-accent-b", accent.b)
  root.style.setProperty("--voidcode-gradient", `linear-gradient(135deg, ${accent.a} 0%, ${accent.b} 100%)`)
  root.style.setProperty("--voidcode-gradient-solid", accent.solid)
  root.style.setProperty("--voidcode-glass-alpha", String(opacity * 0.06))
  root.style.setProperty("--voidcode-blur", `blur(${state.glassBlur}px)`)
  root.style.setProperty("--voidcode-chat-size", `${state.chatFontSize}px`)
  root.style.setProperty("--voidcode-glass-filter", preset.filter)
  root.style.setProperty("--voidcode-glass-shadow", preset.shadow)
  root.style.setProperty("--voidcode-glass-border", preset.border)
  root.style.setProperty(
    "--voidcode-glass-transition",
    state.motionBlur ? "transform 420ms cubic-bezier(0.22, 1, 0.36, 1), backdrop-filter 420ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
  )
  root.style.setProperty("--voidcode-wallpaper-image", wallpaperImage(state))
  root.style.setProperty("--voidcode-wallpaper-dim", String(state.wallpaperDim / 100))
  root.style.setProperty("--voidcode-wallpaper-blur", `blur(${state.wallpaperBlur}px)`)
}

function applyCustomCss(state: VoidcodePreferences) {
  if (typeof document === "undefined") return
  let style = document.getElementById("voidcode-custom-css")
  if (!style) {
    style = document.createElement("style")
    style.id = "voidcode-custom-css"
    document.head.appendChild(style)
  }
  style.textContent = state.customCssEnabled ? state.customCss : ""
}

function applyWindowAppearance(state: VoidcodePreferences) {
  if (typeof window === "undefined") return
  const native = (window as unknown as {
    electron?: {
      setWindowAppearance?: (
        value: { enabled: boolean; preset: VoidcodeLiquidPreset; opacity: number },
      ) => void | Promise<void>
    }
  }).electron
  const setAppearance = native?.setWindowAppearance
  if (!setAppearance) return

  void Promise.resolve(
    setAppearance({ enabled: state.liquidGlass, preset: state.liquidPreset, opacity: state.windowOpacity }),
  ).catch(() => {})
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
      liquidGlass: state.liquidGlass,
      liquidPreset: state.liquidPreset,
      windowOpacity: state.windowOpacity,
      motionBlur: state.motionBlur,
      wallpaper: state.wallpaper,
      wallpaperImage: state.wallpaperImage,
      wallpaperDim: state.wallpaperDim,
      wallpaperBlur: state.wallpaperBlur,
      customCss: state.customCss,
      customCssEnabled: state.customCssEnabled,
    }
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(VOIDCODE_PREFERENCES_KEY, JSON.stringify(snapshot))
      } catch {
        // Storage can be unavailable in private windows; preferences still work for this session.
      }
    }
    applyRoot(snapshot)
    applyCustomCss(snapshot)
    applyWindowAppearance(snapshot)
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
      setState(
        produce((draft) => {
          draft.wallpaper = "none"
          draft.wallpaperImage = ""
          draft.customCss = ""
          draft.customCssEnabled = false
        }),
      )
    },
  }

  return <VoidcodeContext.Provider value={api}>{props.children}</VoidcodeContext.Provider>
}

export function useVoidcode() {
  const api = useContext(VoidcodeContext)
  if (!api) throw new Error("VoidcodeProvider is missing")
  return api
}
