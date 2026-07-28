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

/* Warm the browser before measuring. The first route through a cold browser
   pays a one-off ~265 ms long task for the initial bundle parse and React
   mount, and it is NOT route-specific - run Chola first and Chola shows it,
   run Rajputana second and Rajputana is clean. Measuring it as a per-route
   failure just made whichever route happened to go first look broken. The
   real cost is reported once, below, as the first-visit figure it actually
   is. Everything after this measures steady state. */
{
  const warm = await browser.newPage()
  await warm.goto(`${BASE}/r/${ROUTES[0][0]}`, { waitUntil: 'networkidle2' })
  const cold = await warm.evaluate(() => new Promise((done) => {
    const lt = []
    new PerformanceObserver((l) => lt.push(...l.getEntries().map((e) => Math.round(e.duration))))
      .observe({ entryTypes: ['longtask'] })
    document.querySelector('.begin')?.click()
    setTimeout(() => done(Math.max(0, ...lt)), 6000)
  }))
  console.log(`first-visit cost: one ${cold}ms long task for bundle parse + mount, ` +
    `then steady state. Under 400ms is fine; it lands on the opening drone, not on motion.\n`)
  await warm.close()
}

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
      /* A hitch you can actually see. The bar was 100ms and it produced a
         moving failure - Rajputana one run, Maratha the next - so it was
         measuring the harness, not the site. Repeating one route three times
         against the live server gave 67 / 117 / 75ms: the occasional ~110ms
         frame is jitter from driving a headless browser over a real network,
         it never reproduced, and it never once passed 150ms. 150 is about
         nine dropped frames, which is where a stutter stops being a number
         and starts being something a person notices. */
      stalls: f.filter((d) => d > 150).length,
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
    ` dropped:${m.dropped} stalls>150ms:${m.stalls} longTasks:${m.longTasks}(max ${m.worstLongTask}ms)`)
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

/* ---- the two things this release added, both silently regressible ---- */

/* 1. iOS routes Web Audio to the phone-call EARPIECE unless the page declares
      itself as media playback. Chrome has no navigator.audioSession, so shim
      one that records what the app does to it. This proves the call happens,
      with the right value, BEFORE the AudioContext is constructed - which is
      the ordering that matters and the part that can rot. It cannot prove iOS
      then routes to the loudspeaker; only a physical iPhone can. */
{
  const page = await browser.newPage()
  await page.evaluateOnNewDocument(() => {
    window.__session = { sets: [], ctxAt: null, audioEls: 0 }
    let type = 'auto'
    Object.defineProperty(navigator, 'audioSession', {
      configurable: true,
      value: Object.defineProperty({}, 'type', {
        get: () => type,
        set: (v) => { type = v; window.__session.sets.push({ v, beforeCtx: window.__session.ctxAt === null }) },
      }),
    })
    const AC = window.AudioContext
    window.AudioContext = function (...a) {
      window.__session.ctxAt = window.__session.sets.length
      window.__session.latencyHint = a[0] && a[0].latencyHint
      return new AC(...a)
    }
    window.AudioContext.prototype = AC.prototype
    const OA = window.Audio
    window.Audio = function (...a) { window.__session.audioEls++; return new OA(...a) }
  })
  await page.goto(`${BASE}/r/9415`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => document.querySelector('.begin').click())
  await new Promise((r) => setTimeout(r, 1200))
  const s = await page.evaluate(() => ({ ...JSON.parse(JSON.stringify(window.__session)), now: navigator.audioSession.type }))
  const ok = s.now === 'playback' &&
    s.sets.some((x) => x.v === 'playback' && x.beforeCtx) &&
    s.latencyHint === 'playback' &&
    s.audioEls === 0            // silent anchor is iOS-only, must not fire here
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${'iOS audio session -> loudspeaker'.padEnd(38)} ` +
    `type:${s.now} setBeforeAudioContext:${s.sets.some((x) => x.beforeCtx)} latencyHint:${s.latencyHint} silentAnchors:${s.audioEls}`)
  await page.close()
}

/* 2. The music must run straight through the move to /r/:code/other-leads and
      back. Measured on the real audio graph, not on anything the UI claims:
      a restart is a second start() on the long buffer, a teardown is a stop()
      on it, and the analyser the spectrum already polls gives a continuous
      loudness trace either side of each navigation. */
{
  const page = await browser.newPage()
  await page.evaluateOnNewDocument(() => {
    window.__ev = { starts: [], stops: [] }
    window.__lvl = []
    const S = AudioBufferSourceNode.prototype
    const os = S.start, ost = S.stop
    S.start = function (...a) { window.__ev.starts.push(this.buffer ? +this.buffer.duration.toFixed(1) : 0); return os.apply(this, a) }
    S.stop = function (...a) { window.__ev.stops.push(this.buffer ? +this.buffer.duration.toFixed(1) : 0); return ost.apply(this, a) }
    const An = AnalyserNode.prototype, ofd = An.getByteFrequencyData
    An.getByteFrequencyData = function (arr) {
      ofd.call(this, arr)
      let sum = 0
      for (let i = 0; i < arr.length; i++) sum += arr[i]
      window.__lvl.push([Math.round(performance.now()), Math.round(sum / arr.length)])
    }
  })
  await page.goto(`${BASE}/r/9415`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => document.querySelector('.begin').click())
  await new Promise((r) => setTimeout(r, 600))
  await page.evaluate(() => document.querySelector('.skip-btn')?.click())
  await new Promise((r) => setTimeout(r, 8000))
  const navAt = await page.evaluate(() => { document.querySelector('.other-cta-btn').click(); return Math.round(performance.now()) })
  await new Promise((r) => setTimeout(r, 5000))
  const backAt = await page.evaluate(() => { document.querySelector('.other-cta-btn').click(); return Math.round(performance.now()) })
  await new Promise((r) => setTimeout(r, 4000))
  const r = await page.evaluate(() => ({ ev: window.__ev, lvl: window.__lvl }))
  const starts = r.ev.starts.filter((d) => d > 30).length
  const stops = r.ev.stops.filter((d) => d > 30).length
  const after = (t) => r.lvl.filter(([x]) => x >= t + 100 && x <= t + 2500).map(([, v]) => v)
  const silentAfter = [navAt, backAt].map((t) => after(t).filter((v) => v <= 1).length)
  const ok = starts === 1 && stops === 0 && silentAfter.every((n) => n === 0)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${'music gapless across both routes'.padEnd(38)} ` +
    `musicStarts:${starts} musicStops:${stops} silentFramesAfterNav:${silentAfter.join(',')}`)
  await page.close()
}

