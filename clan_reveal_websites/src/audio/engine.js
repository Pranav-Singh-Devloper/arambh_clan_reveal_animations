/* ===========================================================================
   Procedural theatre sound engine. Every sound is synthesised at runtime with
   the Web Audio API - no audio files, nothing to host, nothing to 404.

   ARCHITECTURE

     voice -> [StereoPanner] -> program ──> HP24 -> presence +1.5dB@2.8k
                     │                       -> lowshelf -1dB@90 -> glue comp
                     │                       -> master (mute lives here)
                     │                       -> tanh soft ceiling -> limiter
                     │                       -> destination
                     └-> send -> predelay 20ms -> Convolver (generated hall IR)
                          -> HP180 -> LP5500 -> return 0.8 -> program

   - program.gain is "the cut": the gasp of near-silence before the curtain
     ducks THIS, so the mute button (master) is never fought.
   - A few sounds route DIRECT (post-program): the heartbeat in the silence,
     the audience inhale, the curtain tremor. The hall dies; your pulse stays.
   - The impulse response is generated in ~5ms at unlock(): 2.8s stereo decay,
     RT60 1.9s, darkening tail, six early reflections offset 3ms L/R.
   =========================================================================== */

let ctx = null
let program = null   // pre-duck bus (the gasp ducks this)
let direct = null    // post-duck entry point (survives the gasp)
let master = null    // mute lives here
let reverbIn = null
let noiseBuf = null
let analyser = null  // observation branch, tapped AFTER master
let muted = false
const running = new Set()

const rand = (a, b) => a + Math.random() * (b - a)

/* UNnormalized tanh: small-signal slope k, smooth plateau at tanh(k)=0.905.
   Normalizing by /tanh(k) turned this into a +4.4dB boost feeding a hard
   clamp at the curve endpoints - the opposite of a soft ceiling. The master
   level below compensates the k=1.5 slope. */
function tanhCurve(k, n = 1024) {
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    c[i] = Math.tanh(k * x)
  }
  return c
}

const MASTER_LEVEL = 0.62 // 0.85 / 1.5-slope compensation, ~-0.9dB net

/* Stereo noise, independent per channel. A shared mono buffer read from
   offset 0 made every layered noise sound comb-filter against itself and
   summed +6dB per doubling - decorrelation widens the whole show. */
function makeNoise(context) {
  const len = context.sampleRate * 2
  const buf = context.createBuffer(2, len, context.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }
  return buf
}

/* Generated hall: exponential RT60 decay, one-pole lowpass whose coefficient
   falls across the tail (air absorption), early reflections alternating sign
   with the right channel offset +3ms for width. */
function buildIR(context, dur = 2.8, rt60 = 1.9) {
  const sr = context.sampleRate
  const len = Math.ceil(dur * sr)
  const ir = context.createBuffer(2, len, sr)
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const t = i / sr
      const env = Math.pow(10, (-3 * t) / rt60)
      const k = 0.15 + 0.75 * Math.pow(1 - i / len, 1.5)
      const w = Math.random() * 2 - 1
      lp += k * (w - lp)
      d[i] = lp * env
    }
    const taps = [[0.011, 0.5], [0.017, 0.42], [0.023, -0.34], [0.029, 0.27], [0.037, -0.2], [0.043, 0.14]]
    for (const [tt, gg] of taps) {
      const at = Math.floor((tt + (ch ? 0.003 : 0)) * sr)
      if (at < len) d[at] += gg
    }
  }
  return ir
}

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC({ latencyHint: 'interactive' })
    noiseBuf = makeNoise(ctx)

    program = ctx.createGain()
    program.gain.value = 1

    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'; hp.frequency.value = 24; hp.Q.value = 0.7
    const presence = ctx.createBiquadFilter()
    presence.type = 'peaking'; presence.frequency.value = 2800
    presence.gain.value = 1.5; presence.Q.value = 0.9
    const shelf = ctx.createBiquadFilter()
    shelf.type = 'lowshelf'; shelf.frequency.value = 90; shelf.gain.value = -1

    const glue = ctx.createDynamicsCompressor()
    glue.threshold.value = -18; glue.knee.value = 12; glue.ratio.value = 3
    glue.attack.value = 0.012; glue.release.value = 0.18

    master = ctx.createGain()
    master.gain.value = muted ? 0 : MASTER_LEVEL

    const shaper = ctx.createWaveShaper()
    shaper.curve = tanhCurve(1.5)
    shaper.oversample = '2x'

    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20
    limiter.attack.value = 0.001; limiter.release.value = 0.06

    program.connect(hp); hp.connect(presence); presence.connect(shelf)
    shelf.connect(glue); glue.connect(master); master.connect(shaper)
    shaper.connect(limiter); limiter.connect(ctx.destination)
    direct = hp // post-duck, pre-safety - survives the gasp

    // reverb bus
    reverbIn = ctx.createGain()
    const pre = ctx.createDelay(0.1); pre.delayTime.value = 0.02
    const conv = ctx.createConvolver(); conv.buffer = buildIR(ctx)
    const rHP = ctx.createBiquadFilter(); rHP.type = 'highpass'; rHP.frequency.value = 180; rHP.Q.value = 0.7
    const rLP = ctx.createBiquadFilter(); rLP.type = 'lowpass'; rLP.frequency.value = 5500
    const ret = ctx.createGain(); ret.gain.value = 0.8
    reverbIn.connect(pre); pre.connect(conv); conv.connect(rHP)
    rHP.connect(rLP); rLP.connect(ret); ret.connect(program)

    // Observation tap for the visualiser. Deliberately AFTER master, so that
    // muting really does flatten the bars - a visualiser that keeps dancing
    // while the sound is off is a lie.
    analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.78
    analyser.minDecibels = -78
    analyser.maxDecibels = -22
    master.connect(analyser)

    // iOS suspends the context on tab switch and never resumes it unprompted
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && ctx && ctx.state === 'suspended') ctx.resume()
    })
  }
  if (ctx.state === 'suspended') ctx.resume()
  master.gain.setTargetAtTime(muted ? 0 : MASTER_LEVEL, ctx.currentTime, 0.02)
  // NOTE: program.gain is deliberately NOT reset here - the gasp duck is
  // scheduled ~19.5s ahead, and a second unlock() mid-show must not erase it.
  return ctx
}

