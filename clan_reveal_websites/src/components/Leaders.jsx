import { motion } from 'framer-motion'
import RuleLabel from './RuleLabel'

/* Chief and Deputy Chief each carry their own two profiles. Rendered only when
   a real URL exists, so an unfilled placeholder can never ship as a dead link
   that goes nowhere. */
const PROFILE_ICONS = {
  instagram: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  ),
  linkedin: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="19" height="19" rx="4" />
      <path d="M7 10.4v6.2M7 7.4v.1M11.4 16.6v-6.2M11.4 13.1c0-1.5.9-2.4 2.3-2.4s2.3.9 2.3 2.4v3.5" />
    </svg>
  ),
}

const isReal = (url) => !!url && url !== '#' && url.trim() !== ''

/* Pointers carry **emphasis** on the bit a first-year would actually be struck
   by - the award, the title, the name in the room. Split on the markers rather
   than storing HTML: a bio is text about a real, named student, and it should
   never be able to inject markup into the page. Odd indices of a split on a
   capturing group are the captured runs, so they are the emphasised ones. */
export function emphasise(text) {
  return String(text)
    .split(/\*\*([\s\S]+?)\*\*/g)
    .map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))
}

export function LeaderLinks({ leader }) {
  // '#' is truthy, so it has to be excluded explicitly - otherwise an unfilled
  // placeholder ships as an icon that goes nowhere
  const links = ['instagram', 'linkedin'].filter((k) => isReal(leader[k]))
  if (!links.length) return null
  return (
    <div className="leader-links">
      {links.map((k) => (
        <a
          key={k}
          href={leader[k]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${leader.name} on ${k === 'instagram' ? 'Instagram' : 'LinkedIn'}`}
        >
          {PROFILE_ICONS[k]}
        </a>
      ))}
    </div>
  )
}

const QUINT_OUT = [0.22, 1, 0.36, 1]

/* Falls back to a monogram whenever a leader has no photo yet, so the section
   looks finished before the cut-outs land and never shows a broken image. */
export function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

/* Section heads animate with the same grammar as the cards - a static
   heading over animated cards is what reads as unfinished. */
export function SectionHead({ eyebrow, title, sub }) {
  return (
    <motion.div
      className="section-head"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
      variants={{ show: { transition: { staggerChildren: 0.12 } } }}
    >
      <motion.p
        className="eyebrow rule-label"
        style={{ color: 'var(--clan)' }}
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 0.72, transition: { duration: 0.5 } },
        }}
      >
        <RuleLabel>{eyebrow}</RuleLabel>
      </motion.p>
      <motion.h2
        variants={{
          hidden: { opacity: 0, y: 26 },
          show: { opacity: 1, y: 0, transition: { duration: 0.85, ease: QUINT_OUT } },
        }}
      >
        {title}
      </motion.h2>
      <motion.p
        variants={{
          hidden: { opacity: 0, y: 14 },
          show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: QUINT_OUT } },
        }}
      >
        {sub}
      </motion.p>
    </motion.div>
  )
}

export default function Leaders({ clan, copy }) {
  return (
    <section className="section">
      <div className="section-inner">
        <SectionHead eyebrow={clan.name} title={copy.leadersTitle} sub={copy.leadersSub} />

        <div className="leader-grid">
          {clan.leaders.map((l, i) => (
            <motion.article
              key={i}
              className="leader-card"
              initial={{ opacity: 0, y: 32, x: i % 2 ? 24 : -24 }}
              whileInView={{ opacity: 1, y: 0, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.75, ease: QUINT_OUT }}
            >
              {l.photo ? (
                <div className="leader-stage">
                  {/* The cut-outs stand on a floor, so they rise from it. This
                      was a clipPath wipe; framer left it pinned at
                      inset(100%) - the target never applied and the portraits
                      rendered fully clipped, i.e. invisible. A transform rise
                      inside the stage's overflow:hidden gives the same read,
                      composites on the GPU, and cannot fail open. */}
                  <motion.img
                    className="leader-photo"
                    src={l.photo}
                    alt={l.name}
                    initial={{ opacity: 0, y: '18%' }}
                    whileInView={{ opacity: 1, y: '0%' }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ delay: 0.15, duration: 0.9, ease: QUINT_OUT }}
                  />
                </div>
              ) : (
                <div className="leader-stage is-monogram">
                  <motion.div
                    className="monogram"
                    initial={{ opacity: 0, scale: 0.85 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ delay: 0.15, duration: 0.7, ease: QUINT_OUT }}
                  >
                    {initials(l.name)}
                  </motion.div>
                </div>
              )}

              <div className="leader-body">
                <motion.span
                  className="role-chip"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ delay: 0.25, duration: 0.6 }}
                >
                  {l.role}
                </motion.span>
                <h3>{l.name}</h3>

                <LeaderLinks leader={l} />

                {l.points?.length > 0 && (
                  <ul className="leader-points">
                    {l.points.map((p, k) => (
                      <motion.li
                        key={k}
                        initial={{ opacity: 0, x: -12 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, amount: 0.4 }}
                        transition={{ delay: 0.2 + k * 0.06, duration: 0.5, ease: 'easeOut' }}
                      >
                        {emphasise(p)}
                      </motion.li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
