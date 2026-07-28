import { motion } from 'framer-motion'
import { SectionHead } from './Leaders'
import { UNIVERSITY_SOCIALS } from '../data/clans'

/* '#' is truthy, so unfilled placeholders must be excluded explicitly rather
   than shipping as cards that go nowhere. */
const isReal = (url) => !!url && url !== '#' && url.trim() !== ''

/* Inline SVG marks - no icon CDN, so nothing here can 404. Instagram and
   LinkedIn only: those are the two platforms the clans actually run. A WhatsApp
   mark used to sit here for a channel that was never set up, which is exactly
   the dead button this section is not allowed to grow. */
const ICONS = {
  Instagram: (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  ),
  LinkedIn: (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="19" height="19" rx="4" />
      <path d="M7 10.4v6.2M7 7.4v.1M11.4 16.6v-6.2M11.4 13.1c0-1.5.9-2.4 2.3-2.4s2.3.9 2.3 2.4v3.5" />
    </svg>
  ),
}

const FALLBACK = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9.2" />
    <path d="M2.8 12h18.4M12 2.8c2.4 2.5 3.6 5.6 3.6 9.2s-1.2 6.7-3.6 9.2c-2.4-2.5-3.6-5.6-3.6-9.2S9.6 5.3 12 2.8Z" />
  </svg>
)

export default function Socials({ clan, copy }) {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="section-inner">
        <SectionHead eyebrow="Stay in the loop" title={`Follow ${clan.name}`} sub={copy.socialsSub} />

        {/* the clan's own two, then the university's two */}
        <div className="social-grid">
          {[...clan.socials, ...UNIVERSITY_SOCIALS].filter((s) => isReal(s.url)).map((s, i) => (
            <motion.a
              key={i}
              className="social-card"
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ delay: i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="social-icon">{ICONS[s.platform] || FALLBACK}</span>
              <span>
                <b>{s.label || s.platform}</b>
                <em>{s.handle}</em>
              </span>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  )
}
