import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom'
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
/* React Router does not reset scroll on navigation, and the link to the
   other-leads page sits at the very BOTTOM of the clan page - so following it
   dropped the visitor two thirds of the way down the new page, on a card,
   with the heading already scrolled past.

   Only on PUSH. A browser Back or Forward should keep the position the visitor
   left, which is what everyone expects and what the browser would do on its
   own; resetting there would be the more annoying bug. React Router v7 ships
   <ScrollRestoration> for exactly this, but it requires a data router
   (createBrowserRouter), and this app uses BrowserRouter - so it is the same
   logic done by hand. */
function ScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  useEffect(() => {
    if (navigationType === 'POP') return
    window.scrollTo(0, 0)
  }, [pathname, navigationType])
  return null
}

export default function App() {
  return (
    // reducedMotion="user": framer drives values via rAF inline styles, which
    // the CSS prefers-reduced-motion kill-switch cannot touch
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ScrollToTop />
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
