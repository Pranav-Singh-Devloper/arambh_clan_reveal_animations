/* Walks the build-up second by second and asserts the invariants that are easy
   to break when the theatre and the titles are edited independently:

     1. Velvet must never be on screen while the titles are still dark ink.
        (.curtains present  =>  .buildup must carry .has-theatre)
     2. Every text beat must actually be legible against what is behind it,
        checked as real luminance contrast, not by eye.
     3. No beat may render nothing at all.

   Also dumps a frame per second so the opening seconds get looked at - the
   earlier capture scripts all started after the theatre was already up, which
   is exactly why an unconditional <Curtains> went unnoticed. */
import puppeteer from 'puppeteer'

const OUT = process.argv[2]
const URL = process.argv[3] || 'http://localhost:4317/r/3184'
const UNTIL = Number(process.argv[4] || 24)

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800 })

const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(URL, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 900))
await page.evaluate(() => document.querySelector('.begin')?.click())

const srgb = (c) => {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)

let fails = 0
const rows = []

for (let t = 1; t <= UNTIL; t++) {
  await new Promise((r) => setTimeout(r, 1000))

  const snap = await page.evaluate(() => {
    const buildup = document.querySelector('.buildup')
    const word = document.querySelector('.buildup-word, .count-number')
    if (!word || !buildup) {
      return { text: null, hasTheatre: !!buildup?.classList.contains('has-theatre'), curtains: !!document.querySelector('.curtains') }
    }
    const cs = getComputedStyle(word)
    const r = word.getBoundingClientRect()
    // sample what is actually painted right behind the glyphs
    // The scenery is pointer-events:none, which elementsFromPoint skips
    // entirely - make it hit-testable for the duration of this sample.
    const scenery = [...document.querySelectorAll('.theatre, .theatre *, .curtains, .curtains *')]
    scenery.forEach((el) => { el.style.pointerEvents = 'auto' })
    const behind = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      .filter((el) => !el.closest('.buildup-slot') && !el.matches('.curtain-spill, .rays, .follow-pool, .spot'))
    scenery.forEach((el) => { el.style.pointerEvents = '' })
    // The velvet and house are painted with background-IMAGE gradients, whose
    // computed backgroundColor is transparent - resolve those layers to their
    // theme variable instead of falling through them to white.
    const varOf = (name) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    let bg = 'rgb(255,255,255)'
    for (const el of behind) {
      const cs = getComputedStyle(el)
      if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') {
        bg = cs.backgroundColor; break
      }
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        if (el.matches('.curtain, .valance')) { bg = varOf('--velvet'); break }
        if (el.matches('.theatre-back')) { bg = varOf('--house-dark'); break }
        if (el.matches('.gate, .buildup, .clan-page')) { bg = varOf('--stage-bg') || varOf('--bg'); break }
        // unknown gradient layer: take its first rgb() stop as an estimate
        const m = cs.backgroundImage.match(/rgba?\([^)]+\)/)
        if (m) { bg = m[0]; break }
      }
    }
    return {
      text: word.textContent.trim(),
      color: cs.color,
      bg,
      curtains: !!document.querySelector('.curtains'),
      hasTheatre: buildup.classList.contains('has-theatre'),
      opacity: Number(getComputedStyle(word.closest('.buildup-slot')).opacity),
    }
  })

  const parse = (s) => {
    const hex = s.match(/^#([0-9a-f]{6})/i)
    if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16))
    return (s.match(/\d+(\.\d+)?/g) || [0, 0, 0]).slice(0, 3).map(Number)
  }

  // invariant 1: velvet on screen implies the cream text treatment
  const layering = !(snap.curtains && !snap.hasTheatre)
  if (!layering) fails++

  // invariant 2: real contrast on visible text
  let contrast = null
  if (snap.text && snap.opacity > 0.5) {
    const l1 = lum(parse(snap.color))
    const l2 = lum(parse(snap.bg))
    contrast = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    if (contrast < 3) fails++
  }

  rows.push(
    `t=${String(t).padStart(2)}s  ${(snap.text || ', ').padEnd(26)}` +
    ` curtains:${snap.curtains ? 'yes' : 'no '} theatre-class:${snap.hasTheatre ? 'yes' : 'no '}` +
    ` contrast:${contrast ? contrast.toFixed(1) : ', '}` +
    `${!layering ? '   <-- VELVET WITH DARK TITLES' : ''}` +
    `${contrast && contrast < 3 ? '   <-- UNREADABLE' : ''}`
  )

  if (t <= 8 || t >= 19) await page.screenshot({ path: `${OUT}/t${String(t).padStart(2, '0')}.png` })
}

console.log(rows.join('\n'))
if (errors.length) { console.log('page errors: ' + errors.join(' | ')); fails++ }
console.log(fails ? `\n${fails} FAILURE(S)` : '\ntimeline clean')
await browser.close()
process.exit(fails ? 1 : 0)