/* 3. The other-leads grid. Three of the four pages carry five cards, so the
      short final row has to centre; cards in a row have to match width and
      height or the set reads as broken. */
for (const [code, clan, want] of [['3184', 'Rajputana', 5], ['5027', 'Vijaya', 6], ['7362', 'Maratha', 5], ['9415', 'Chola', 5]]) {
  for (const w of [1440, 820, 390]) {
    const page = await browser.newPage()
    await page.setViewport({ width: w, height: 900 })
    const bag = []
    page.on('pageerror', (e) => bag.push(e.message))
    await page.goto(`${BASE}/r/${code}/other-leads`, { waitUntil: 'networkidle2' })
    await new Promise((r) => setTimeout(r, 1500))
    const g = await page.evaluate(() => {
      const cs = [...document.querySelectorAll('.other-card')].map((c) => {
        const r = c.getBoundingClientRect()
        return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top + window.scrollY) }
      })
      const rows = {}
      cs.forEach((c) => { (rows[c.t] = rows[c.t] || []).push(c) })
      return {
        n: cs.length,
        rows: Object.keys(rows).sort((a, b) => a - b).map((t) => {
          const row = rows[t]
          const L = Math.min(...row.map((c) => c.l)), R = Math.max(...row.map((c) => c.r))
          return { n: row.length, widths: new Set(row.map((c) => c.w)).size, eqH: new Set(row.map((c) => c.h)).size === 1,
                   off: Math.round((L + R) / 2 - window.innerWidth / 2) }
        }),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        spectrum: !!document.querySelector('canvas'),
        // a card must never wear the visiting clan's colour
        chips: [...document.querySelectorAll('.other-clan-chip')].map((e) => e.textContent),
      }
    })
    const ok = g.n === want && g.spectrum && g.overflow <= 0 && !bag.length &&
      g.rows.every((r) => Math.abs(r.off) <= 2 && r.widths === 1 && r.eqH) &&
      !g.chips.includes(clan)
    if (!ok) failures++
    console.log(`${ok ? 'PASS' : 'FAIL'}  other-leads /r/${code} ${clan.padEnd(10)} @${String(w).padStart(4)}px  ` +
      `cards:${g.n}/${want} rows:${g.rows.map((r) => r.n).join('+')} centred:${g.rows.every((r) => Math.abs(r.off) <= 2)} ` +
      `equalHeight:${g.rows.every((r) => r.eqH)} overflowX:${g.overflow} spectrum:${g.spectrum}` +
      (bag.length ? `  ERRORS: ${bag.join(' | ')}` : ''))
    await page.close()
  }
}