export const now = () => (ctx ? ctx.currentTime : 0)
export const isReady = () => !!ctx
export const context = () => ctx

/** The spectrum tap. Null until the first user gesture unlocks audio. */
export const getAnalyser = () => analyser

/** Entry point for the music bed. Routes post-duck (the gasp must never touch
    it) but pre-master, so the existing mute button covers it for free and the
    limiter still protects the output. */
export function musicIn() {
  if (!ctx) return null
  const g = ctx.createGain()
  g.gain.value = 0
  g.connect(direct)
  return g
}

export function setMuted(next) {
  muted = next
  if (master) master.gain.setTargetAtTime(next ? 0 : MASTER_LEVEL, ctx.currentTime, 0.02)
}

export function stopAll() {
  if (!ctx) return
  const t = ctx.currentTime
  // dip the program bus so a hundred sources stopping at once doesn't click,
  // then restore so post-skip sounds (poppers) still play
  program.gain.cancelScheduledValues(t)
  program.gain.setTargetAtTime(0.0001, t, 0.015)
  program.gain.setTargetAtTime(1, t + 0.05, 0.03) // back up before the poppers fire
  running.forEach((n) => {
    try { n.stop(t + 0.1) } catch { /* already stopped */ }
  })
  running.clear()
}

/* --- routing ------------------------------------------------------------- */

/** Entry point for a voice: pans it, optionally sends to the hall, returns
    the node the voice should connect INTO. */
function out({ pan = 0, send = 0, dry = false } = {}) {
  const p = ctx.createStereoPanner()
  p.pan.value = pan
  p.connect(dry ? direct : program)
  if (send > 0) {
    const sg = ctx.createGain()
    sg.gain.value = send
    p.connect(sg)
    sg.connect(reverbIn)
  }
  return p
}

function noiseSource(when, dur, dest) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const g = ctx.createGain()
  src.connect(g)
  if (dest) g.connect(dest)
  src.start(when, Math.random() * noiseBuf.duration) // random offset: decorrelate
  src.stop(when + dur + 0.1)
  running.add(src)
  src.onended = () => running.delete(src)
  return { src, g }
}

function tone(type, freq, when, dur, peak, dest) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, when)
  const atk = Math.min(0.012, dur * 0.4)
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + atk)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  o.connect(g)
  g.connect(dest || out())
  o.start(when)
  o.stop(when + dur + 0.05)
  running.add(o)
  o.onended = () => running.delete(o)
  return { o, g }
}

/* =========================================================================
   THE HOUSE
   ========================================================================= */

/** Low ominous bed. Beating 41Hz pair, 27.5Hz sub for headphones, filter
    breathing, tape wow. Ends at the cut - the silence must be silent. */
export function drone(when, dur = 6) {
  if (!ctx) return
  const filt = ctx.createBiquadFilter()
  filt.type = 'lowpass'
  filt.frequency.value = 220
  filt.connect(out({ send: 0.1 }))

  // filter breath: ±60Hz at 0.11Hz
  const breathe = ctx.createOscillator()
  const bg = ctx.createGain()
  breathe.type = 'sine'; breathe.frequency.value = 0.11
  bg.gain.value = 60
  breathe.connect(bg); bg.connect(filt.frequency)
  breathe.start(when); breathe.stop(when + dur + 0.2)
  running.add(breathe); breathe.onended = () => running.delete(breathe)

  const wow = ctx.createOscillator()
  const wg = ctx.createGain()
  wow.type = 'sine'; wow.frequency.value = 0.4
  wg.gain.value = 4 // cents
  wow.connect(wg)
  wow.start(when); wow.stop(when + dur + 0.2)
  running.add(wow); wow.onended = () => running.delete(wow)

  const voices = [
    [41, 'sine', 0.16], [41.3, 'sine', 0.1], [27.5, 'sine', 0.1],
    [55, 'sine', 0.09], [82, 'triangle', 0.06],
  ]
  voices.forEach(([f, type, peak]) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = f
    wg.connect(o.detune)
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(peak, when + 1.2)
    g.gain.setValueAtTime(peak, when + dur - 0.25)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur) // dies AT the cut
    o.connect(g); g.connect(filt)
    o.start(when); o.stop(when + dur + 0.1)
    running.add(o); o.onended = () => running.delete(o)
  })
}

/** A full house murmuring: two decorrelated beds panned wide, three coughs,
    one seat creak. Returns a handle for hush(). */
export function crowdMurmur(when, dur = 10, peak = 0.11) {
  if (!ctx) return null
  const handle = { gains: [], lfoGains: [], level: peak * 0.7 }

  ;[-0.5, 0.5].forEach((pan) => {
    const dest = out({ pan, send: 0.25 })
    const { g } = noiseSource(when, dur, null)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 620; bp.Q.value = 0.7
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 1500
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(peak * 0.7, when + 1.4)
    g.connect(bp); bp.connect(lp); lp.connect(dest)

    const lfo = ctx.createOscillator()
    const lg = ctx.createGain()
    lfo.type = 'sine'
    lfo.frequency.value = rand(0.22, 0.31)
    lg.gain.value = peak * 0.3
    lfo.connect(lg); lg.connect(g.gain)
    lfo.start(when); lfo.stop(when + dur)
    running.add(lfo); lfo.onended = () => running.delete(lfo)

    handle.gains.push(g)
    handle.lfoGains.push(lg)
  })

  // three coughs and a seat creak - nothing sells "audience" cheaper
  for (let i = 0; i < 3; i++) {
    const t = when + rand(2, Math.max(3, dur - 2))
    const { g } = noiseSource(t, 0.1, null)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 4
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
    g.connect(bp); bp.connect(out({ pan: rand(-0.6, 0.6), send: 0.3 }))
  }
  const ct = when + rand(3, Math.max(4, dur - 3))
  const creak = ctx.createOscillator()
  const cg = ctx.createGain()
  creak.type = 'sine'
  creak.frequency.setValueAtTime(300, ct)
  creak.frequency.linearRampToValueAtTime(280, ct + 0.12)
  cg.gain.setValueAtTime(0.0001, ct)
  cg.gain.exponentialRampToValueAtTime(0.03, ct + 0.03)
  cg.gain.exponentialRampToValueAtTime(0.0001, ct + 0.12)
  creak.connect(cg); cg.connect(out({ pan: 0.3, send: 0.3 }))
  creak.start(ct); creak.stop(ct + 0.15)
  running.add(creak); creak.onended = () => running.delete(creak)

  return handle
}

