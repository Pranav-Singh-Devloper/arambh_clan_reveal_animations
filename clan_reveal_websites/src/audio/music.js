import * as A from './engine'

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

   The one piece of processing kept: a file may end with a second or two of
   pure digital silence after the music has stopped, which would land as a dead
   gap once a lap. `loopEnd` sits just past the last audible sample, so the
   musical outro is heard in full and only the dead air is skipped.

   WHICH TRACK depends on the clan - see `music` in src/data/clans.js. Buffers
   are cached per URL, so switching clans in one session never re-downloads or
   re-decodes something already held.

   Routing: engine.musicIn() -> post-duck, pre-master. The gasp can never touch
   it, while the existing mute button and the output limiter both still apply.
   =========================================================================== */

const PEAK = 0.5 // the bed sits under the page, never on top of it

/* Cached per track URL. Two maps rather than one: the raw bytes can be fetched
   with no AudioContext and therefore with no user gesture, while decoding
   needs a context and so cannot happen until unlock(). Keeping them apart is
   what lets the download start on page load instead of on the Begin press. */
const bytes = new Map()    // url -> Promise<ArrayBuffer>, the pristine original
const buffers = new Map()  // url -> AudioBuffer, decoded and final
const decoding = new Map() // url -> Promise<AudioBuffer>, in flight right now

let source = null
let bus = null
let starting = false
let stopped = false
let current = null

function fetchBytes(url) {
  if (!bytes.has(url)) {
    bytes.set(url, fetch(url).then((res) => {
      if (!res.ok) throw new Error(`music ${res.status}`)
      return res.arrayBuffer()
    }))
  }
  return bytes.get(url)
}

/* decodeAudioData DETACHES the ArrayBuffer it is given. Both of the lines below
   exist because of that, and between them they were the cause of the bed
   playing only sometimes:

   1. `decoding` memoises the in-flight decode. Without it, a preload still
      decoding when the impact lands meant startMusic() called decodeAudioData
      a SECOND time on the same, now-detached buffer. It threw
      "Cannot decode detached ArrayBuffer", the catch swallowed it, and the
      page ran on in silence. It only ever happened when the download was slow
      enough to still be in flight at 22 seconds, which is exactly why it
      looked random: fast connection, always fine; slow phone, sometimes dead.

   2. `.slice(0)` hands the decoder its own copy so the cached original is
      never detached at all. That is what makes a failed decode RETRYABLE
      rather than permanently poisoning the cache entry. */
async function load(url) {
  if (buffers.has(url)) return buffers.get(url)
  if (decoding.has(url)) return decoding.get(url)
  const ctx = A.context()
  if (!ctx) return null
  const job = (async () => {
    const raw = await fetchBytes(url)
    const buf = await ctx.decodeAudioData(raw.slice(0))
    buffers.set(url, buf)
    return buf
  })()
  decoding.set(url, job)
  try {
    return await job
  } catch (err) {
    // drop BOTH caches so the next attempt starts clean rather than replaying
    // a rejected promise for the rest of the visit
    bytes.delete(url)
    throw err
  } finally {
    decoding.delete(url)
  }
}

/** Last audible sample, so trailing digital silence is never looped. */
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
 * Start the DOWNLOAD only, as early as possible.
 *
 * Deliberately does not touch the AudioContext, because fetching bytes needs no
 * user gesture and decoding does. Calling this on page load rather than on the
 * Begin press buys however long the visitor spends reading the gate and turning
 * their volume up - free runway, before the 22-second build-up has even begun.
 *
 * That matters most for the longest track: Maratha's bed is 2.8 MB against
 * Lush Life's 0.9 MB, so it is the one with the least margin on a slow phone.
 */
export function prefetchMusic(url) {
  if (!url) return
  fetchBytes(url).catch(() => { bytes.delete(url) }) // let a failure be retried
}

/**
 * Fetch and decode WITHOUT starting playback.
 *
 * Called on the Begin press, once unlock() has given us a context. By the time
 * the impact lands the buffer is decoded and startMusic() only has to schedule
 * it, rather than downloading nearly three megabytes at the exact moment the
 * crest, the confetti and the hero all arrive.
 *
 * Safe to call repeatedly, and safe to ignore if it fails: startMusic() retries
 * and a missing bed never breaks the reveal.
 */
export function preloadMusic(url) {
  if (!url) return
  load(url).catch((err) => console.warn('[music] preload failed, will retry:', err.message))
}

