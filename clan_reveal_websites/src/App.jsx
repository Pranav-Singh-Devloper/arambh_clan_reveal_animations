import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import RevealPage from './pages/RevealPage'
import NotFound from './pages/NotFound'

/* Routes carry an opaque code only - /r/3184 gives nothing away about which
   clan is behind it. See src/data/clans.js for the code table. */
export default function App() {
  return (
    // reducedMotion="user": framer drives values via rAF inline styles, which
    // the CSS prefers-reduced-motion kill-switch cannot touch
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          <Route path="/r/:code" element={<RevealPage />} />
          <Route path="/" element={<Navigate to="/404" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  )
}