/** The room going quiet. Ramps the murmur beds AND their LFO depths - the
    old version left the LFO wobbling through the "silence". */
export function hush(handle, when, dur = 1.6) {
  if (!ctx || !handle) return
  handle.gains.forEach((g) => {
    g.gain.cancelScheduledValues(when)
    // anchor at the bed's actual plateau - reading g.gain.value at schedule
    // time returns the param DEFAULT (1.0), not the future automated level
    g.gain.setValueAtTime(Math.max(handle.level || 0.08, 0.0002), when)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  })
  handle.lfoGains.forEach((lg) => {
    lg.gain.setTargetAtTime(0, when, dur / 4)
  })
}

/** A stage lamp striking: contactor clunk, relay double-hit 18ms later,
    filament ring. Panned - nine of these march left to right. */
export function lightClunk(when, pan = 0) {
  if (!ctx) return
  const dest = out({ pan, send: 0.35 })
  ;[[0, 1], [0.018, 0.6]].forEach(([off, amt]) => {
    const { g } = noiseSource(when + off, 0.09, null)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 2.2
    g.gain.setValueAtTime(0.0001, when + off)
    g.gain.exponentialRampToValueAtTime(0.3 * amt, when + off + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, when + off + 0.085)
    g.connect(bp); bp.connect(dest)
    tone('square', 88, when + off, 0.11, 0.14 * amt, dest)
  })
  tone('sine', 2400, when + 0.008, 0.2, 0.04, dest)
}

/** Orchestra settling onto A. The oboe gives the note first; strings drift
    into tune around it, seated across the stereo stage, bows wobbling. */
export function orchestraTuning(when, dur = 2.4) {
  if (!ctx) return
  // oboe lead
  const oboe = ctx.createOscillator()
  const og = ctx.createGain()
  oboe.type = 'triangle'
  oboe.frequency.value = 440
  const vib = ctx.createOscillator()
  const vg = ctx.createGain()
  vib.type = 'sine'; vib.frequency.value = 5
  vg.gain.value = 6
  vib.connect(vg); vg.connect(oboe.detune)
  og.gain.setValueAtTime(0.0001, when)
  og.gain.exponentialRampToValueAtTime(0.06, when + 0.25)
  og.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  oboe.connect(og); og.connect(out({ pan: -0.1, send: 0.3 }))
  oboe.start(when); oboe.stop(when + dur + 0.1)
  vib.start(when); vib.stop(when + dur + 0.1)
  running.add(oboe); oboe.onended = () => running.delete(oboe)
  running.add(vib); vib.onended = () => running.delete(vib)

  // strings finding the pitch
  const seats = [
    [440.9, 'sawtooth', -0.55], [439.1, 'sawtooth', -0.35],
    [220, 'sawtooth', 0.2], [110, 'triangle', 0.65],
  ]
  seats.forEach(([f, type, pan], i) => {
    const start = when + 0.3 + i * 0.15
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(f, start)
    const target = f > 300 ? 440 : f > 150 ? 220 : 110
    o.frequency.linearRampToValueAtTime(target, when + dur * 0.85)
    // re-bowing wobble
    const wob = ctx.createOscillator()
    const wg = ctx.createGain()
    wob.type = 'sine'; wob.frequency.value = 0.7
    wg.gain.value = 0.015
    wob.connect(wg); wg.connect(g.gain)
    wob.start(start); wob.stop(when + dur)
    running.add(wob); wob.onended = () => running.delete(wob)

    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(0.05, start + 0.3)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 2600
    o.connect(g); g.connect(lp); lp.connect(out({ pan, send: 0.3 }))
    o.start(start); o.stop(when + dur + 0.1)
    running.add(o); o.onended = () => running.delete(o)
  })
}

/** Three baton taps on the music stand. */
export function conductorTap(when, count = 3, gap = 0.34) {
  if (!ctx) return
  for (let i = 0; i < count; i++) {
    const t = when + i * gap
    const dest = out({ send: 0.4 })
    const { g } = noiseSource(t, 0.05, null)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 2100; bp.Q.value = 3
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
    g.connect(bp); bp.connect(dest)
    tone('square', 1500, t, 0.05, 0.09, dest)
  }
}

/** Ceremonial tam-tam. Inharmonic partials with individual decay constants,
    detuned twins for shimmer beat, a 6s darkening sweep, a felt mallet thump.
    Rings ~8s - the tail overlapping the tuning is good theatre. */
