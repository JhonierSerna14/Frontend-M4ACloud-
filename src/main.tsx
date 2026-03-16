import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const MODULE_RELOAD_KEY = 'm4a:module-reload-attempted'

function isDynamicImportErrorMessage(message: string | undefined) {
  if (!message) return false
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed')
  )
}

function reloadForFreshBuild() {
  try {
    const alreadyRetried = sessionStorage.getItem(MODULE_RELOAD_KEY)
    if (alreadyRetried) return
    sessionStorage.setItem(MODULE_RELOAD_KEY, '1')
  } catch {
    // ignore
  }

  window.location.reload()
}

window.setTimeout(() => {
  try {
    sessionStorage.removeItem(MODULE_RELOAD_KEY)
  } catch {
    // ignore
  }
}, 5000)

window.addEventListener('error', (event) => {
  if (isDynamicImportErrorMessage(event.message)) {
    reloadForFreshBuild()
  }
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  const message = typeof reason === 'object' && reason && 'message' in reason
    ? String(reason.message)
    : typeof reason === 'string'
      ? reason
      : undefined

  if (isDynamicImportErrorMessage(message)) {
    reloadForFreshBuild()
  }
})

// Register service worker only in production builds.
// In Vite dev, /sw.js may not exist and returns HTML (MIME type error).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/', type: 'module' }).then((registration) => {
      void registration.update()
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
    }).catch(() => {
      // SW registration failed, app will still work
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
