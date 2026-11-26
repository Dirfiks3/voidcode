#!/usr/bin/env bun
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

const root = path.resolve(import.meta.dir, "..")
const appDist = path.resolve(root, "../app/dist")
const out = path.resolve(root, "frontend")

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })
await cp(appDist, out, { recursive: true })

const shim = `<script>
(function () {
  var params = new URLSearchParams(location.search)
  var server = params.get("voidcode_server")
  if (server) {
    localStorage.setItem("opencode.global.dat:server", JSON.stringify({
      list: [{ type: "http", http: { url: server } }],
      hidden: {}, lastProjectID: {}, usedProjectIDs: {}, hostnames: {}, projects: {}
    }))
    var token = btoa("opencode:voidcode").replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "")
    params.set("auth_token", token)
    params.delete("voidcode_server")
    history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params.toString() : "") + location.hash)
  }

  var invoke = function (command, args) {
    return window.__TAURI_INTERNALS__.invoke(command, args || {})
  }
  window.__VOIDCODE_TAURI__ = true
  window.voidcodeNative = {
    invoke: invoke,
    minimize: function () { return invoke("window_minimize") },
    maximize: function () { return invoke("window_maximize") },
    close: function () { return invoke("window_close") },
    drag: function () { return invoke("window_start_drag") },
    setEffect: function (effect) { return invoke("set_window_effect", { effect: effect }) },
    username: function () { return invoke("get_system_username") },
    serverURL: function () { return invoke("server_url") }
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    var original = navigator.clipboard.writeText.bind(navigator.clipboard)
    navigator.clipboard.writeText = async function (text) {
      try { await invoke("plugin:clipboard-manager|write_text", { text: text }) }
      catch (_) { await original(text) }
    }
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "F12") {
      e.preventDefault()
      void invoke("window_toggle_devtools")
    }
  })

  var shown = false
  var show = function () {
    if (shown) return
    shown = true
    void invoke("window_show")
  }
  window.addEventListener("load", show)
  document.addEventListener("DOMContentLoaded", show)

  document.addEventListener("DOMContentLoaded", function () {
    var bar = document.createElement("div")
    bar.setAttribute("data-tauri-drag-region", "true")
    bar.style.cssText = "position:fixed;top:0;left:0;right:0;height:12px;z-index:99999;"
    document.body.appendChild(bar)

    var controls = document.createElement("div")
    controls.style.cssText = "position:fixed;top:0;right:0;z-index:100000;display:flex;gap:0;font:12px/1 system-ui;background:rgba(0,0,0,.72);border-radius:0 0 0 10px;overflow:hidden"
    ;[["—", "window_minimize"], ["□", "window_maximize"], ["×", "window_close"]].forEach(function (entry) {
      var button = document.createElement("button")
      button.type = "button"
      button.textContent = entry[0]
      button.setAttribute("aria-label", entry[1])
      button.style.cssText = "width:34px;height:28px;border:0;background:transparent;color:#c8cede;cursor:pointer"
      button.onclick = function () { void invoke(entry[1]) }
      controls.appendChild(button)
    })
    document.body.appendChild(controls)
  })
})();
</script>`

const index = path.join(out, "index.html")
const html = await readFile(index, "utf8")
await writeFile(index, html.replace("<head>", `<head>\n    ${shim}`))

const loading = `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="dark">
<style>
  html,body{height:100%;margin:0;background:#050508;color:#e6e8ee;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
  body{display:grid;place-items:center}
  .wrap{display:flex;flex-direction:column;align-items:center;gap:14px;opacity:.92}
  .dot{width:10px;height:10px;border-radius:50%;background:#8b93ff;box-shadow:0 0 24px rgba(139,147,255,.55);animation:p 1.2s ease-in-out infinite}
  .text{font-size:14px;letter-spacing:.01em;color:#c9ced8}
  @keyframes p{0%,100%{transform:scale(.7);opacity:.45}50%{transform:scale(1);opacity:1}}
</style></head>
<body><div class="wrap"><div class="dot"></div><div class="text">Запуск локального ядра VoidCode...</div></div></body></html>`
await writeFile(path.join(out, "loading.html"), loading)

console.log(`VoidCode frontend copied to ${out}`)