export function gong(when) {
  if (!ctx) return
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(3200, when)
  lp.frequency.exponentialRampToValueAtTime(700, when + 6)
  lp.connect(out({ send: 0.45 }))

  const partials = [82, 121, 168, 233, 311, 402]
  const taus = [1.6, 1.35, 1.1, 0.9, 0.7, 0.55]
  partials.forEach((f, i) => {
    ;[[f, 1], [f + 1.5, 0.5]].forEach(([freq, amt]) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      const peak = (0.3 / (i * 0.55 + 1)) * amt
      g.gain.setValueAtTime(0.0001, when)
      g.gain.exponentialRampToValueAtTime(peak, when + 0.02)
      g.gain.setTargetAtTime(0.0001, when + 0.05, taus[i])
      o.connect(g); g.connect(lp)
      o.start(when); o.stop(when + 8)
      running.add(o); o.onended = () => running.delete(o)
    })
  })

  // mallet felt
  const { g: mg } = noiseSource(when, 0.08, null)
  const mlp = ctx.createBiquadFilter()
  mlp.type = 'lowpass'; mlp.frequency.value = 400
  mg.gain.setValueAtTime(0.0001, when)
  mg.gain.exponentialRampToValueAtTime(0.18, when + 0.005)
  mg.gain.exponentialRampToValueAtTime(0.0001, when + 0.07)
  mg.connect(mlp); mlp.connect(out({ send: 0.45 }))
}

/* =========================================================================
   THE BUILD
   ========================================================================= */

/** Heartbeat. Dry, centred, routed DIRECT - in the gasp the hall dies and
    your pulse is in your ears. Valve-click layer per thump. */
export function heartbeat(when, beats = 2, gap = 0.75) {
  if (!ctx) return
  const dest = out({ dry: true })
  for (let i = 0; i < beats; i++) {
    const t = when + i * gap
    ;[0, 0.17].forEach((off, k) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(72, t + off)
      o.frequency.exponentialRampToValueAtTime(38, t + off + 0.16)
      g.gain.setValueAtTime(0.0001, t + off)
      g.gain.exponentialRampToValueAtTime(k ? 0.26 : 0.4, t + off + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.26)
      o.connect(g); g.connect(dest)
      o.start(t + off); o.stop(t + off + 0.3)
      running.add(o); o.onended = () => running.delete(o)

      const { g: vg } = noiseSource(t + off, 0.04, null)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'; bp.frequency.value = 200; bp.Q.value = 2
      vg.gain.setValueAtTime(0.0001, t + off)
      vg.gain.exponentialRampToValueAtTime(0.1, t + off + 0.004)
      vg.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.035)
      vg.connect(bp); bp.connect(dest)
    })
  }
}

/** Accelerating snare roll, humanized: timing jitter ±6ms, gain jitter ±20%,
    alternate-hand accents, pan alternation, pow(1.6) crescendo so the last
    second blooms instead of the whole roll being loud early. */
export function drumroll(when, dur = 5) {
  if (!ctx) return
  const bodyDest = out({ pan: -0.25, send: 0.22 })
  let t = 0
  let gap = 0.13
  let hand = 0
  while (t < dur) {
    const at = when + t + (Math.random() - 0.5) * 0.012
    const p = Math.pow(t / dur, 1.6)
    const human = (0.8 + Math.random() * 0.4) * (hand % 2 ? 0.85 : 1)

    const { g } = noiseSource(at, 0.1, null)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = (150 + p * 90) * rand(0.9, 1.1)
    bp.Q.value = 1.4
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime((0.1 + p * 0.4) * human, at + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09)
    g.connect(bp); bp.connect(bodyDest)

    const s = noiseSource(at, 0.05, null)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'; hp.frequency.value = 2600
    s.g.gain.setValueAtTime(0.0001, at)
    s.g.gain.exponentialRampToValueAtTime((0.04 + p * 0.13) * human, at + 0.004)
    s.g.gain.exponentialRampToValueAtTime(0.0001, at + 0.045)
    s.g.connect(hp)
    hp.connect(out({ pan: hand % 2 ? 0.12 : -0.12, send: 0.18 }))

    hand++
    t += gap
    gap = Math.max(0.022, gap * 0.955)
  }
}

/** Timpani roll with an actual fundamental that rises F2 -> G2 across the
    roll - physically impossible on one drum, emotionally correct. */
export function timpaniRoll(when, dur = 6) {
  if (!ctx) return
  const dest = out({ pan: 0.2, send: 0.22 })
  const res = ctx.createBiquadFilter()
  res.type = 'bandpass'; res.frequency.value = 120; res.Q.value = 6
  res.connect(dest)
  let t = 0
  let gap = 0.1
  while (t < dur) {
    const at = when + t + (Math.random() - 0.5) * 0.012
    const p = Math.pow(t / dur, 1.6)
    const human = 0.8 + Math.random() * 0.4
    const level = (0.08 + p * 0.3) * human

    const { g } = noiseSource(at, 0.14, null)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 190
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(level, at + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13)
    g.connect(lp); lp.connect(dest); lp.connect(res)

    // fundamental: 87Hz rising to 98Hz across the roll
    const f = 87 + (98 - 87) * (t / dur)
    const o = ctx.createOscillator()
    const og = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = f
    og.gain.setValueAtTime(0.0001, at)
    og.gain.exponentialRampToValueAtTime(level * 0.5, at + 0.008)
    og.gain.exponentialRampToValueAtTime(0.0001, at + 0.12)
    o.connect(og); og.connect(dest)
    o.start(at); o.stop(at + 0.15)
    running.add(o); o.onended = () => running.delete(o)

    t += gap
    gap = Math.max(0.03, gap * 0.965)
  }
}

/** Shepard-Risset riser: the infinite-rise illusion. Voices sweep 55->1760Hz
    over 8s under a Hann loudness window; staggered launches mean something is
    always rising and nothing ever arrives. A physical saw riser sits under it
    - the Shepard supplies "forever", the saw supplies "approaching". */
