/* Captures gate / hero / leaders / socials in both themes at desktop and phone
   widths, so the two looks can be compared side by side. */
import puppeteer from 'puppeteer'

const OUT = process.argv[2]
const BASE = process.argv[3] || 'http://localhost:4317'

const VIEWS = [
  ['pc', { width: 1440, height: 900, deviceScaleFactor: 1 }],
  ['mob', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true }],
]

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
})

for (const theme of ['dark', 'light']) {
  for (const [vname, vp] of VIEWS) {
    const page = await browser.newPage()
    await page.setViewport(vp)
    await page.goto(`${BASE}/r/3184?theme=${theme}`, { waitUntil: 'networkidle2' })
    await new Promise((r) => setTimeout(r, 1200))
    await page.screenshot({ path: `${OUT}/${theme}-${vname}-1gate.png` })

    await page.evaluate(() => document.querySelector('.begin')?.click())
    await new Promise((r) => setTimeout(r, 500))
    await page.evaluate(() => document.querySelector('.skip-btn')?.click())
    await new Promise((r) => setTimeout(r, 3000))
    await page.screenshot({ path: `${OUT}/${theme}-${vname}-2hero.png` })

    // leaders
    await page.evaluate(() => {
      document.querySelector('.leader-grid')?.scrollIntoView({ block: 'center' })
    })
    await new Promise((r) => setTimeout(r, 1500))
    await page.screenshot({ path: `${OUT}/${theme}-${vname}-3leaders.png` })

    // socials + footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await new Promise((r) => setTimeout(r, 1400))
    await page.screenshot({ path: `${OUT}/${theme}-${vname}-4socials.png` })

    const chk = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      cards: document.querySelectorAll('.leader-card').length,
      cols: getComputedStyle(document.querySelector('.leader-grid')).gridTemplateColumns,
    }))
    console.log(
      `${theme}/${vname}: leaders=${chk.cards} cols="${chk.cols}" overflow=${chk.sw > chk.cw ? 'YES ' + chk.sw + '>' + chk.cw : 'none'}`
    )
    await page.close()
  }
}

// buildup frame in each theme, to see the countdown on light
for (const theme of ['dark', 'light']) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(`${BASE}/r/3184?theme=${theme}`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => document.querySelector('.begin')?.click())
  await new Promise((r) => setTimeout(r, 7200))
  await page.screenshot({ path: `${OUT}/${theme}-pc-0count.png` })
  await page.close()
}

await browser.close()
console.log('done')
