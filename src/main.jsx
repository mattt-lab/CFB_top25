import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './theme.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* BASE_URL is Vite's built-in env var reflecting vite.config.js's `base` -- "/" in dev,
        "/CFB_top25/" in production builds. Without this, React Router tries to match routes
        against the full deployed path (e.g. "/CFB_top25/playoff-watch") and finds nothing,
        rendering a blank page on GitHub Pages while working fine locally. */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