export function riser(when, dur = 4) {
  if (!ctx) return
  const bus = ctx.createGain()
  bus.gain.setValueAtTime(0.0001, when)
  bus.gain.exponentialRampToValueAtTime(0.28, when + Math.max(0.2, dur - 0.45))
  bus.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.5
  bus.connect(lp)
  // two decorrelated outputs for width
  lp.connect(out({ pan: -0.3, send: 0.12 }))
  const haas = ctx.createDelay(0.05); haas.delayTime.value = 0.012
  lp.connect(haas); haas.connect(out({ pan: 0.3 }))

  const SWEEP = 8, F0 = 55, F1 = 1760, PEAK = 0.09

  const launch = (start, phase) => {
    // phase 0..1: how far through its 8s sweep this voice already is
    const remain = (1 - phase) * SWEEP
    if (remain < 0.2) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(F0 * Math.pow(F1 / F0, phase), start)
    o.frequency.exponentialRampToValueAtTime(F1, start + remain)
    // Hann slice from `phase` to 1
    const N = 48
    const curve = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const x = phase + (i / (N - 1)) * (1 - phase)
      curve[i] = Math.max(0.0001, PEAK * (0.5 - 0.5 * Math.cos(2 * Math.PI * x)))
    }
    g.gain.setValueCurveAtTime(curve, start, remain)
    o.connect(g); g.connect(bus)
    o.start(start)
    o.stop(when + dur + 0.05) // all voices die with the riser - nothing leaks past the cut
    running.add(o); o.onended = () => running.delete(o)
  }

  for (let v = 0; v < 8; v++) launch(when, v / 8) // already mid-flight
  for (let k = 1; k < Math.ceil(dur); k++) launch(when + k, 0)

  // the physical riser underneath
  const { g } = noiseSource(when, dur, null)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'; bp.Q.value = 3.5
  bp.frequency.setValueAtTime(300, when)
  bp.frequency.exponentialRampToValueAtTime(7000, when + dur)
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(0.2, when + dur * 0.92)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  g.connect(bp); bp.connect(out({ send: 0.12 }))

  const o = ctx.createOscillator()
  const og = ctx.createGain()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(90, when)
  o.frequency.exponentialRampToValueAtTime(900, when + dur)
  const olp = ctx.createBiquadFilter()
  olp.type = 'lowpass'; olp.frequency.value = 1800
  og.gain.setValueAtTime(0.0001, when)
  og.gain.exponentialRampToValueAtTime(0.08, when + dur * 0.9)
  og.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  o.connect(og); og.connect(olp); olp.connect(out())
  o.start(when); o.stop(when + dur + 0.05)
  running.add(o); o.onended = () => running.delete(o)
}

/** Countdown hits. DESCENDING as the numbers fall - dread goes down, not up.
    n = 0 ("3"), 1 ("2"), 2 ("1" - which also gets a flat sub under it). */
export function countHit(when, n = 0) {
  if (!ctx) return
  const start = [233, 208, 185][n]
  const end = [58, 52, 46][n]
  const peak = [0.55, 0.66, 0.78][n]
  const dest = out({ send: 0.3 })

  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(start, when)
  o.frequency.exponentialRampToValueAtTime(end, when + 0.24)
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(peak, when + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.35)
  o.connect(g); g.connect(dest)
  o.start(when); o.stop(when + 0.4)
  running.add(o); o.onended = () => running.delete(o)

  if (n === 2) tone('sine', 48, when, 0.15, 0.25, out())

  const { g: ng } = noiseSource(when, 0.12, null)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'; hp.frequency.value = 1200
  ng.gain.setValueAtTime(0.0001, when)
  ng.gain.exponentialRampToValueAtTime(0.18, when + 0.005)
  ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.11)
  ng.connect(hp); hp.connect(dest)
}

/* =========================================================================
   THE CUT - the gasp before the curtain
   ========================================================================= */

/** Ducks the program bus to -38dB in 100ms. The reverb return feeds program,
    so the hall's own tail ducks with it - the room holds its breath. Restore
    is a snap 30ms before the impact, never a swell. Mute (master) untouched. */
export function gaspDuck(when, restoreAt) {
  if (!ctx) return
  const g = program.gain
  g.cancelScheduledValues(when)
  g.setValueAtTime(1, when)
  g.exponentialRampToValueAtTime(0.012, when + 0.1)
  g.setValueAtTime(0.012, restoreAt - 0.03)
  g.linearRampToValueAtTime(1, restoreAt - 0.005)
}

/** The audience breathing in. Bandpassed noise sweeping up, routed direct so
    it survives the duck. The last 350ms before the curtain. */
export function inhale(when, dur = 0.35) {
  if (!ctx) return
  const { g } = noiseSource(when, dur + 0.05, null)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'; bp.Q.value = 1.4
  bp.frequency.setValueAtTime(800, when)
  bp.frequency.linearRampToValueAtTime(1900, when + dur)
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(0.055, when + dur * 0.85)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.03)
  g.connect(bp); bp.connect(out({ dry: true }))
}

/** One faint fabric tremor in the silence - someone's hand is already on the
    velvet. Invisible first watch, unmistakable on the replay. */
export function tremorRustle(when) {
  if (!ctx) return
  const { g } = noiseSource(when, 0.15, null)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'; bp.frequency.value = 2800; bp.Q.value = 1.2
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(0.03, when + 0.04)
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.15)
  g.connect(bp); bp.connect(out({ dry: true, pan: 0.1 }))
}

/* =========================================================================
   THE CURTAIN AND THE MOMENT
   ========================================================================= */

/** Curtain machinery: low rumble with 8.3Hz motor cogging. */
export function curtainRumble(when, dur = 2.6) {
  if (!ctx) return
  const dest = out({ send: 0.08 })
  const { g } = noiseSource(when, dur, null)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'; lp.frequency.value = 130
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(0.36, when + 0.35)
  g.gain.setValueAtTime(0.36, when + dur * 0.7)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  g.connect(lp); lp.connect(dest)

  const cog = ctx.createOscillator()
  const cg = ctx.createGain()
  cog.type = 'square'; cog.frequency.value = 8.3
  cg.gain.value = 0.045
  cog.connect(cg); cg.connect(g.gain)
  cog.start(when); cog.stop(when + dur)
  running.add(cog); cog.onended = () => running.delete(cog)

  tone('sine', 44, when, dur * 0.9, 0.24, dest)
}

