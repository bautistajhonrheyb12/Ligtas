import { render } from 'preact'
import './index.css'
import { App } from './app.jsx'
// Loaded first so the browser's one-time install offer is caught.
import './lib/install.js'

render(<App />, document.getElementById('app'))

// Offline support only in production builds; in development it would cache stale code.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
