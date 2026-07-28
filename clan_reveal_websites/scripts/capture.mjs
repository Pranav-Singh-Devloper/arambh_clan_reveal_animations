import puppeteer from 'puppeteer'

const OUT = process.argv[2]
const URL = process.argv[3] || 'http://localhost:4317/r/3184'

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--font-render-hinting=none'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 })

const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url()))
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`) })

await page.goto(URL, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1800))
await page.screenshot({ path: `${OUT}/01-gate.png` })

// press BEGIN
const begun = await page.evaluate(() => {
  const b = document.querySelector('.begin')
  if (!b) return false
  b.click()
  return true
})
console.log('clicked BEGIN:', begun)

const shots = [
  [1200, '02-fourclans'],
  [3000, '03-onerishihood'],
  [5200, '04-chosen'],
  [7200, '05-count3'],
  [9300, '06-count1'],
  [11200, '07-impact'],
]
let last = 0
for (const [t, name] of shots) {
  await new Promise((r) => setTimeout(r, t - last))
  last = t
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

// let the hero settle, then capture the sections
await new Promise((r) => setTimeout(r, 3200))
await page.screenshot({ path: `${OUT}/08-hero.png` })

const full = await page.evaluate(() => {
  window.scrollTo(0, document.body.scrollHeight)
  return { h: document.body.scrollHeight, locked: document.body.classList.contains('locked') }
})
console.log('page height:', full.h, 'scroll-locked:', full.locked)
await new Promise((r) => setTimeout(r, 1600))
await page.screenshot({ path: `${OUT}/09-bottom.png` })

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.42))
await new Promise((r) => setTimeout(r, 1400))
await page.screenshot({ path: `${OUT}/10-leaders.png` })

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console/page errors')
await browser.close()