/** Heavy velvet dragging apart: two panned sweeps plus fabric granules. */
export function curtainRustle(when, dur = 2.2) {
  if (!ctx) return
  ;[-0.6, 0.6].forEach((pan) => {
    const { g } = noiseSource(when, dur, null)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.Q.value = 0.8
    bp.frequency.setValueAtTime(1400, when)
    bp.frequency.linearRampToValueAtTime(3400, when + dur * 0.6)
    bp.frequency.linearRampToValueAtTime(900, when + dur)
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(0.13, when + 0.25)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    g.connect(bp); bp.connect(out({ pan, send: 0.2 }))

    for (let i = 0; i < 12; i++) {
      const t = when + rand(0.05, dur - 0.1)
      const gd = rand(0.03, 0.07)
      const { g: gg } = noiseSource(t, gd, null)
      const gbp = ctx.createBiquadFilter()
      gbp.type = 'bandpass'; gbp.frequency.value = rand(2000, 4500); gbp.Q.value = 2
      gg.gain.setValueAtTime(0.0001, t)
      gg.gain.exponentialRampToValueAtTime(rand(0.04, 0.08), t + 0.008)
      gg.gain.exponentialRampToValueAtTime(0.0001, t + gd)
      gg.connect(gbp); gbp.connect(out({ pan: pan * rand(0.6, 1.2) }))
    }
  })
}

/* =========================================================================
   THE ORCHESTRA

   Everything from the curtain onward. The previous version of this block was
   party-store sound design - square-wave popper cracks, crowd whistles and
   twinkly chime "sparkles" - which reads as a birthday, not a ceremony.

   What makes synthesised strings and brass sound like players rather than a
   synth patch, and why each is here:
     - many detuned voices per note, each with INDEPENDENT slow pitch drift
       (a section is never in perfect tune with itself)
     - ragged entries: voices start up to 50ms apart, like real bows landing
     - linear, slow attacks (bowed), not the exponential snap used elsewhere
     - the lowpass OPENS with the swell - brightness follows bow pressure
     - vibrato arrives late and at slightly different rates per voice
     - a whisper of bow/breath noise under the pitch
     - heavy reverb send: an orchestra is mostly the hall it sits in
   ========================================================================= */

/** The core section builder: one note, many players. */
function ensemble(freq, when, dur, opts = {}) {
  if (!ctx) return
  const {
    voices = 4, type = 'sawtooth', peak = 0.03, spread = 9,
    attack = 0.3, cutoff = 2600, cutoffStart = 520, pan = 0, send = 0.36,
    vibDelay = 1.2, vibDepth = 7, vibRate = 5.2, breath = 0,
  } = opts

  const dest = out({ pan, send })
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 0.9
  lp.frequency.setValueAtTime(cutoffStart, when)
  lp.frequency.linearRampToValueAtTime(cutoff, when + attack * 1.6)
  lp.frequency.setTargetAtTime(cutoff * 0.5, when + dur * 0.55, dur * 0.25)
  lp.connect(dest)

  const rel = Math.min(dur * 0.5, 2.6)

  for (let v = 0; v < voices; v++) {
    const start = when + rand(0, 0.05)          // ragged section entry
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = freq
    o.detune.value = (v - (voices - 1) / 2) * spread + rand(-3, 3)

    // independent slow drift - the single strongest "many players" cue
    const drift = ctx.createOscillator()
    const dg = ctx.createGain()
    drift.type = 'sine'
    drift.frequency.value = rand(0.08, 0.22)
    dg.gain.value = rand(2, 5)
    drift.connect(dg); dg.connect(o.detune)
    drift.start(start); drift.stop(when + dur + 0.3)
    running.add(drift); drift.onended = () => running.delete(drift)

    // late, desynchronised vibrato
    if (vibDepth > 0) {
      const vib = ctx.createOscillator()
      const vg = ctx.createGain()
      vib.type = 'sine'
      vib.frequency.value = vibRate + rand(-0.4, 0.4)
      vg.gain.setValueAtTime(0, start)
      vg.gain.setValueAtTime(0, start + vibDelay)
      vg.gain.linearRampToValueAtTime(vibDepth, start + vibDelay + 0.7)
      vib.connect(vg); vg.connect(o.detune)
      vib.start(start); vib.stop(when + dur + 0.3)
      running.add(vib); vib.onended = () => running.delete(vib)
    }

    const atkEnd = start + attack
    const relStart = Math.max(atkEnd + 0.05, when + dur - rel)
    g.gain.setValueAtTime(0.0001, start)
    g.gain.linearRampToValueAtTime(peak, atkEnd)   // linear = bowed, not plucked
    g.gain.setTargetAtTime(0.0001, relStart, rel / 3)
    o.connect(g); g.connect(lp)
    o.start(start); o.stop(when + dur + 0.3)
    running.add(o); o.onended = () => running.delete(o)
  }

  if (breath > 0) {
    const { g } = noiseSource(when, dur, null)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.8
    g.gain.setValueAtTime(0.0001, when)
    g.gain.linearRampToValueAtTime(breath, when + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    g.connect(bp); bp.connect(dest)
  }
}

/** String section. Wide, slow, breathing - the backbone of "grand". */
export function strings(when, freqs, dur, opts = {}) {
  const { peak = 0.028, spread = 11, attack = 0.42, base = -0.5 } = opts
  freqs.forEach((f, i) => {
    const pan = freqs.length > 1 ? base + (i / (freqs.length - 1)) * 1.0 : 0
    ensemble(f, when, dur, {
      voices: 4, type: 'sawtooth', peak, spread, attack,
      cutoff: f > 500 ? 3400 : 2200, cutoffStart: 420,
      pan, send: 0.4, vibDelay: 1.3, vibDepth: 8, breath: i === 0 ? 0.012 : 0,
      ...opts.voiceOpts,
    })
  })
}

/** French horns: rounder and darker than the strings, softer attack. */
export function horns(when, freqs, dur, opts = {}) {
  const { peak = 0.034 } = opts
  freqs.forEach((f, i) => {
    const pan = -0.3 + (i / Math.max(1, freqs.length - 1)) * 0.6
    ensemble(f, when, dur, {
      voices: 3, type: 'sawtooth', peak, spread: 7, attack: 0.16,
      cutoff: 1900, cutoffStart: 380, pan, send: 0.34,
      vibDelay: 1.6, vibDepth: 5, vibRate: 4.8,
    })
  })
}

/** Trombones and tuba - the floor the whole chord stands on. */
export function lowBrass(when, freqs, dur, opts = {}) {
  const { peak = 0.05 } = opts
  freqs.forEach((f, i) => {
    ensemble(f, when, dur, {
      voices: 3, type: 'sawtooth', peak, spread: 6, attack: 0.12,
      cutoff: 900, cutoffStart: 260, pan: i ? 0.2 : -0.2, send: 0.26,
      vibDelay: 2.2, vibDepth: 3,
    })
  })
}

/** A large ceremonial bell. Inharmonic partials with individual decay
    constants and detuned twins for the beating shimmer - this is the sound
    that replaced seven twinkly chimes. */
export function bell(when, base = 65.41, peak = 0.2) {
  if (!ctx) return
  const dest = out({ send: 0.5 })
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(4200, when)
  lp.frequency.exponentialRampToValueAtTime(900, when + 7)
  lp.connect(dest)

  const ratios = [1, 2.0, 3.01, 4.17, 5.43, 6.79, 8.21]
  const taus = [3.6, 3.0, 2.4, 1.9, 1.4, 1.0, 0.75]
  ratios.forEach((r, i) => {
    ;[[base * r, 1], [base * r + 0.7, 0.55]].forEach(([f, amt]) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      const lvl = (peak / (i * 0.6 + 1)) * amt
      g.gain.setValueAtTime(0.0001, when)
      g.gain.exponentialRampToValueAtTime(lvl, when + 0.015)
      g.gain.setTargetAtTime(0.0001, when + 0.04, taus[i])
      o.connect(g); g.connect(lp)
      o.start(when); o.stop(when + 9)
      running.add(o); o.onended = () => running.delete(o)
    })
  })

  // felt clapper
  const { g: mg } = noiseSource(when, 0.09, null)
  const mlp = ctx.createBiquadFilter()
  mlp.type = 'lowpass'; mlp.frequency.value = 520
  mg.gain.setValueAtTime(0.0001, when)
  mg.gain.exponentialRampToValueAtTime(0.14, when + 0.004)
  mg.gain.exponentialRampToValueAtTime(0.0001, when + 0.08)
  mg.connect(mlp); mlp.connect(dest)
}

