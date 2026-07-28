/* Content readiness - run this before sending.
 *
 * checkall.mjs answers "does it work". This answers "is it finished": every
 * placeholder URL, missing photo, TODO pointer and unbalanced bio is listed
 * here so none of it can ship silently.
 *
 *   node scripts/content-check.mjs
 */
/* clans.js imports leader photos as Vite assets, which plain Node cannot
   resolve, so register a loader that turns any asset import into its path. */
import { register } from 'node:module'
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(spec, ctx, next) {
    if (/\\.(png|jpe?g|webp|svg|mp3)$/i.test(spec)) {
      const url = new URL(spec, ctx.parentURL).href
      return { url, format: 'module', shortCircuit: true }
    }
    return next(spec, ctx)
  }
  export async function load(url, ctx, next) {
    if (/\\.(png|jpe?g|webp|svg|mp3)$/i.test(url)) {
      return { format: 'module', shortCircuit: true,
               source: 'export default ' + JSON.stringify(url) }
    }
    return next(url, ctx)
  }
`), import.meta.url)

const { CLANS, UNIVERSITY_SOCIALS } = await import('../src/data/clans.js')

const todo = []
const warn = []

/* Two kinds of empty. `null` means the account does not exist - Deepanshu has
   no Instagram, three of the four clans have no LinkedIn page - so it is a
   settled fact, not an open item, and listing it every run would train whoever
   is reading this to ignore the list. '#' or '' means a real account whose URL
   has not been supplied, which IS still to do. */
const isMissing = (u) => u === '#' || (typeof u === 'string' && u.trim() === '')

for (const [key, clan] of Object.entries(CLANS)) {
  const where = clan.name

  // Clans have a war cry and no slogan - there is no slogan field to check.
  if (!String(clan.warCry || '').trim()) todo.push(`${where}: war cry`)

  clan.socials.forEach((s) => {
    if (isMissing(s.url)) todo.push(`${where}: ${s.platform} URL (${s.label})`)
  })

  clan.leaders.forEach((l) => {
    const who = `${where} / ${l.role} ${l.name}`
    if (!l.photo) todo.push(`${who}: photo`)
    if (isMissing(l.instagram)) todo.push(`${who}: Instagram URL`)
    if (isMissing(l.linkedin)) todo.push(`${who}: LinkedIn URL`)
    if (/^\s*TODO/i.test(l.name)) todo.push(`${who}: name`)

    const n = l.points?.length || 0
    if (n < 5) todo.push(`${who}: only ${n} pointers, the card is built for 5`)
    l.points?.forEach((p, i) => {
      if (/^\s*TODO/i.test(p)) todo.push(`${who}: pointer ${i + 1}, ${p.replace(/^TODO:\s*/i, '')}`)
    })
  })
}

UNIVERSITY_SOCIALS.forEach((s) => {
  if (isMissing(s.url)) todo.push(`University: ${s.label} URL`)
})

/* Pointer length balance. The whole point of rewriting the bios was that every
   leader carries the same visual weight, so drift is worth flagging.

   The band is PER POINTER (18-25 words), not a fixed per-leader total. It used
   to be a flat 90-125 words, which silently assumed everyone had exactly five -
   so the moment Pranav was given a sixth, a perfectly balanced card would have
   been flagged as too long. Scaling by count measures the thing that actually
   controls how the card reads: how long each line is, not how many there are. */
const LO = 18
const HI = 25
console.log(`Pointer balance (${LO}-${HI} words per pointer; emph = **highlighted** phrases):\n`)
const EMPH = /\*\*([\s\S]+?)\*\*/g
const plain = (s) => String(s).replace(EMPH, '$1')
const count = (s) => plain(s).split(/\s+/).filter(Boolean).length
const rows = []
for (const clan of Object.values(CLANS)) {
  for (const l of clan.leaders) {
    const joined = (l.points || []).join(' ')
    const hits = joined.match(EMPH) || []
    rows.push({
      who: `${clan.name} ${l.role}`,
      name: l.name,
      words: count(joined),
      each: (l.points || []).map(count),
      emph: hits.length,
      emphWords: hits.reduce((n, h) => n + count(h), 0),
      // an odd number of markers means one is unclosed - it would render as
      // literal asterisks on the card
      unbalanced: (joined.match(/\*\*/g) || []).length % 2 !== 0,
    })
  }
}
const pad = Math.max(...rows.map((r) => r.who.length))
rows.forEach((r) => {
  const flags = []
  const n = r.each.length || 1
  const avg = r.words / n
  if (avg < LO || avg > HI) flags.push(`${avg.toFixed(1)}w per pointer, band is ${LO}-${HI}`)
  if (r.emph < 2) flags.push(`only ${r.emph} highlighted, brief says 2 minimum`)
  if (r.unbalanced) flags.push('unclosed ** marker')
  if (flags.length) warn.push(`${r.who} ${r.name}: ${flags.join('; ')}`)
  console.log(
    `  ${r.who.padEnd(pad)}  ${String(r.words).padStart(3)}w /${n}  ${avg.toFixed(1)}w ea` +
    `  [${r.each.join(', ')}]   emph ${r.emph} (${r.emphWords}w)` +
    `${flags.length ? '  <-- ' + flags.join('; ') : ''}`)
})

/* Two leaders sit on the same clan page one above the other, so a gap in their
   pointer counts shows up directly as one card being taller than the other.
   Only worth saying about clan-mates - nobody sees Nakul beside Aaryan. */
for (const clan of Object.values(CLANS)) {
  const counts = clan.leaders.map((l) => (l.points || []).length)
  if (counts.length === 2 && Math.abs(counts[0] - counts[1]) >= 2) {
    warn.push(`${clan.name}: ${clan.leaders[0].name} has ${counts[0]} pointers and `
      + `${clan.leaders[1].name} has ${counts[1]} - the two cards will differ noticeably in height`)
  }
}

if (warn.length) {
  console.log('\nStructure warnings:')
  warn.forEach((w) => console.log('  ! ' + w))
}

console.log(`\n${todo.length} item(s) still to fill in before sending:\n`)
todo.forEach((t) => console.log('  [ ] ' + t))

if (!todo.length && !warn.length) console.log('  nothing outstanding - content is ready')
process.exit(0)
