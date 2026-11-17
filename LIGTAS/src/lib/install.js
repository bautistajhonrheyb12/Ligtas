import { useEffect, useState } from 'preact/hooks'

// Installing LIGTAS on a phone's home screen. Chrome and Edge (Android and
// computers) offer a one-tap install through the beforeinstallprompt event,
// which fires once, early, so this file is loaded before the app renders.
// iPhones have no such event: people use Safari's Share → Add to Home Screen.

let deferredPrompt = null
let justInstalled = false
const listeners = new Set()
const announce = () => listeners.forEach((listener) => listener())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep it for our own Install button instead of the browser's banner.
    event.preventDefault()
    deferredPrompt = event
    announce()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    justInstalled = true
    announce()
  })
}

export function isStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  } catch {
    return false
  }
}

export function isIos() {
  const agent = navigator.userAgent || ''
  // iPads report themselves as Macs; touch support gives them away.
  return /iphone|ipad|ipod/i.test(agent) || (/macintosh/i.test(agent) && navigator.maxTouchPoints > 1)
}

export function isAndroid() {
  return /android/i.test(navigator.userAgent || '')
}

// 'installed', 'prompt' (one-tap install), 'ios' or 'android' (steps to
// follow), or 'none' (a computer browser that cannot install it).
export function installMode() {
  if (justInstalled || isStandalone()) return 'installed'
  // Every browser on iPhone and iPad installs through Share → Add to Home Screen.
  if (isIos()) return 'ios'
  if (deferredPrompt) return 'prompt'
  if (isAndroid()) return 'android'
  return 'none'
}

// Shows the browser's install box. True when the person installed it.
export async function promptInstall() {
  const prompt = deferredPrompt
  if (!prompt) return false
  try {
    await prompt.prompt()
  } catch {
    // Refused (for example without a tap); the offer stays for the next try.
    return false
  }
  deferredPrompt = null
  const choice = await prompt.userChoice.catch(() => null)
  if (choice?.outcome === 'accepted') justInstalled = true
  announce()
  return choice?.outcome === 'accepted'
}

export function useInstallMode() {
  const [mode, setMode] = useState(installMode)
  useEffect(() => {
    const update = () => setMode(installMode())
    listeners.add(update)
    update()
    return () => listeners.delete(update)
  }, [])
  return mode
}
