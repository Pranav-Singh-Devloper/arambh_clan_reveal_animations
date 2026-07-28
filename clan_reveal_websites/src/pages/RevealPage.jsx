import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

const QUINT_OUT = [0.22, 1, 0.36, 1]


import { resolveCode, AUDIENCE_COPY } from '../data/clans'
import * as A from '../audio/engine'
import { fireCannons, sustainedShower } from '../lib/celebrate'
import { preloadMusic, startMusic, stopMusic } from '../audio/music'
import VolumeGate from '../components/VolumeGate'
import RevealSequence from '../components/RevealSequence'
import ClanHero from '../components/ClanHero'
import Leaders from '../components/Leaders'
import Socials from '../components/Socials'
import NotFound from './NotFound'

import LOGO from '../assets/rishihood_logo.png'

export default function RevealPage() {
  const { code } = useParams()
  // memoized: resolveCode returns a fresh object per call, and an unstable
  // clan identity cascades into handleImpact -> RevealSequence's scheduling
  // effect, which would RESTART the whole show on any re-render (e.g. mute)
  const clan = useMemo(() => resolveCode(code), [code])

  // gate -> buildup -> revealed
  const [stage, setStage] = useState('gate')
  const [muted, setMuted] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const celebrated = useRef(false)

  // paint the whole page in the clan's colour once we know it
  useEffect(() => {
    if (!clan) return
    const r = document.documentElement.style
    r.setProperty('--clan', clan.color)
    r.setProperty('--clan-deep', clan.deep)
    r.setProperty('--clan-glow', clan.glow)
    // a faint tint of the same colour - the light theme washes with this,
    // because the deep shade would flood a light page with near-black colour
    const h = clan.color.replace('#', '')
    const [cr, cg, cb] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
    r.setProperty('--clan-soft', `rgba(${cr}, ${cg}, ${cb}, 0.11)`)
    document.title = `${clan.name} | Rishihood Clans`
  }, [clan])

  // lock scrolling until the reveal has landed
  useEffect(() => {
    document.body.classList.toggle('locked', stage !== 'revealed')
    return () => document.body.classList.remove('locked')
  }, [stage])

  useEffect(() => () => { stopMusic({ fade: 0.4 }); A.stopAll() }, [])

  const begin = useCallback(() => {
    A.unlock()
    /* Everything the payoff needs, fetched now rather than at the payoff.
       The build-up is 22 seconds during which the network does nothing at all,
       and both of these used to be requested at the exact frame they were
       needed: the crest is the image the whole sequence exists to deliver, and
       the bed is ~890 KB. Warming them here costs nothing and is the
       difference between a clean reveal and one that pops in late on a phone.
       decodeAudioData needs a context, so this has to follow unlock(). */
    preloadMusic()
    new Image().src = clan.crest
    // honour reduced-motion by skipping straight past the build-up
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setStage('revealed')
      if (!celebrated.current) {
        celebrated.current = true
        fireCannons([clan.color, '#C7A75C', '#F3EAD9'], { soft: true })
        startMusic({ delay: 1.2, fade: 3 })
      }
      return
    }
    setStage('buildup')
  }, [clan])

  const handleImpact = useCallback(() => {
    if (celebrated.current) return
    celebrated.current = true
    // the flash lives HERE, above the stage swap, so the buildup -> hero
    // handoff happens under the blaze instead of as a one-frame hard cut
    setFlashOn(true)
    const palette = [clan.color, '#C7A75C', '#F3EAD9', clan.color, '#8E1230']
    fireCannons(palette)
    sustainedShower(palette, 4600)
    // The bed starts rising at +4.5s and takes 4s to reach level, so it is
    // already coming up while the ovation (ends +5.9s) and the reveal chord
    // (decays to +8s) are still dying away. Nothing ever hands over in silence.
    startMusic({ delay: 4.5, fade: 4 })
  }, [clan])

  const finish = useCallback(() => setStage('revealed'), [])

  const skip = useCallback(() => {
    A.stopAll()
    setStage('revealed')
    if (!celebrated.current) {
      celebrated.current = true
      fireCannons([clan.color, '#C7A75C', '#F3EAD9'])
      startMusic({ delay: 0.8, fade: 2.5 })
    }
  }, [clan])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      A.setMuted(!m)
      return !m
    })
  }, [])

  if (!clan) return <NotFound />

  const copy = AUDIENCE_COPY[clan.audience]

  return (
    <div className="clan-page">
      <AnimatePresence mode="wait">
        {stage === 'gate' && <VolumeGate key="gate" onBegin={begin} />}
      </AnimatePresence>

      {stage === 'buildup' && (
        <RevealSequence onImpact={handleImpact} onComplete={finish} />
      )}

      {stage === 'revealed' && (
        <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <ClanHero clan={clan} copy={copy} />
          <Leaders clan={clan} copy={copy} />
          <Socials clan={clan} copy={copy} />

          <footer className="page-footer">
            {/* The war cry used to be repeated down here. It now lands once,
                in the hero, at the moment the clan is revealed - saying it
                twice on one page read as an accident rather than as a chant. */}
            <span className="footer-logo"><img src={LOGO} alt="Rishihood University" /></span>
            <small>Four Clans. One Rishihood. &copy; 2026 Rishihood University.</small>
          </footer>
        </motion.main>
      )}

      {stage !== 'gate' && (
        <button className="mute-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6.5 9H3v6h3.5L11 19Z" />
              <path d="m16.5 9.5 5 5m0-5-5 5" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6.5 9H3v6h3.5L11 19Z" />
              <path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
            </svg>
          )}
        </button>
      )}

      {stage === 'buildup' && (
        <button className="skip-btn" onClick={skip}>Skip</button>
      )}

      <AnimatePresence>
        {flashOn && (
          <motion.div
            className="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.5, 0] }}
            transition={{ duration: 1.3, times: [0, 0.05, 0.3, 1], ease: 'easeOut' }}
            onAnimationComplete={() => setFlashOn(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