/**
 * Start the bed.
 * @param src    URL of the mp3 for this clan
 * @param delay  seconds from now until the fade begins
 * @param fade   entrance length. It should still be rising while the ovation and
 *               the reveal chord decay, so the handover is an overlap, never a
 *               gap of silence.
 * @param bass   low-shelf lift in dB applied to this track only. Masters differ;
 *               one bed can need weight that another would be muddied by, so it
 *               belongs to the track rather than to the bus.
 */
export async function startMusic({ src, delay = 4.5, fade = 4, bass = 0 } = {}) {
  const ctx = A.context()
  if (!ctx || source || starting || !src) return
  /* Claimed SYNCHRONOUSLY, before the first await. `source` is only assigned
     after decoding, so two calls landing while a decode was in flight both saw
     `!source`, both proceeded, and both started a source - two copies of the
     song over each other. */
  starting = true
  stopped = false
  const t0 = performance.now()
  try {
    /* The context can be suspended: iOS suspends on backgrounding and does not
       resume unprompted, and a scheduled start into a suspended context is
       silence with no error to catch. */
    if (ctx.state === 'suspended') {
      try { await ctx.resume() } catch { /* best effort */ }
    }

    /* Three attempts with a short backoff. A decode or a fetch can fail for
       reasons that are simply transient on a phone - a dropped connection
       mid-download, a decoder busy behind a tab switch - and the old code gave
       up on the first one and left the page permanently silent. */
    let buf = null
    for (let attempt = 1; attempt <= 3 && !buf && !stopped; attempt++) {
      try {
        buf = await load(src)
      } catch (err) {
        console.warn(`[music] load attempt ${attempt} failed:`, err.message)
        if (attempt < 3) await new Promise((r) => setTimeout(r, 250 * attempt))
      }
    }
    if (!buf || stopped) return

    bus = A.musicIn()
    if (!bus) return
    current = src

    source = ctx.createBufferSource()
    source.buffer = buf
    source.loop = true
    source.loopStart = 0
    source.loopEnd = musicEnd(buf)

    if (bass) {
      /* A shelf, not a peak. A peaking filter at 80Hz would push one narrow
         band and read as a boom on a phone speaker that cannot reproduce it
         anyway; a shelf lifts everything below the corner together, which is
         what reads as weight rather than as a bump. 110Hz sits under the vocal
         and above the sub the speaker will not render, so the lift is audible
         on a laptop and a phone alike. */
      const shelf = ctx.createBiquadFilter()
      shelf.type = 'lowshelf'
      shelf.frequency.value = 110
      shelf.gain.value = bass
      source.connect(shelf)
      shelf.connect(bus)
    } else {
      source.connect(bus)
    }

    /* Re-anchored to the clock now that decoding, which takes a moment, is
       done. If the decode ran long the delay has already been spent waiting,
       so it is not spent again - otherwise a slow phone gets the gap twice
       over, once for the download and once for the timer. */
    const spent = Math.max(0, (performance.now() - t0) / 1000)
    const at = ctx.currentTime + Math.max(0.05, delay - spent)
    bus.gain.setValueAtTime(0.0001, at)
    bus.gain.exponentialRampToValueAtTime(PEAK, at + fade)
    source.start(at)

    /* Last line of defence. Everything above can succeed and the bed can still
       be inaudible if the context stalled, so check that it is genuinely
       running shortly after the scheduled start and have one more go if not. */
    setTimeout(() => {
      if (!stopped && source && ctx.state !== 'running') {
        ctx.resume().catch(() => {})
      }
    }, Math.max(300, (delay + 0.5) * 1000))
  } catch (err) {
    // A missing or undecodable file must never break the reveal - the page
    // simply stays on its procedural tail.
    console.warn('[music] not playing:', err.message)
    source = null
    bus = null
    current = null
  } finally {
    starting = false
  }
}

export function stopMusic({ fade = 1.2 } = {}) {
  stopped = true
  starting = false
  const ctx = A.context()
  if (!ctx || !source || !bus) return
  const t = ctx.currentTime
  bus.gain.cancelScheduledValues(t)
  bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), t)
  bus.gain.exponentialRampToValueAtTime(0.0001, t + fade)
  try { source.stop(t + fade + 0.05) } catch { /* already stopped */ }
  source = null
  bus = null
  current = null
}

export const isPlaying = () => !!source
export const playingTrack = () => current
/** Exposed for the loop test in audiotest.html. */
export const _musicEnd = musicEnd