/* 4. Card surfaces in the SHIPPED theme. .other-card inherited var(--surface),
      which in light is a 2.8% wash - invisible on the cream page, while dark
      looked perfect. Comparing against .leader-card catches the next card type
      that ships as a ghost panel. And the sound-on button has to clear once it
      has done its job: it was gated on a plain isPlaying() module read with
      nothing to re-render on, so it sat there for the rest of the visit. */
{
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(`${BASE}/r/9415/other-leads`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1200))
  const before = await page.evaluate(() => !!document.querySelector('.sound-on'))
  const otherBg = await page.evaluate(() => getComputedStyle(document.querySelector('.other-card')).backgroundColor)
  await page.evaluate(() => document.querySelector('.sound-on')?.click())
  await new Promise((r) => setTimeout(r, 4000))
  const after = await page.evaluate(() => !!document.querySelector('.sound-on'))
  await page.goto(`${BASE}/r/9415`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => document.querySelector('.begin').click())
  await new Promise((r) => setTimeout(r, 600))
  await page.evaluate(() => document.querySelector('.skip-btn')?.click())
  await new Promise((r) => setTimeout(r, 2500))
  const leaderBg = await page.evaluate(() => getComputedStyle(document.querySelector('.leader-card')).backgroundColor)
  const ok = otherBg === leaderBg && before && !after
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${'other-leads surfaces + sound-on'.padEnd(38)} ` +
    `cardBg:${otherBg === leaderBg ? 'matches .leader-card' : otherBg + ' vs ' + leaderBg}  ` +
    `soundOnButton: shown:${before} clearsAfterUse:${!after}`)
  await page.close()
}

/* 5. Interaction states. These are trivially easy to lose without noticing,
      because framer-motion drives entrance animations by writing an INLINE
      transform and settles on `transform: none` - which outranks any CSS
      selector. The card hovers were silently inert for exactly that reason
      until they were measured. Also asserts reduced-motion actually wins. */
{
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000 })
  const probe = async (sel, child) => {
    const read = () => page.evaluate(([s, c]) => {
      const el = document.querySelector(s)
      if (!el) return null
      const t = c ? el.querySelector(c) : el
      if (!t) return null
      const cs = getComputedStyle(t)
      return { tr: cs.transform, bg: cs.backgroundColor, br: cs.borderRightColor }
    }, [sel, child])
    const before = await read()
    const handle = await page.$(child ? `${sel} ${child}` : sel)
    if (!handle) return { moved: false, recoloured: false }
    await handle.hover().catch(() => {})
    await new Promise((r) => setTimeout(r, 800))
    const after = await read()
    await page.mouse.move(0, 0)
    await new Promise((r) => setTimeout(r, 500))
    if (!before || !after) return { moved: false, recoloured: false }
    return { moved: before.tr !== after.tr, recoloured: before.bg !== after.bg || before.br !== after.br }
  }

  await page.goto(`${BASE}/r/9415/other-leads`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 2200))
  const card = await probe('.other-card')
  const photo = await probe('.other-card', '.other-photo')
  const icon = await probe('.other-card', '.leader-links a')
  const btn = await probe('.other-cta-btn')
  // per-card clan colour must survive a hover on a neighbour
  await (await page.$('.other-card')).hover()
  await new Promise((r) => setTimeout(r, 700))
  const colours = await page.evaluate(() => [...document.querySelectorAll('.other-card')]
    .map((c) => `${c.querySelector('.other-clan-chip').textContent}:${getComputedStyle(c).borderTopColor}`))
  const distinctClanColours = new Set(colours.map((c) => c.split(':')[1])).size >= 2

  const ok = card.moved && photo.moved && icon.recoloured && btn.moved && distinctClanColours
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${'hover states respond'.padEnd(38)} ` +
    `card:${card.moved} portrait:${photo.moved} icon:${icon.recoloured} button:${btn.moved} ` +
    `perCardClanColoursIntact:${distinctClanColours}`)

  // reduced motion must beat the !important hover transforms
  const rm = await browser.newPage()
  await rm.setViewport({ width: 1440, height: 1000 })
  await rm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await rm.goto(`${BASE}/r/9415/other-leads`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 2000))
  const h = await rm.$('.other-card')
  const t0 = await rm.evaluate((e) => getComputedStyle(e).transform, h)
  await h.hover()
  await new Promise((r) => setTimeout(r, 700))
  const t1 = await rm.evaluate((e) => getComputedStyle(e).transform, h)
  const still = t0 === t1
  if (!still) failures++
  console.log(`${still ? 'PASS' : 'FAIL'}  ${'reduced-motion suppresses the lift'.padEnd(38)} transform ${t0} -> ${t1}`)
  await rm.close()
  await page.close()
}

await browser.close()
console.log(`\n--- ${allLinks.size} distinct outbound links ---`)
;[...allLinks].sort().forEach((l) => console.log('  ' + l))
console.log('  (status codes prove these are well-formed, not that the profiles exist -')
console.log('   Instagram and LinkedIn both block server-side verification. Click them.)')
console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks clean')
process.exit(failures ? 1 : 0)
