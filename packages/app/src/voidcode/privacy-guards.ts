import { dict as en } from "@/runtime/i18n/en"
import { dict as ru } from "@/runtime/i18n/ru"
import { clearVoidcodeLocalData, readVoidcodePreferences } from "./preferences"

const nativeFetch = typeof window === "undefined" ? undefined : window.fetch.bind(window)
const nativeXhrOpen = typeof XMLHttpRequest === "undefined" ? undefined : XMLHttpRequest.prototype.open
const nativeBeacon = typeof navigator === "undefined" ? undefined : navigator.sendBeacon?.bind(navigator)
let guardsInstalled = false

const telemetryHost = /(^|\.)(sentry|posthog|segment|amplitude|mixpanel|plausible|analytics|telemetry|google-analytics|doubleclick|newrelic|datadog|hotjar|fullstory)(\.|$)/i
const remoteMedia = 'img[src], img[srcset], source[src], source[srcset], iframe[src], video[src], audio[src], track[src], image[href], use[href], link[rel="icon"][href]'

function blockedMessage() {
  const key = "voidcode.privacy.error.blocked" as const
  const entry = document.cookie.split("; ").find((part) => part.startsWith("oc_locale="))
  const locale = entry ? decodeURIComponent(entry.slice("oc_locale=".length)) : ""
  return locale === "ru" ? ru[key] : en[key]
}

function isLocal(value: string) {
  if (/^(data|blob|about|chrome-extension):/.test(value)) return true
  if (value.startsWith("/") || value.startsWith("./") || value.startsWith("../") || value.startsWith("#")) return true
  try {
    const url = new URL(value, window.location.href)
    if (url.origin === window.location.origin) return true
    return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname)
  } catch {
    return false
  }
}

function blocked(value: string) {
  const preferences = readVoidcodePreferences()
  if (preferences.localOnly && !isLocal(value)) return true
  if (preferences.zeroTelemetry) {
    try {
      if (telemetryHost.test(new URL(value, window.location.href).hostname)) return true
    } catch {
      // Unparseable values already failed the local-only check; there is no host to match here.
    }
  }
  return false
}

function stripElement(element: Element) {
  for (const attribute of ["src", "href"]) {
    const value = element.getAttribute(attribute)
    if (value && blocked(value)) element.removeAttribute(attribute)
  }

  const srcset = element.getAttribute("srcset")
  if (srcset && srcset.split(",").some((part) => blocked(part.trim().split(/\s+/)[0] ?? "")))
    element.removeAttribute("srcset")

  const style = element.getAttribute("style")
  if (style) {
    for (const match of style.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi)) {
      if (blocked(match[2] ?? "")) {
        element.removeAttribute("style")
        break
      }
    }
  }
}

function stripRemoteMedia(root: ParentNode) {
  if (root instanceof Element) stripElement(root)
  for (const element of root.querySelectorAll(remoteMedia)) stripElement(element)
  for (const element of root.querySelectorAll("[style]")) stripElement(element)
}

/** Local-only and Zero-Telemetry: refuse external frontend traffic at its browser boundaries. */
export function installPrivacyGuards() {
  if (guardsInstalled || typeof window === "undefined" || !nativeFetch) return
  guardsInstalled = true

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const value =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : undefined
    if (value && blocked(value)) return Promise.reject(new Error(blockedMessage()))
    return nativeFetch(input, init)
  }) as typeof fetch

  if (nativeXhrOpen) {
    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ) {
      if (blocked(String(url))) throw new Error(blockedMessage())
      return nativeXhrOpen.call(this, method, url, async ?? true, username ?? null, password ?? null)
    }
  }

  if (nativeBeacon) {
    navigator.sendBeacon = ((url: string | URL, data?: BodyInit | null) => {
      if (blocked(String(url))) return false
      return nativeBeacon(url, data)
    }) as typeof navigator.sendBeacon
  }

  const nativeEventSource = window.EventSource
  if (nativeEventSource) {
    window.EventSource = class extends nativeEventSource {
      constructor(url: string | URL, init?: EventSourceInit) {
        if (blocked(String(url))) throw new Error(blockedMessage())
        super(url, init)
      }
    }
  }

  const nativeWebSocket = window.WebSocket
  if (nativeWebSocket) {
    window.WebSocket = class extends nativeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        if (blocked(String(url))) throw new Error(blockedMessage())
        super(url, protocols)
      }
    }
  }

  stripRemoteMedia(document)
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) stripRemoteMedia(node)
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true })

  window.addEventListener("pagehide", () => {
    if (readVoidcodePreferences().autoWipe) clearVoidcodeLocalData()
  })
}
