import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as A from '../audio/engine'
import Stage from './Stage'

/* ===========================================================================
   Beat sheet, in seconds from the moment BEGIN is pressed. Audio is scheduled
   on the AudioContext clock and visuals on setTimeout from the same t0.

   Tension curve: wonder -> weight -> dread -> acceleration -> THE CUT
   (1.55s of near-silence - the gasp) -> release. The countdown is
   deliberately metronomic (1.2 / 1.2); then the meter breaks by RUPTURE:
   the world dies at +0.75 instead of delivering the expected next beat.
   =========================================================================== */
const T = {
  four: 0.8,      // one breath of pure dark first
  one: 2.8,
  stage: 4.8,     // the house assembles (element order lives in Stage.jsx)
  foot: 6.0,      // nine footlights, L->R across the stereo field
  spots: 8.3,     // follow-spots sweep
  allotted: 9.2,  // gong + the announcement
  allottedOut: 11.8,
  hush: 11.4,     // the room goes quiet BEFORE the oboe gives the A
  tuning: 11.9,
  tap: 13.4,      // three baton taps cut through the tuning tail
  breath: 14.4,   // rolls begin - and END at the cut, not the impact
  riser: 15.6,    // Shepard riser - yanked away at the cut
  c3: 16.4,
  c2: 17.6,
  c1: 18.8,
  cut: 19.55,     // THE GASP - everything dies; two heartbeats own the dark
  curtain: 21.1,
  impact: 22.3,
  done: 22.5,     // swap to the hero UNDER the flash (which lives in RevealPage)
}

const FOOTLIGHTS = 9
const FOOT_GAP = 0.23

const DESKTOP =
  typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches

/* words-per-card with per-card stagger */
const CARDS = {
  four: { words: ['FOUR', 'CLANS'], stagger: 0.14 },
  one: { words: ['ONE', 'RISHIHOOD'], stagger: 0.14 },
  allotted: { words: ['YOUR', 'CLAN', 'HAS', 'BEEN', 'ALLOTTED'], stagger: 0.09 },
  breath: { words: ['HOLD', 'YOUR', 'BREATH'], stagger: 0.07 },
}

const EASE_OUT = [0.22, 1, 0.36, 1]
const EXIT_IN = [0.55, 0, 1, 0.45]

function TitleCard({ id }) {
  const { words, stagger } = CARDS[id]
  return (
    <motion.h2
      className="buildup-word"
      aria-label={words.join(' ')}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: stagger } } }}
      // HOLD YOUR BREATH: the words slowly pull apart under tension
      {...(id === 'breath' && DESKTOP
        ? {
            style: { letterSpacing: '0.008em' },
            animate: ['show', 'stretch'],
            variants: {
              show: { transition: { staggerChildren: stagger } },
              stretch: { letterSpacing: '0.06em', transition: { duration: 2.2, ease: 'linear' } },
            },
          }
        : {})}
    >
      {words.map((w, i) => (
        <motion.span
          key={i}
          className="buildup-w"
          aria-hidden="true"
          variants={{
            hidden: { opacity: 0, y: '0.45em', ...(DESKTOP ? { filter: 'blur(12px)' } : {}) },
            show: {
              opacity: 1, y: 0, ...(DESKTOP ? { filter: 'blur(0px)' } : {}),
              transition: { duration: 1.1, ease: EASE_OUT },
            },
          }}
        >
          {w}
        </motion.span>
      ))}
    </motion.h2>
  )
}

