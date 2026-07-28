/* Smoke-checks every route: skips the build-up, then asserts the page really
   rendered that clan's name, war cry and sections. Also checks a bad code. */
import puppeteer from 'puppeteer'

const OUT = process.argv[2]
const BASE = process.argv[3] || 'http://localhost:4317'

/* [code, clan, audience, expected leader count, expected pointers per leader]
   Vijaya has a Chief only. Pointer counts are spelled out per clan rather than
   asserted as "always 5", so Rajputana's Deputy carrying a sixth is a stated
   fact the test knows about - and any OTHER leader gaining or losing a line
   still fails, which a loosened `n === 5 || n === 6` would have let through. */
/* Footer link count is the 5th field. Rajputana is the only clan with a
   LinkedIn page, so it shows 4 (clan Insta + clan LinkedIn + Life at RU + RU)
   and the rest show 3. Asserted per clan rather than "at least one", so a URL
   silently reverting to a placeholder is a failure rather than a quiet gap. */
const CASES = [
  ['3184', 'Rajputana', 'students', 2, [3, 6], 4],
  ['5027', 'Vijaya', 'students', 1, [5], 3],
  ['7362', 'Maratha', 'students', 2, [5, 5], 3],
  ['9415', 'Chola', 'students', 2, [5, 5], 3],
  ['2760', 'Rajputana', 'team', 2, [3, 6], 4],
  ['4839', 'Vijaya', 'team', 1, [5], 3],
  ['6193', 'Maratha', 'team', 2, [5, 5], 3],
  ['8524', 'Chola', 'team', 2, [5, 5], 3],
]

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
})

let failures = 0

