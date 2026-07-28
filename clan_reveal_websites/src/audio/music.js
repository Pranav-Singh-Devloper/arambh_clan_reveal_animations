import * as A from './engine'
import TRACK from './Lush Life x Unforgettable (Altego Tiktok Remix Mashup) Zara Larsson x French Montana.mp3'

/* ===========================================================================
   The music bed.

   Deliberately simple: the track plays all the way through, ends, and starts
   again from the top. No crossfading between laps, no beat-matching.

   An earlier version overlapped laps with a beat-aligned equal-power
   crossfade. It measured well - the seam was statistically indistinguishable
   from ordinary music - but it did not SOUND smooth, because two parts of the
   same song playing over each other read as a blur rather than as a loop.
   Letting the song simply finish is the better call, and it is the simpler
   code by a wide margin.

   The one piece of processing kept: the file ends with roughly two seconds of
   pure digital silence after the music has stopped, which would land as a dead
   gap once a lap. `loopEnd` sits just past the last audible sample, so the
   musical outro is heard in full and only the dead air is skipped.

   Routing: engine.musicIn() -> post-duck, pre-master. The gasp can never touch
   it, while the existing mute button and the output limiter both still apply.
   =========================================================================== */

const PEAK = 0.5 // the bed sits under the page, never on top of it

let buffer = null
let loading = null
let source = null
let bus = null
let stopped = false

async function load() {
  if (buffer) return buffer
  if (loading) return loading
  loading = (async () => {
    const ctx = A.context()
    if (!ctx) return null
    const res = await fetch(TRACK)
    if (!res.ok) throw new Error(`music ${res.status}`)
    buffer = await ctx.decodeAudioData(await res.arrayBuffer())
    return buffer
  })()
  return loading
}

/** Last audible sample, so the trailing digital silence is never looped. */
function musicEnd(buf) {
  const d = buf.getChannelData(0)
  const thresh = 0.0015 // ~ -56 dBFS: under the outro fade, over the noise floor
  for (let i = d.length - 1; i > 0; i--) {
    if (Math.abs(d[i]) > thresh) {
      return Math.min(buf.duration, i / buf.sampleRate + 0.25) // let it ring out
    }
  }
  return buf.duration
}

/**
 * Fetch and decode the track WITHOUT starting it.
 *
 * The file is ~890 KB and used to be requested at the moment it was needed -
 * the same instant the crest, the confetti and the hero all arrive. The
 * build-up in front of it is 22 seconds of complete network idle, so calling
 * this the moment the visitor presses Begin buys the whole runway: by the time
 * the impact lands the buffer is decoded and startMusic() only has to schedule
 * it. On a phone on campus wifi that is the difference between the bed rising
 * under the ovation as designed and arriving several seconds after it.
 *
 * Safe to call more than once - load() memoises both the buffer and the
 * in-flight promise - and safe to ignore if it fails, because startMusic()
 * retries and a missing bed never breaks the reveal.
 */
export function preloadMusic() {
  load().catch((err) => console.warn('[music] preload failed, will retry:', err.message))
}

/**
 * Start the bed.
 * @param delay seconds from now until the fade begins
 * @param fade  entrance length. It should still be rising while the ovation and
 *              the reveal chord decay, so the handover is an overlap, never a
 *              gap of silence.
 */
export async function startMusic({ delay = 4.5, fade = 4 } = {}) {
  const ctx = A.context()
  if (!ctx || source) return
  stopped = false
  try {
    const buf = await load()
    if (!buf || stopped) return

    bus = A.musicIn()
    if (!bus) return

    source = ctx.createBufferSource()
    source.buffer = buf
    source.loop = true
    source.loopStart = 0
    source.loopEnd = musicEnd(buf)
    source.connect(bus)

    // re-anchor to the clock now that decoding, which takes a moment, is done
    const at = ctx.currentTime + Math.max(0.05, delay)
    bus.gain.setValueAtTime(0.0001, at)
    bus.gain.exponentialRampToValueAtTime(PEAK, at + fade)
    source.start(at)
  } catch (err) {
    // A missing or undecodable file must never break the reveal - the page
    // simply stays on its procedural tail.
    console.warn('[music] not playing:', err.message)
    source = null
    bus = null
  }
}

export function stopMusic({ fade = 1.2 } = {}) {
  stopped = true
  const ctx = A.context()
  if (!ctx || !source || !bus) return
  const t = ctx.currentTime
  bus.gain.cancelScheduledValues(t)
  bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), t)
  bus.gain.exponentialRampToValueAtTime(0.0001, t + fade)
  try { source.stop(t + fade + 0.05) } catch { /* already stopped */ }
  source = null
  bus = null
}

export const isPlaying = () => !!source
/** Exposed for the loop test in audiotest.html. */
export const _musicEnd = musicEnd
