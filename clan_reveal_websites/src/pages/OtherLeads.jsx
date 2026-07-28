import { Link, useOutletContext, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'

import { CLANS } from '../data/clans'
import { emphasise, initials, LeaderLinks, SectionHead } from '../components/Leaders'
import AudioSpectrum from '../components/AudioSpectrum'

import LOGO from '../assets/rishihood_logo.png'

const QUINT_OUT = [0.22, 1, 0.36, 1]

/* ===========================================================================
   The other three clans' leaders.

   Card counts are not the same on every page, which is the whole reason the
   grid needs thinking about rather than a flat repeat(3, 1fr):

       on Rajputana's page   Vijaya 1 + Maratha 2 + Chola 2 = 5
       on Vijaya's page      Rajputana 2 + Maratha 2 + Chola 2 = 6
       on Maratha's page     Rajputana 2 + Vijaya 1 + Chola 2 = 5
       on Chola's page       Rajputana 2 + Vijaya 1 + Maratha 2 = 5

   So three of the four pages are a 3 + 2, and the short final row is centred
   rather than left hanging against the left edge. Vijaya's is the only exact
   3 x 2. See .other-grid in global.css.

   Each card carries its OWN clan's colour through --card-clan, not the page's.
   The page is painted in the visitor's clan colour, and a Chola-blue card for
   a Maratha leader would be a small lie about who they belong to.
   =========================================================================== */

export default function OtherLeads() {
  const { clan, musicOn, soundOn } = useOutletContext()
  const { code } = useParams()

  /* resolveCode returns { code, clan: <key>, audience, ...CLANS[key] }, so the
     resolved object's own `clan` field is the CLANS key ('chola') while `name`
     is the display name ('Chola'). Filtering on the key is exact; filtering on
     the display name would work today only by coincidence. */
  const others = Object.entries(CLANS)
    .filter(([key]) => key !== clan.clan)
    .flatMap(([, c]) => c.leaders.map((l) => ({ leader: l, clan: c })))

  return (
    <motion.main
      className="other-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <header className="other-head">
        {/* Same bed, still running - this route is a sibling of the clan page
            under a layout that owns the audio, so nothing restarts. The
            spectrum reads the one module-level analyser, so a second instance
            here simply picks up the music already playing. */}
        <motion.div
          className="spectrum-wrap"
          initial={{ opacity: 0, scaleX: 0.4 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.25, duration: 1.1, ease: QUINT_OUT }}
        >
          <AudioSpectrum color={clan.color} />
        </motion.div>

        {/* Only ever shown to someone who arrived straight at this URL, where
            no gesture has happened and no browser would allow audio. */}
        {!musicOn && (
          <button className="sound-on" onClick={soundOn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6.5 9H3v6h3.5L11 19Z" />
              <path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
            </svg>
            Turn the sound on
          </button>
        )}
      </header>

      <section className="section other-section">
        <div className="section-inner">
          <SectionHead
            eyebrow="The Other Three"
            title="The other Clan Leaders"
            sub={`You belong to ${clan.name}. These are the people leading the other three, and you will be seeing a great deal of them.`}
          />

          <div className="other-grid">
            {others.map(({ leader: l, clan: c }, i) => (
              <motion.article
                key={`${c.name}-${l.name}`}
                className="other-card"
                style={{ '--card-clan': c.color, '--card-soft': c.glow }}
                initial={{ opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ delay: (i % 3) * 0.08, duration: 0.65, ease: QUINT_OUT }}
              >
                <div className={`other-stage${l.photo ? '' : ' is-monogram'}`}>
                  {l.photo ? (
                    <img className="other-photo" src={l.photo} alt={l.name} loading="lazy" />
                  ) : (
                    <div className="monogram">{initials(l.name)}</div>
                  )}
                </div>

                <div className="other-body">
                  <span className="other-clan-chip">{c.name}</span>
                  <span className="role-chip">{l.role}</span>
                  <h3>{l.name}</h3>
                  <LeaderLinks leader={l} />

                  {l.points?.length > 0 && (
                    <ul className="leader-points other-points">
                      {l.points.map((p, k) => <li key={k}>{emphasise(p)}</li>)}
                    </ul>
                  )}
                </div>
              </motion.article>
            ))}
          </div>

          <div className="other-back">
            <Link className="other-cta-btn" to={`/r/${code}`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H6M12 5.5 5.5 12 12 18.5" />
              </svg>
              Back to {clan.name}
            </Link>
          </div>
        </div>
      </section>

      <footer className="page-footer">
        <span className="footer-logo"><img src={LOGO} alt="Rishihood University" /></span>
        <small>Four Clans. One Rishihood. &copy; 2026 Rishihood University.</small>
      </footer>
    </motion.main>
  )
}
