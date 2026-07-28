/* Pre-deploy audit. Run this last, against a production build.
 *
 *   npm run build && npx vite preview --port 4317 &
 *   node scripts/deploycheck.mjs                     # or pass the live URL
 *
 * checkall.mjs asks "does it work" and content-check.mjs asks "is it finished".
 * This one asks "will it hold up on the day": it plays every route through the
 * full 22-second build-up with no skipping and records what a first-time
 * visitor actually gets - dropped frames, when the crest and the ~890 KB music
 * bed really arrive relative to the moment they are needed, every failed
 * request, every console error, and every href on the page. Then it exercises
 * the paths people take that are not the happy one.
 *
 * WHAT IT CANNOT TELL YOU: whether an Instagram or LinkedIn profile actually
 * exists. Both serve a 200 and an identical logged-out shell for a real handle,
 * a deleted one and a handle that was never registered - verified against a
 * nonsense control handle, same status and same byte count to within 30 bytes.
 * Dead hrefs ('#', empty) ARE caught here. Whether a live URL points at the
 * right human is a click-through job, not a script.
 */
import puppeteer from 'puppeteer'

const BASE = process.argv[2] || 'http://localhost:4317'
const ROUTES = [
  ['3184', 'Rajputana'], ['5027', 'Vijaya'], ['7362', 'Maratha'], ['9415', 'Chola'],
  ['2760', 'Rajputana'], ['4839', 'Vijaya'], ['6193', 'Maratha'], ['8524', 'Chola'],
]
const REVEAL_AT = 22.5   // RevealSequence T.done

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
})

const allLinks = new Set()
let failures = 0

for (const [code, clan] of ROUTES) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  const errs = [], reqFail = []
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  page.on('requestfailed', (r) => reqFail.push(`${r.failure()?.errorText} ${r.url()}`))
  page.on('response', (r) => { if (r.status() >= 400) reqFail.push(`HTTP ${r.status()} ${r.url()}`) })

  await page.goto(`${BASE}/r/${code}`, { waitUntil: 'networkidle2' })

  // frame timing across the WHOLE sequence, sampled in-page
  await page.evaluate(() => {
    window.__frames = []
    let last = performance.now()
    const tick = (t) => { window.__frames.push(t - last); last = t; requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
    window.__long = []
    new PerformanceObserver((l) => window.__long.push(...l.getEntries().map((e) => Math.round(e.duration))))
      .observe({ entryTypes: ['longtask'] })
    window.__t0 = performance.now()
  })

  await page.evaluate(() => document.querySelector('.begin')?.click())
  await new Promise((r) => setTimeout(r, (REVEAL_AT + 8) * 1000))

  const m = await page.evaluate(() => {
    const f = window.__frames.slice(5)
    f.sort((a, b) => a - b)
    const at = (p) => f[Math.floor(f.length * p)] || 0
    const res = performance.getEntriesByType('resource')
    const find = (re) => {
      const e = res.find((r) => re.test(r.name))
      return e ? { start: +(e.startTime / 1000).toFixed(1), end: +(e.responseEnd / 1000).toFixed(1),
                   kb: Math.round((e.encodedBodySize || e.transferSize || 0) / 1024) } : null
    }
    const crestImg = document.querySelector('.crest')
    return {
      frames: f.length,
      p50: +at(0.5).toFixed(1), p95: +at(0.95).toFixed(1), worst: +f[f.length - 1].toFixed(0),
      dropped: f.filter((d) => d > 33).length,      // missed at least one 60fps frame
      stalls: f.filter((d) => d > 100).length,      // visible hitch
      longTasks: window.__long.filter((d) => d > 50).length,
      worstLongTask: Math.max(0, ...window.__long),
      crest: find(/crest|\.jpe?g/i),
      crestOk: !!crestImg && crestImg.complete && crestImg.naturalWidth > 0,
      music: find(/\.mp3/i),
      font: find(/fonts\.gstatic/i),
      links: [...document.querySelectorAll('a[href]')].map((a) => a.href),
      dead: [...document.querySelectorAll('a[href]')]
        .map((a) => a.getAttribute('href'))
        .filter((h) => !h || h === '#' || !h.trim()),
      spectrumLive: (() => {
        const c = document.querySelector('canvas')
        return !!c && c.width > 0 && c.height > 0
      })(),
    }
  })
  m.links.forEach((l) => allLinks.add(l))

  const ok = !errs.length && !reqFail.length && !m.dead.length && m.crestOk && m.stalls === 0
  if (!ok) failures++
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  /r/${code} ${clan.padEnd(10)}` +
    ` frames:${m.frames} p50:${m.p50}ms p95:${m.p95}ms worst:${m.worst}ms` +
    ` dropped:${m.dropped} stalls>100ms:${m.stalls} longTasks:${m.longTasks}(max ${m.worstLongTask}ms)`)
  console.log(`        crest ${m.crestOk ? 'ok' : 'MISSING'}` +
    (m.crest ? ` ${m.crest.kb}KB  ${m.crest.start}s -> ${m.crest.end}s (reveal at ${REVEAL_AT}s)` : '') +
    (m.music ? `   music ${m.music.kb}KB  ${m.music.start}s -> ${m.music.end}s` : '   music NOT REQUESTED'))
  if (errs.length) console.log('        ERRORS: ' + errs.join(' | '))
  if (reqFail.length) console.log('        REQUEST FAILURES: ' + reqFail.join(' | '))
  if (m.dead.length) console.log('        DEAD LINKS: ' + m.dead.join(' | '))
  await page.close()
}

/* The paths that are not the happy path. Each of these has broken before. */
console.log('\n--- alternate paths ---')
const path = async (name, fn, expect) => {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  const bag = []
  page.on('pageerror', (e) => bag.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') bag.push('console: ' + m.text()) })
  const got = await fn(page)
  const ok = expect(got) && !bag.length
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(38)} ${JSON.stringify(got)}` +
    (bag.length ? `  ERRORS: ${bag.join(' | ')}` : ''))
  await page.close()
}
const state = (p) => p.evaluate(() => ({
  gate: !!document.querySelector('.begin'),
  buildup: !!document.querySelector('.stage'),
  hero: !!document.querySelector('.hero'),
  clan: document.querySelector('.clan-name')?.getAttribute('aria-label') || null,
  leaders: document.querySelectorAll('.leader-card').length,
}))

