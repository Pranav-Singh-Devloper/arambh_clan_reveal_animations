import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { THEME } from './data/clans'
import './styles/global.css'

/* ?theme=light overrides the THEME constant, so the other look can be reviewed
   on the live site without a rebuild. */
const override = new URLSearchParams(window.location.search).get('theme')
const theme = override === 'light' || override === 'dark' ? override : THEME
document.documentElement.dataset.theme = theme
document.querySelector('meta[name="theme-color"]')
  ?.setAttribute('content', theme === 'light' ? '#FFF8F0' : '#0B0B0F')

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
