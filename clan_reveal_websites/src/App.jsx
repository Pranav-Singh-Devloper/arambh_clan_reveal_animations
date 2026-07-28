import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import ClanLayout from './pages/ClanLayout'
import RevealPage from './pages/RevealPage'
import OtherLeads from './pages/OtherLeads'
import NotFound from './pages/NotFound'

/* Routes carry an opaque code only - /r/3184 gives nothing away about which
   clan is behind it. See src/data/clans.js for the code table.

   /r/:code and /r/:code/other-leads are CHILDREN of one layout on purpose.
   The layout owns the AudioContext teardown and the reveal stage, so moving
   between the two routes neither cuts the music nor replays the 22-second
   build-up. Make them siblings and both regressions come straight back. */
export default function App() {
  return (
    // reducedMotion="user": framer drives values via rAF inline styles, which
    // the CSS prefers-reduced-motion kill-switch cannot touch
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          <Route path="/r/:code" element={<ClanLayout />}>
            <Route index element={<RevealPage />} />
            <Route path="other-leads" element={<OtherLeads />} />
          </Route>
          <Route path="/" element={<Navigate to="/404" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  )
}