await path('prefers-reduced-motion', async (p) => {
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await p.goto(`${BASE}/r/7362`, { waitUntil: 'networkidle2' })
  await p.evaluate(() => document.querySelector('.begin').click())
  await new Promise((r) => setTimeout(r, 3500))
  return state(p)
}, (s) => s.hero && !s.buildup && s.clan === 'Maratha' && s.leaders === 2)

await path('skip button mid-sequence', async (p) => {
  await p.goto(`${BASE}/r/5027`, { waitUntil: 'networkidle2' })
  await p.evaluate(() => document.querySelector('.begin').click())
  await new Promise((r) => setTimeout(r, 7000))
  await p.evaluate(() => document.querySelector('.skip-btn')?.click())
  await new Promise((r) => setTimeout(r, 3000))
  return state(p)
}, (s) => s.hero && !s.buildup && s.clan === 'Vijaya')

await path('unknown code', async (p) => {
  await p.goto(`${BASE}/r/0000`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1200))
  return { msg: await p.evaluate(() => document.querySelector('.notfound h1')?.textContent || '') }
}, (s) => s.msg.length > 5)

await path('mute toggled 6x mid-sequence', async (p) => {
  await p.goto(`${BASE}/r/9415`, { waitUntil: 'networkidle2' })
  await p.evaluate(() => document.querySelector('.begin').click())
  await new Promise((r) => setTimeout(r, 4000))
  for (let i = 0; i < 6; i++) {
    await p.evaluate(() => document.querySelector('.mute-btn')?.click())
    await new Promise((r) => setTimeout(r, 250))
  }
  await new Promise((r) => setTimeout(r, 1500))
  return state(p)
}, (s) => s.buildup)   // must still be running, not restarted or dead

/* Leaving mid-reveal and coming back restores from bfcache into whatever stage
   the sequence had reached. It must go on to finish rather than sit frozen on
   a half-open curtain. Audio scheduled during the frozen window is lost - the
   visuals are what has to survive. */
await path('back-navigation resumes and finishes', async (p) => {
  await p.goto(`${BASE}/r/8524`, { waitUntil: 'networkidle2' })
  await p.evaluate(() => document.querySelector('.begin').click())
  await new Promise((r) => setTimeout(r, 6000))
  await p.goto(`${BASE}/r/3184`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 2000))
  await p.goBack({ waitUntil: 'networkidle2' })
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const s = await state(p)
    if (s.hero) return { ...s, recoveredAfterSec: (i + 1) * 3 }
  }
  return state(p)
}, (s) => s.hero && s.clan === 'Chola')

await browser.close()
console.log(`\n--- ${allLinks.size} distinct outbound links ---`)
;[...allLinks].sort().forEach((l) => console.log('  ' + l))
console.log('  (status codes prove these are well-formed, not that the profiles exist -')
console.log('   Instagram and LinkedIn both block server-side verification. Click them.)')
console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks clean')
process.exit(failures ? 1 : 0)
