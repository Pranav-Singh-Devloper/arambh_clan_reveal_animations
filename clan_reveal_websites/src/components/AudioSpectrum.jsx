import { useEffect, useRef } from 'react'
import * as A from '../audio/engine'

/* ===========================================================================
   Beat-reactive spectrum, drawn on one canvas.

   Design intent: at silence it must read as a hairline rule - the same
   typographic device used throughout the page - and the bars grow out of it.
   A widget that looks like a broken media player when nothing is playing would
   undo the rest of the design.

   - Bars are LOG-spaced across 40 Hz - 12 kHz. Linear bin mapping crams all
     the visible movement into the left eighth of the display, which is the
     usual reason home-made visualisers look wrong.
   - Peak caps fall slowly for legibility at a glance.
   - A separate bass-energy envelope (40-160 Hz) drives the baseline glow, so
     the kick is visible as well as audible.
   - The analyser is tapped after the master gain, so muting flattens it.
   =========================================================================== */

const F_MIN = 40
const F_MAX = 12000

export default function AudioSpectrum({ color, className = '' }) {
  const canvasRef = useRef(null)
  const raf = useRef(0)
  const peaks = useRef(null)
  const bass = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let w = 0, h = 0, bars = 0, edges = null
    /* Reused across frames. This was allocated inside draw(), which is a 1 KB
       Uint8Array every frame - 60/s, and there are two of these on the page
       now that other-leads also draws one. Pure garbage for the collector to
       sweep during the one animation that must not stutter. */
    let data = null

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      // clientWidth/Height, NOT getBoundingClientRect: the wrapper animates in
      // with scaleX(0.4), and a rect measured through that transform sizes the
      // backing store to 40% and never corrects itself (ResizeObserver does not
      // fire for transforms, only for layout).
      w = Math.max(1, canvas.clientWidth)
      h = Math.max(1, canvas.clientHeight)
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)

      // ~7px per bar, clamped so phones do not draw hairline confetti
      bars = Math.max(18, Math.min(72, Math.floor(w / 7)))
      peaks.current = new Float32Array(bars)
      edges = null
    }
    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const draw = () => {
      raf.current = requestAnimationFrame(draw)
      if (document.hidden) return

      const analyser = A.getAnalyser()
      ctx2d.clearRect(0, 0, w, h)

      const base = h - 1                 // the hairline sits on the baseline
      const maxBar = h - 3
      const gap = 3
      const bw = Math.max(1.5, w / bars - gap)

      let level = 0

      if (analyser) {
        const bins = analyser.frequencyBinCount
        if (!data || data.length !== bins) data = new Uint8Array(bins)
        analyser.getByteFrequencyData(data)
        const nyquist = (A.context()?.sampleRate || 44100) / 2

        // log-spaced bin edges, computed once per size
        if (!edges) {
          edges = new Uint16Array(bars + 1)
          for (let i = 0; i <= bars; i++) {
            const f = F_MIN * Math.pow(F_MAX / F_MIN, i / bars)
            edges[i] = Math.min(bins - 1, Math.max(0, Math.round((f / nyquist) * bins)))
          }
        }

        // bass envelope for the baseline glow
        const bassTop = Math.max(1, Math.round((160 / nyquist) * bins))
        let bsum = 0
        for (let i = Math.round((40 / nyquist) * bins); i < bassTop; i++) bsum += data[i]
        const bNow = bsum / Math.max(1, bassTop) / 255
        // fast attack, slow release - a kick should snap and then breathe out
        bass.current = bNow > bass.current
          ? bass.current + (bNow - bass.current) * 0.55
          : bass.current + (bNow - bass.current) * 0.08
        level = bass.current

        for (let i = 0; i < bars; i++) {
          let peak = 0
          const from = edges[i]
          const to = Math.max(from + 1, edges[i + 1])
          for (let j = from; j < to; j++) if (data[j] > peak) peak = data[j]

          // gentle high-frequency lift: music rolls off up top, and a display
          // that droops to the right looks broken rather than accurate
          const tilt = 1 + Math.pow(i / bars, 1.35) * 1.5
          let v = Math.min(1, (peak / 255) * tilt)
          if (reduced) v *= 0.25

          const x = i * (w / bars) + gap / 2
          const bh = Math.max(0, v * maxBar)

          if (bh > 0.8) {
            const grad = ctx2d.createLinearGradient(0, base - bh, 0, base)
            grad.addColorStop(0, hexA(color, 0.15))
            grad.addColorStop(1, hexA(color, 0.85))
            ctx2d.fillStyle = grad
            round(ctx2d, x, base - bh, bw, bh, Math.min(bw / 2, 1.5))
            ctx2d.fill()
          }

          // peak caps
          const p = peaks.current
          p[i] = v > p[i] ? v : Math.max(0, p[i] - 0.012)
          if (p[i] > 0.04) {
            ctx2d.fillStyle = hexA(color, 0.5)
            ctx2d.fillRect(x, base - p[i] * maxBar - 1, bw, 1)
          }
        }
      }

      // the baseline: a hairline rule that brightens with the kick
      ctx2d.fillStyle = hexA(color, 0.22 + level * 0.5)
      ctx2d.fillRect(0, base, w, 1)

      if (level > 0.02) {
        const g = ctx2d.createLinearGradient(0, base - 22, 0, base)
        g.addColorStop(0, hexA(color, 0))
        g.addColorStop(1, hexA(color, level * 0.16))
        ctx2d.fillStyle = g
        ctx2d.fillRect(0, base - 22, w, 22)
      }
    }
    raf.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf.current)
      ro.disconnect()
    }
  }, [color])

  return <canvas ref={canvasRef} className={`spectrum ${className}`} aria-hidden="true" />
}

function round(c, x, y, w, h, r) {
  c.beginPath()
  if (c.roundRect) c.roundRect(x, y, w, h, r)
  else c.rect(x, y, w, h)
}

function hexA(hex, a) {
  const h = (hex || '#888').replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