/** Single deep timpani stroke - the ceremonial one, not a boom. */
export function timpaniHit(when, freq = 73.42, peak = 0.42) {
  if (!ctx) return
  const dest = out({ send: 0.3 })
  ;[1, 1.5, 2.0].forEach((r, i) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(freq * r * 1.04, when)
    o.frequency.exponentialRampToValueAtTime(freq * r, when + 0.12)
    const lvl = peak / (i * 1.8 + 1)
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(lvl, when + 0.01)
    g.gain.setTargetAtTime(0.0001, when + 0.05, 0.55 - i * 0.12)
    o.connect(g); g.connect(dest)
    o.start(when); o.stop(when + 2.6)
    running.add(o); o.onended = () => running.delete(o)
  })
  const { g } = noiseSource(when, 0.12, null)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'; lp.frequency.value = 320
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(0.16, when + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.11)
  g.connect(lp); lp.connect(dest)
}

/** The lift from curtain to impact: a rolled cymbal kept deliberately dark,
    under a rising string cluster. Replaces a bright cymbal wash that read
    as a cheap transition effect. */
export function revealSwell(when, dur = 1.2) {
  if (!ctx) return
  const dest = out({ pan: 0.2, send: 0.34 })
  const { g } = noiseSource(when, dur + 0.4, null)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.setValueAtTime(1600, when)
  hp.frequency.exponentialRampToValueAtTime(4200, when + dur)
  const tame = ctx.createBiquadFilter()
  tame.type = 'lowpass'; tame.frequency.value = 8000
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(0.2, when + dur * 0.95)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.35)
  g.connect(hp); hp.connect(tame); tame.connect(dest)

  // string cluster rising into the reveal
  ;[196.0, 261.63, 392.0].forEach((f, i) => {
    ensemble(f, when, dur + 0.15, {
      voices: 3, peak: 0.022, spread: 14, attack: dur * 0.8,
      cutoff: 2600, cutoffStart: 600, pan: -0.4 + i * 0.4,
      send: 0.4, vibDepth: 0,
    })
  })
}

/** The moment: saturated sub drop (the waveshaper folds 28Hz into audible
    harmonics so phone speakers still feel the drop), a broadband transient
    instead of a tonal ding, and a punch layer. Sub stays dry - reverbed bass
    is mud. */
export function bigImpact(when) {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(220, when)
  o.frequency.exponentialRampToValueAtTime(28, when + 0.9)
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(0.8, when + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, when + 1.6)
  const pre = ctx.createGain(); pre.gain.value = 1.4
  const sh = ctx.createWaveShaper()
  sh.curve = tanhCurve(2.5); sh.oversample = '4x'
  const post = ctx.createGain(); post.gain.value = 0.6
  o.connect(g); g.connect(pre); pre.connect(sh); sh.connect(post)
  post.connect(out())
  o.start(when); o.stop(when + 1.7)
  running.add(o); o.onended = () => running.delete(o)

  // broadband transient, NOT a 1200Hz sine (that read as a ding)
  const { g: tg } = noiseSource(when, 0.05, null)
  const tbp = ctx.createBiquadFilter()
  tbp.type = 'bandpass'; tbp.frequency.value = 1800; tbp.Q.value = 0.6
  tg.gain.setValueAtTime(0.0001, when)
  tg.gain.exponentialRampToValueAtTime(0.3, when + 0.003)
  tg.gain.exponentialRampToValueAtTime(0.0001, when + 0.045)
  tg.connect(tbp); tbp.connect(out({ send: 0.2 }))

  tone('sine', 100, when, 0.06, 0.5, out())
}

