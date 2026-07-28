import puppeteer from 'puppeteer'
const B = process.argv[2] || 'http://localhost:4317'
const b = await puppeteer.launch({ headless:'new', args:['--autoplay-policy=no-user-gesture-required','--no-sandbox'] })
/* Every condition the bed has to survive, including the two that used to break
   it: a download still in flight at the impact, and a repeat visit. */
const CASES = [
  ['fast / full sequence',   null,           '9415', 'full'],
  ['fast / skip',            null,           '9415', 'skip'],
  ['fast / reduced motion',  null,           '9415', 'reduced'],
  ['4G / full',              1250*1024,      '9415', 'full'],
  ['Fast 3G / full',         200*1024,       '9415', 'full'],
  ['Slow 3G / full',         50*1024,        '9415', 'full'],
  ['in-flight at impact',    26*1024,        '9415', 'full'],
  ['Maratha 2.8MB / 3G',     200*1024,       '7362', 'full'],
]
let pass=0, fail=0
for (const [label, bps, code, mode] of CASES) {
  for (let rep=1; rep<=2; rep++) {
    const p = await b.newPage()
    const errs = []
    p.on('console', m=>{ if (/music/i.test(m.text())) errs.push(m.text()) })
    if (bps) { const c = await p.createCDPSession(); await c.send('Network.enable')
      await c.send('Network.emulateNetworkConditions',{offline:false,downloadThroughput:bps,uploadThroughput:bps,latency:150}) }
    if (mode==='reduced') await p.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}])
    await p.evaluateOnNewDocument(()=>{ window.__lvl=[]; window.__starts=0
      const An=AnalyserNode.prototype, o=An.getByteFrequencyData
      An.getByteFrequencyData=function(a){ o.call(this,a); let s=0; for(let k=0;k<a.length;k++) s+=a[k]
        window.__lvl.push(Math.round(s/a.length)) }
      const S=AudioBufferSourceNode.prototype, os=S.start
      S.start=function(...a){ if(this.buffer&&this.buffer.duration>30) window.__starts++; return os.apply(this,a) } })
    await p.goto(`${B}/r/${code}`,{waitUntil:'domcontentloaded'})
    await p.waitForSelector('.begin',{timeout:150000})
    await p.evaluate(()=>document.querySelector('.begin').click())
    if (mode==='skip') { await new Promise(r=>setTimeout(r,700)); await p.evaluate(()=>document.querySelector('.skip-btn')?.click()) }
    const wait = bps && bps<=50*1024 ? 75000 : (mode==='full' ? 34000 : 14000)
    await new Promise(r=>setTimeout(r,wait))
    const m = await p.evaluate(()=>({ aud:window.__lvl.slice(-260).filter(v=>v>2).length, starts:window.__starts }))
    const ok = m.aud>30 && m.starts===1
    ok?pass++:fail++
    console.log(`  ${ok?'PASS':'FAIL'}  ${label.padEnd(22)} run${rep}  audible ${String(m.aud).padStart(3)}/260  musicStarts ${m.starts}` +
      (errs.length?`  ${errs.join(' | ')}`:''))
    await p.close()
  }
}
console.log(`\n  ${pass} passed, ${fail} failed of ${pass+fail}`)
await b.close()
process.exit(fail?1:0)
