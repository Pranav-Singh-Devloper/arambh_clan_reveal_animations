import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useMatch, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

import { resolveCode, AUDIENCE_COPY } from '../data/clans'
import * as A from '../audio/engine'
import { fireCannons, sustainedShower } from '../lib/celebrate'
import { isPlaying, prefetchMusic, preloadMusic, startMusic, stopMusic } from '../audio/music'
import VolumeGate from '../components/VolumeGate'
import RevealSequence from '../components/RevealSequence'
import NotFound from './NotFound'

/* ===========================================================================
   Everything that must SURVIVE a route change lives here, and nothing else.

   /r/:code and /r/:code/other-leads are two routes over one clan, and the
   music has to run straight through the join without a seam. Both used to be
   impossible: the audio teardown

       useEffect(() => () => { stopMusic(); A.stopAll() }, [])

   sat inside the page component, so navigating anywhere unmounted the page,
   ran that cleanup and killed the bed. Moving it up to a layout that both
   routes render inside means the cleanup now fires only when the visitor
   leaves the clan entirely, which is exactly when it should.

   `stage` is up here for the same reason and one more: if the reveal state
   lived in the page, coming BACK from the other-leads route would remount at
   stage 'gate' and replay all 22 seconds of build-up. Nobody wants to sit
   through the reveal twice to get back to where they were.

   The AudioContext itself was always module-scoped in audio/engine.js, so it
   was never the thing at risk - only the code that deliberately tore it down.
   =========================================================================== */

export default function ClanLayout() {
  const { code } = useParams()
  // memoized: resolveCode returns a fresh object per call, and an unstable
  // clan identity cascades into handleImpact -> RevealSequence's scheduling
  // effect, which would RESTART the whole show on any re-render (e.g. mute)
  const clan = useMemo(() => resolveCode(code), [code])

  /* A shared link to /r/:code/other-leads should not make a visitor sit
     through a 22-second reveal for a clan they may not even be in. On that
     route the build-up is skipped outright. */
  const onOtherLeads = !!useMatch('/r/:code/other-leads')

  // gate -> buildup -> revealed
  const [stage, setStage] = useState(onOtherLeads ? 'revealed' : 'gate')
  const [muted, setMuted] = useState(false)
  /* React state, not a live isPlaying() read. The other-leads page shows a
     "turn the sound on" button when the bed is not running, and isPlaying() is
     a plain module getter with nothing to re-render on - so the button stayed
     on screen for the whole visit after being pressed, next to music it had
     already started. Anything the UI reacts to has to be state. */
  const [musicOn, setMusicOn] = useState(() => isPlaying())
  const [flashOn, setFlashOn] = useState(false)
  const celebrated = useRef(false)

  useEffect(() => {
    if (onOtherLeads) setStage((s) => (s === 'revealed' ? s : 'revealed'))
  }, [onOtherLeads])

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
  }, [clan])

  /* The tab title is the one place the clan escaped before the reveal. It was
     set the moment the code resolved, so the tab read "Chola | Rishihood
     Clans" while the visitor was still looking at the volume gate - the whole
     22-second build-up given away by a glance at the top of the window, and
     the opaque route codes made pointless. It now stays neutral until the
     clan is actually on screen.

     Note this cannot be airtight: the JS bundle necessarily contains all four
     clans and the code table, so anyone opening devtools can find their clan.
     What matters is that nobody is spoiled by ACCIDENT, and a tab title is
     about as accidental as it gets. */
  useEffect(() => {
    document.title = stage === 'revealed' && clan
      ? `${clan.name} | Rishihood Clans`
      : 'Your Clan Awaits | Rishihood University'
  }, [clan, stage])

  /* Start the download on page load, not on the Begin press. Fetching bytes
     needs no user gesture; only decoding does. This buys however long the
     visitor spends reading the gate and turning their volume up, which is free
     runway in front of the 22-second build-up - and it matters most for
     Maratha, whose bed is three times the size of the others. */
  useEffect(() => { if (clan) prefetchMusic(clan.music.src) }, [clan])

  // lock scrolling until the reveal has landed
  useEffect(() => {
    document.body.classList.toggle('locked', stage !== 'revealed')
    return () => document.body.classList.remove('locked')
  }, [stage])

  /* Fires only when the visitor leaves /r/:code altogether, NOT when moving
     between the clan page and the other-leads page. That distinction is the
     whole reason this component exists. */
  useEffect(() => () => {
    stopMusic({ fade: 0.4 })
    A.stopAll()
    /* The iOS audio-session override is process-global and WebKit never clears
       it on navigation, so leaving it on 'playback' would keep changing how
       audio behaves in other tabs long after the visitor has gone. */
    A.releaseAudioSession()
  }, [])

  const begin = useCallback(() => {
    A.unlock()
    /* Everything the payoff needs, fetched now rather than at the payoff.
       The build-up is 22 seconds during which the network does nothing at all,
       and both of these used to be requested at the exact frame they were
       needed: the crest is the image the whole sequence exists to deliver, and
       the bed is ~890 KB. Warming them here costs nothing and is the
       difference between a clean reveal and one that pops in late on a phone.
       decodeAudioData needs a context, so this has to follow unlock(). */
    preloadMusic(clan.music.src)
    new Image().src = clan.crest
    // honour reduced-motion by skipping straight past the build-up
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setStage('revealed')
      if (!celebrated.current) {
        celebrated.current = true
        fireCannons([clan.color, '#C7A75C', '#F3EAD9'], { soft: true })
        startMusic({ ...clan.music, delay: 1.2, fade: 3 })
        setMusicOn(true)
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
    /* The bed now starts rising at +2.0s, while the confetti shower (4.6s) and
       the ovation (5.9s) are both still going - roughly three seconds of
       genuine overlap rather than a handover. It was +4.5s, which technically
       overlapped the decaying tail but left an audible dip in the middle where
       the poppers had thinned out and the music had not yet arrived. */
    startMusic({ ...clan.music, delay: 2.0, fade: 3.5 })
    setMusicOn(true)
  }, [clan])

  const finish = useCallback(() => setStage('revealed'), [])

  const skip = useCallback(() => {
    A.stopAll()
    setStage('revealed')
    if (!celebrated.current) {
      celebrated.current = true
      fireCannons([clan.color, '#C7A75C', '#F3EAD9'])
      startMusic({ ...clan.music, delay: 0.8, fade: 2.5 })
      setMusicOn(true)
    }
  }, [clan])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      A.setMuted(!m)
      return !m
    })
  }, [])

  /* Someone arriving straight at /r/:code/other-leads has made no gesture, so
     no browser will let audio start. Hand them one button that unlocks and
     starts the bed, rather than a page that is silently broken. */
  const soundOn = useCallback(() => {
    A.unlock()
    celebrated.current = true
    startMusic({ ...clan.music, delay: 0.15, fade: 2.5 })
    setMusicOn(true)
  }, [clan])

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
        <Outlet context={{ clan, copy, muted, musicOn, soundOn, celebrated }} />
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