for (const [code, expected, audience, wantLeaders, wantPoints, wantSocials] of CASES) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 860 })
  const bad = []
  page.on('pageerror', (e) => bad.push(e.message))
  page.on('response', (r) => { if (r.status() >= 400) bad.push(`HTTP ${r.status()} ${r.url()}`) })

  await page.goto(`${BASE}/r/${code}`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => document.querySelector('.begin')?.click())
  await new Promise((r) => setTimeout(r, 600))
  await page.evaluate(() => document.querySelector('.skip-btn')?.click())
  await new Promise((r) => setTimeout(r, 2600))

  const got = await page.evaluate(() => ({
    name: document.querySelector('.clan-name')?.getAttribute('aria-label') || '',
    cry: document.querySelector('.cry')?.textContent.trim() || '',
    /* Does the Devanagari actually render in Tiro? getComputedStyle reports
       the DECLARED stack, not the family the engine picked per glyph, so it
       says "Bodoni Moda" even when Bodoni has no such glyph - useless here.
       Measure instead: set the string in Tiro-then-serif and in serif alone.
       Different widths means Tiro is really being used; identical widths means
       it never loaded and the generic serif is doing the work. */
    cryFont: (() => {
      const el = document.querySelector('.cry')
      const txt = el?.textContent || ''
      const deva = [...txt].filter((c) => /[\u0900-\u097F]/.test(c)).join('')
      if (!deva) return 'latin-only'
      const ctx = document.createElement('canvas').getContext('2d')
      ctx.font = '40px "Tiro Devanagari Hindi", serif'
      const withTiro = ctx.measureText(deva).width
      ctx.font = '40px serif'
      const withGeneric = ctx.measureText(deva).width
      return Math.abs(withTiro - withGeneric) > 0.5 ? 'Tiro' : 'FALLBACK'
    })(),
    leaders: document.querySelectorAll('.leader-card').length,
    socials: document.querySelectorAll('.social-card').length,
    socialsSection: !!document.querySelector('.social-grid'),
    points: [...document.querySelectorAll('.leader-card')].map((c) => c.querySelectorAll('.leader-points li').length),
    roles: [...document.querySelectorAll('.role-chip')].map((c) => c.textContent),
    // emphasised phrases per leader - the brief is a minimum of two each
    emph: [...document.querySelectorAll('.leader-card')]
      .map((c) => c.querySelectorAll('.leader-points strong').length),
    // an unbalanced ** never matches the split, so it survives to the screen as
    // literal asterisks. Cheap to typo, impossible to miss once asserted.
    markerLeak: [...document.querySelectorAll('.leader-points')]
      .some((u) => u.textContent.includes('*')),
    leadersSub: document.querySelector('.section-head p')?.textContent.trim() || '',
    /* Every anchor on the page must go somewhere real. '#' is truthy, so a
       placeholder that slipped past the isReal() guards would render as a
       button that silently does nothing - the one failure mode this section
       has hit before. Checked on the DOM, so it covers leader icons and footer
       cards at once, whatever the data says. */
    deadLinks: [...document.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href'))
      .filter((h) => !h || h === '#' || h.trim() === '' || /^javascript:/i.test(h)),
    leaderLinks: [...document.querySelectorAll('.leader-card')]
      .map((c) => c.querySelectorAll('.leader-links a').length),
    photos: (() => {
      const imgs = [...document.querySelectorAll('.leader-photo')]
      if (!imgs.length) return ''
      const ok = imgs.filter((i) => i.complete && i.naturalWidth > 0).length
      return `${ok}/${imgs.length}`
    })(),
    photosOk: [...document.querySelectorAll('.leader-photo')]
      .every((i) => i.complete && i.naturalWidth > 0),
    crestOk: (() => {
      const i = document.querySelector('.crest')
      return !!i && i.complete && i.naturalWidth > 0
    })(),
    // crest must sit on the page's centre line, not drift left
    crestOffset: (() => {
      const r = document.querySelector('.crest')?.getBoundingClientRect()
      if (!r) return 999
      return Math.abs((r.left + r.width / 2) - window.innerWidth / 2)
    })(),
    title: document.title,
  }))

  const ok =
    got.name === expected &&
    got.leaders === wantLeaders &&
    got.socialsSection &&
    got.crestOk &&
    got.photosOk &&   // any portrait that is set must actually have loaded

    got.crestOffset < 2 &&
    got.points.join() === wantPoints.join() &&
    got.emph.every((n) => n >= 2) &&
    got.socials === wantSocials &&
    got.deadLinks.length === 0 &&
    !got.markerLeak &&
    got.roles[0] === 'Chief' &&
    got.cry.length > 2 &&
    got.cryFont !== 'FALLBACK' &&
    bad.length === 0

  if (!ok) failures++
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  /r/${code}  ${audience.padEnd(8)} -> ${got.name.padEnd(10)}` +
    ` cry:"${got.cry}"[${got.cryFont}] crest:${got.crestOk ? "ok" : "MISSING"}@${got.crestOffset.toFixed(0)}px leaders:${got.leaders}(${got.roles.join('/')}) pts:${got.points.join(',')} emph:${got.emph.join(',')}${got.markerLeak ? '(LEAK)' : ''} socials:${got.socials}/${wantSocials} leaderLinks:${got.leaderLinks.join(',')}${got.photos ? ' photos:' + got.photos : ''}` +
    (got.deadLinks.length ? `\n      DEAD LINKS: ${got.deadLinks.join(' | ')}` : '') +
    (bad.length ? `\n      issues: ${bad.join(' | ')}` : '')
  )

  if (code === '3184' || code === '9415') {
    await page.screenshot({ path: `${OUT}/clan-${expected.toLowerCase()}.png` })
  }
  await page.close()
}

// unknown code should land on the friendly not-found, not a blank screen
const p = await browser.newPage()
await p.setViewport({ width: 1280, height: 860 })
await p.goto(`${BASE}/r/0000`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 500))
const nf = await p.evaluate(() => document.querySelector('.notfound h1')?.textContent || '')
console.log(nf ? `PASS  /r/0000 -> "${nf}"` : 'FAIL  /r/0000 rendered nothing')
if (!nf) failures++
await p.screenshot({ path: `${OUT}/notfound.png` })
await p.close()

// mobile
const m = await browser.newPage()
await m.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true })
await m.goto(`${BASE}/r/7362`, { waitUntil: 'networkidle2' })
await m.screenshot({ path: `${OUT}/mobile-gate.png` })
await m.evaluate(() => document.querySelector('.begin')?.click())
await new Promise((r) => setTimeout(r, 600))
await m.evaluate(() => document.querySelector('.skip-btn')?.click())
await new Promise((r) => setTimeout(r, 2800))
const overflow = await m.evaluate(() => {
  const el = document.querySelector('.clan-name')
  const cs = getComputedStyle(el)
  return {
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    // one line only: the block must be no taller than a single line box
    nameH: el.getBoundingClientRect().height,
    lineH: parseFloat(cs.fontSize) * 0.95,
    nameW: el.getBoundingClientRect().width,
  }
})
const noOverflow = overflow.scrollW <= overflow.clientW + 1
const oneLine = overflow.nameH <= overflow.lineH * 1.35
console.log(`${noOverflow ? 'PASS' : 'FAIL'}  mobile 390px horizontal overflow: ${overflow.scrollW} vs ${overflow.clientW}`)
console.log(`${oneLine ? 'PASS' : 'FAIL'}  mobile clan name on one line (h=${overflow.nameH.toFixed(0)} line=${overflow.lineH.toFixed(0)} w=${overflow.nameW.toFixed(0)})`)
if (!noOverflow) failures++
if (!oneLine) failures++
await m.screenshot({ path: `${OUT}/mobile-hero.png` })
await m.close()

// Toggling mute must NOT restart the sequence. An unstable clan/callback
// identity once re-ran RevealSequence's scheduling effect: timers were cleared
// and re-armed, but already-scheduled Web Audio could not be, so the entire
// soundtrack played twice, overlapping itself.
{
  const g = await browser.newPage()
  await g.setViewport({ width: 1280, height: 800 })
  await g.goto(`${BASE}/r/3184`, { waitUntil: 'networkidle2' })
  await g.evaluate(() => document.querySelector('.begin')?.click())
  await new Promise((r) => setTimeout(r, 10000))
  await g.evaluate(() => document.querySelector('.mute-btn')?.click())
  await new Promise((r) => setTimeout(r, 1200))
  await g.evaluate(() => document.querySelector('.mute-btn')?.click())
  await new Promise((r) => setTimeout(r, 5800))
  // ~17s in: we must be mid-countdown with exactly one card on screen,
  // not back at the opening titles with cards piled up
  const st = await g.evaluate(() => ({
    count: document.querySelector('.count-number')?.textContent || null,
    slots: document.querySelectorAll('.buildup-slot').length,
  }))
  const ok = !!st.count && st.slots === 1
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  mute toggle mid-sequence does not restart` +
    `  (count:${st.count} slots:${st.slots})`)
  await g.close()
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall routes pass')
await browser.close()
process.exit(failures ? 1 : 0)