/** THE REVEAL CHORD - a film-ident bloom, not a fanfare tune.

    The whole orchestra lands at once on a suspended 4th, resolves to the
    major third half a second later, horns bloom over the top, and high
    strings add a last octave. Eight seconds of decay carry into the hero
    page so the reveal never falls into silence. */
export function orchestralReveal(when) {
  if (!ctx) return

  timpaniHit(when, 73.42, 0.42)          // D2
  bell(when, 65.41, 0.2)                 // C2 ceremonial bell

  // the floor
  lowBrass(when, [65.41, 130.81], 7.5, { peak: 0.05 })            // C2, C3

  // Csus4 -> the F voices resolve down to E at +0.55
  strings(when, [130.81, 196.0, 349.23, 523.25], 8, { peak: 0.03 })  // C3 G3 F4 C5
  const resolveAt = when + 0.55
  strings(resolveAt, [329.63], 7.4, { peak: 0.026 })                 // E4 arrives
  // the suspension leaves as the third lands
  ensemble(349.23, resolveAt, 0.5, {
    voices: 3, peak: 0.0001, spread: 10, attack: 0.05, cutoff: 2000, send: 0.3, vibDepth: 0,
  })

  // horns bloom over the chord
  horns(when + 1.3, [130.81, 196.0, 261.63], 6.2, { peak: 0.034 })   // C3 G3 C4

  // a final octave of high strings, very soft
  strings(when + 2.2, [783.99, 1046.5], 5.2, { peak: 0.014, attack: 1.1 })
}

/** A hall rising to its feet. Darker and further back than a stadium: no
    whistles, claps band-limited to 700-1600Hz (flesh, not hiss), a slower
    swell and a heavier reverb send so the ovation sits in the room rather
    than on top of the listener. */
export function ovation(when, dur = 5.5) {
  if (!ctx) return
  ;[-0.7, 0.7].forEach((pan) => {
    const { g } = noiseSource(when, dur, null)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.45
    const body = ctx.createBiquadFilter()
    body.type = 'peaking'; body.frequency.value = 1800
    body.gain.value = 3; body.Q.value = 1.5
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(0.12, when + 0.6)
    g.gain.setValueAtTime(0.12, when + dur * 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    g.connect(bp); bp.connect(body); body.connect(out({ pan, send: 0.42 }))
  })

  const clap = (at, amp) => {
    const { g } = noiseSource(at, 0.035, null)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 700 + Math.random() * 900
    bp.Q.value = 1.8
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(amp, at + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.03)
    g.connect(bp); bp.connect(out({ pan: rand(-0.8, 0.8), send: 0.42 }))
  }
  // builds rather than erupts - the room stands up over half a second
  for (let i = 0; i < 40; i++) clap(when + Math.random() * 0.9, rand(0.03, 0.06))
  for (let i = 0; i < 70; i++) {
    const p = i / 70
    clap(when + 0.9 + p * (dur - 1.2) + Math.random() * 0.1, rand(0.03, 0.06) * (1 - p * 0.55))
  }
}

/** A compressed-air confetti cannon: a low whoomph and paper flutter.
    The old version was a square-wave crack sweeping 900->110Hz, which is
    the cartoon "pop" that made the whole ending sound like a party. */
export function airCannon(when, pan = 0) {
  if (!ctx) return
  const dest = out({ pan, send: 0.3 })

  const { g } = noiseSource(when, 0.35, null)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(700, when)
  lp.frequency.exponentialRampToValueAtTime(220, when + 0.3)
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(0.2, when + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.32)
  g.connect(lp); lp.connect(dest)

  // body thump
  const o = ctx.createOscillator()
  const og = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(110, when)
  o.frequency.exponentialRampToValueAtTime(52, when + 0.14)
  og.gain.setValueAtTime(0.0001, when)
  og.gain.exponentialRampToValueAtTime(0.17, when + 0.008)
  og.gain.exponentialRampToValueAtTime(0.0001, when + 0.2)
  o.connect(og); og.connect(dest)
  o.start(when); o.stop(when + 0.25)
  running.add(o); o.onended = () => running.delete(o)

  // paper leaving the tube
  const { g: pg } = noiseSource(when + 0.02, 0.7, null)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.9
  pg.gain.setValueAtTime(0.0001, when + 0.02)
  pg.gain.exponentialRampToValueAtTime(0.07, when + 0.06)
  pg.gain.exponentialRampToValueAtTime(0.0001, when + 0.68)
  pg.connect(bp); bp.connect(dest)
}

/** Soft airy sweep. Optionally pans across the stage (the follow-spots). */
export function whoosh(when, dur = 0.9, panFrom = 0, panTo = 0) {
  if (!ctx) return
  const p = ctx.createStereoPanner()
  p.pan.setValueAtTime(panFrom, when)
  if (panFrom !== panTo) p.pan.linearRampToValueAtTime(panTo, when + dur)
  p.connect(program)
  const sg = ctx.createGain(); sg.gain.value = 0.15
  p.connect(sg); sg.connect(reverbIn)

  const { g } = noiseSource(when, dur, null)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'; bp.Q.value = 1.2
  bp.frequency.setValueAtTime(400, when)
  bp.frequency.exponentialRampToValueAtTime(3600, when + dur * 0.7)
  bp.frequency.exponentialRampToValueAtTime(600, when + dur)
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(0.2, when + dur * 0.5)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  g.connect(bp); bp.connect(p)
}