export default function RevealSequence({ onImpact, onComplete }) {
  const [phase, setPhase] = useState('none') // T.four opens the first card
  const [showStage, setShowStage] = useState(false)
  const [lit, setLit] = useState(0)
  const [gasp, setGasp] = useState(false)
  const [curtainOpen, setCurtainOpen] = useState(false)
  const timers = useRef([])

  // Latest callbacks in refs so the scheduling effect can be mount-once.
  // With [onImpact, onComplete] deps, ANY parent re-render with a fresh
  // callback identity re-ran the effect: cleanup clears only the setTimeouts,
  // never the Web Audio events already on the context clock - so the whole
  // soundtrack got scheduled a second time on top of the first.
  const onImpactRef = useRef(onImpact)
  const onCompleteRef = useRef(onComplete)
  onImpactRef.current = onImpact
  onCompleteRef.current = onComplete

  // StrictMode guard: dev double-invokes the effect on the same instance;
  // timers are cleaned up and re-armed, but scheduled audio cannot be, so
  // audio must only ever be scheduled once per component instance.
  const audioScheduled = useRef(false)

  useEffect(() => {
    timers.current = []
    const at = (s, fn) => timers.current.push(setTimeout(fn, s * 1000))

    /* Audio rides ctx.currentTime; visuals ride setTimeout. On mobile,
       unlock()'s resume() is still pending when this effect first runs, so the
       audio clock is frozen while wall-clock timers are already counting -
       the visitor watches a silent film until resume lands. Hold both until
       the context is actually running, then take one shared t0. */
    const cancelWait = A.whenRunning(() => {
      const t0 = A.now()

      if (!audioScheduled.current) {
        audioScheduled.current = true

        /* ---------------- audio, scheduled up front ---------------- */
        A.whoosh(t0)
        A.drone(t0, T.cut)                       // the drone dies AT the cut
        const murmur = A.crowdMurmur(t0 + 0.2, T.tap - 0.2)

        A.curtainRumble(t0 + T.stage, 1.9)
        for (let i = 0; i < FOOTLIGHTS; i++) {
          A.lightClunk(t0 + T.foot + i * FOOT_GAP, -0.8 + i * 0.2) // L -> R
        }
        A.whoosh(t0 + T.spots, 1.2, -0.7, 0.7)   // the spot crosses the stage

        A.gong(t0 + T.allotted)
        A.hush(murmur, t0 + T.hush, 1.6)
        A.orchestraTuning(t0 + T.tuning, 2.3)
        A.conductorTap(t0 + T.tap, 3, 0.34)

        A.drumroll(t0 + T.breath, T.cut - T.breath)
        A.timpaniRoll(t0 + T.breath, T.cut - T.breath)
        A.riser(t0 + T.riser, T.cut - T.riser)
        A.countHit(t0 + T.c3, 0)
        A.countHit(t0 + T.c2, 1)
        A.countHit(t0 + T.c1, 2)

        // THE CUT: program bus dies in 100ms; snaps back 30ms before the impact.
        A.gaspDuck(t0 + T.cut, t0 + T.impact)
        A.heartbeat(t0 + T.cut + 0.35, 2, 0.75)  // dry, direct - survives the duck
        A.tremorRustle(t0 + T.curtain - 0.4)     // a hand already on the velvet
        A.inhale(t0 + T.curtain - 0.35)          // the room breathes in

        A.curtainRumble(t0 + T.curtain, 2.4)
        A.curtainRustle(t0 + T.curtain, 2.2)
        A.revealSwell(t0 + T.curtain, T.impact - T.curtain)

        A.bigImpact(t0 + T.impact)
        A.orchestralReveal(t0 + T.impact + 0.02)
        A.ovation(t0 + T.impact + 0.5, 5.5)
      }

      /* ---------------- visuals ---------------- */
      at(T.four, () => setPhase('four'))
      at(T.one, () => setPhase('one'))
      at(T.stage - 0.55, () => setPhase('none')) // title fully out BEFORE the house assembles
      at(T.stage, () => setShowStage(true))
      for (let i = 0; i < FOOTLIGHTS; i++) {
        at(T.foot + i * FOOT_GAP, () => setLit(i + 1))
      }
      at(T.allotted + 0.12, () => setPhase('allotted'))  // the text rides the gong's bloom
      at(T.allottedOut, () => setPhase('none'))
      at(T.breath, () => setPhase('breath'))
      at(T.c3, () => setPhase('c3'))
      at(T.c2, () => setPhase('c2'))
      at(T.c1, () => setPhase('c1'))
      at(T.cut, () => { setPhase('blank'); setGasp(true) })
      at(T.curtain, () => setCurtainOpen(true))
      at(T.impact - 0.06, () => onImpactRef.current())
      at(T.done, () => onCompleteRef.current())
    })

    return () => {
      cancelWait()
      timers.current.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isCount = phase === 'c3' || phase === 'c2' || phase === 'c1'
  const countLabel = { c3: '3', c2: '2', c1: '1' }[phase]

  // per-hit decaying impulse, amplitude growing 3 -> 1; zero during the gasp
  const amp = { c3: 0.6, c2: 0.8, c1: 1.0 }[phase] || 0
  const shakeAnim = amp
    ? {
        x: [0, -10 * amp, 8 * amp, -5 * amp, 3 * amp, 0],
        y: [0, 6 * amp, -5 * amp, 3 * amp, -2 * amp, 0],
        rotate: [0, -0.4 * amp, 0.3 * amp, -0.15 * amp, 0.08 * amp, 0],
      }
    : { x: 0, y: 0, rotate: 0 }

  const tremorClass =
    gasp ? '' : phase === 'breath' || phase === 'c3' ? ' tremor-lo' : isCount ? ' tremor-hi' : ''

  // the room visibly ratchets with the roll
  const vignette =
    gasp ? 0.85 : { breath: 0.2, c3: 0.35, c2: 0.5, c1: 0.65 }[phase] || 0

  return (
    <>
      <motion.div
        className={`stage buildup${showStage ? ' has-theatre' : ''}${gasp ? ' is-frozen' : ''}`}
        animate={shakeAnim}
        transition={
          amp
            ? { duration: 0.55, times: [0, 0.14, 0.32, 0.52, 0.76, 1], ease: 'easeOut' }
            : { duration: 0.08, ease: 'linear' } // gasp: freeze instantly
        }
      >
        <div className={`buildup-inner${tremorClass}`}>
          {showStage && (
            <Stage
              lit={lit}
              frantic={isCount || phase === 'breath'}
              gasp={gasp}
              curtainOpen={curtainOpen}
            />
          )}

          {/* rotating light rays behind the countdown */}
          <AnimatePresence>
            {(phase === 'breath' || isCount) && (
              <motion.div
                className="rays"
                initial={{ opacity: 0, rotate: 0 }}
                animate={{
                  opacity: { breath: 0.4, c3: 0.55, c2: 0.7, c1: 0.85 }[phase],
                  rotate: 360,
                }}
                exit={{ opacity: 0, transition: { duration: 0.3 } }}
                transition={{
                  opacity: { duration: 0.15, ease: 'easeOut' },
                  rotate: { duration: isCount ? 14 : 30, repeat: Infinity, ease: 'linear' },
                }}
              />
            )}
          </AnimatePresence>

          {/* the darkness closing in as the roll accelerates */}
          <motion.div
            className="vignette"
            initial={false}
            animate={
              curtainOpen
                ? { opacity: 0, transition: { duration: 0.5 } }
                : gasp
                  ? { opacity: 0.85, scale: 1, transition: { duration: 0.4, ease: [0.55, 0, 0.3, 1] } }
                  : { opacity: vignette, scale: 1.25, transition: { duration: 0.15, ease: 'easeOut' } }
            }
          />

          {/* No mode="wait": with ~1.2s between numbers, a blocking exit would
              swallow the next number entirely. */}
          <AnimatePresence>
            {(CARDS[phase] || isCount) && (
              isCount ? (
                <motion.div
                  key={phase}
                  className="buildup-slot"
                  initial={{ opacity: 0, scale: 2.8 }}
                  animate={{ opacity: 1, scale: [2.8, 0.94, 1.015, 1] }}
                  exit={{
                    opacity: 0, scale: 1.08,
                    transition: { duration: 0.22, ease: EXIT_IN },
                  }}
                  transition={{
                    opacity: { duration: 0.16, ease: 'linear' },
                    scale: { duration: 0.55, times: [0, 0.55, 0.8, 1], ease: [0.19, 1, 0.22, 1] },
                  }}
                >
                  <div className="count-number">{countLabel}</div>
                </motion.div>
              ) : (
                <motion.div
                  key={phase}
                  className="buildup-slot"
                  exit={{
                    opacity: 0, y: '-0.35em', scale: 1.02,
                    transition: { duration: 0.5, ease: EXIT_IN },
                  }}
                >
                  <TitleCard id={phase} />
                </motion.div>
              )
            )}
          </AnimatePresence>

          {/* shockwave + warm light pop, re-fired per hit */}
          {isCount && (
            <div className="ring-anchor" key={phase + 'r'}>
              <motion.div
                className="shockring"
                initial={{ scale: 0.3, opacity: 0.85 }}
                animate={{ scale: 2.6, opacity: 0 }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              />
              <motion.div
                className="shockring thin"
                initial={{ scale: 0.3, opacity: 0.6 }}
                animate={{ scale: 3.3, opacity: 0 }}
                transition={{ delay: 0.08, duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
              />
              <motion.div
                className="light-pop"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.18, 0] }}
                transition={{ duration: 0.35, times: [0, 0.25, 1] }}
              />
            </div>
          )}
        </div>
      </motion.div>

    </>
  )
}
