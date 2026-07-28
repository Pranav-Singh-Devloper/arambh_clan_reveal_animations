import confetti from 'canvas-confetti'
import * as A from '../audio/engine'

const MOBILE =
  typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches

// mobile gets ~60% of the particles - the celebration, not the jank
const N = (n) => Math.round(MOBILE ? n * 0.6 : n)

/* Compressed-air confetti cannons from the bottom corners, then a wide
   overhead shower. Scheduled 30ms in the future: at exactly now() the attack
   ramp is already in the past and the burst degrades to a click. */
export function fireCannons(colors, { soft = false } = {}) {
  const base = {
    particleCount: N(soft ? 30 : 60), spread: 55, startVelocity: soft ? 30 : 54,
    ticks: 320, zIndex: 92, colors, scalar: 0.8, gravity: 0.9,
  }

  confetti({ ...base, origin: { x: 0, y: 0.85 }, angle: 58 })
  confetti({ ...base, origin: { x: 1, y: 0.85 }, angle: 122 })
  if (A.isReady()) {
    A.airCannon(A.now() + 0.03, -0.7)
    A.airCannon(A.now() + 0.09, 0.7)
  }
  if (soft) return

  setTimeout(() => {
    confetti({
      particleCount: N(90), spread: 120, startVelocity: 34, ticks: 380,
      origin: { x: 0.5, y: 0.24 }, zIndex: 92, colors, scalar: 0.85, gravity: 0.8,
    })
    if (A.isReady()) A.airCannon(A.now() + 0.03, 0)
  }, 260)

  setTimeout(() => {
    confetti({ ...base, particleCount: N(70), origin: { x: 0.16, y: 0.75 }, angle: 70 })
    confetti({ ...base, particleCount: N(70), origin: { x: 0.84, y: 0.75 }, angle: 110 })
    if (A.isReady()) A.airCannon(A.now() + 0.03, 0.4)
  }, 620)
}

/* Slow drifting paper that keeps the celebration alive for a few seconds. */
export function sustainedShower(colors, ms = 4200) {
  const end = Date.now() + ms
  const tick = () => {
    if (Date.now() > end || document.hidden) return
    confetti({
      particleCount: 2, startVelocity: 0, ticks: 340, gravity: 0.34,
      origin: { x: Math.random(), y: -0.05 }, colors, zIndex: 91,
      scalar: 0.5 + Math.random() * 0.4, shapes: ['square'],
      drift: (Math.random() - 0.5) * 1.2,
    })
    requestAnimationFrame(tick)
  }
  tick()
}
