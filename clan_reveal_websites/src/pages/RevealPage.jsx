import { Link, useOutletContext, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'

import ClanHero from '../components/ClanHero'
import Leaders from '../components/Leaders'
import Socials from '../components/Socials'

import LOGO from '../assets/rishihood_logo.png'

/* The clan's own page. Everything with a lifetime longer than this route -
   the clan lookup, the reveal stage, the audio, the mute button - lives in
   ClanLayout, so that navigating to the sibling other-leads route does not
   unmount it and cut the music. */
export default function RevealPage() {
  const { clan, copy } = useOutletContext()
  const { code } = useParams()
  /* Faculty and team get the reveal and their clan, nothing else: no leaders,
     no socials, no other-clans link. The student cohort keeps the full page. */
  const full = clan.audience !== 'team'

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <ClanHero clan={clan} copy={copy} showScroll={full} />
      {full && <Leaders clan={clan} copy={copy} />}
      {full && <Socials clan={clan} copy={copy} />}

      {/* The other three clans, one route away. Placed after the socials so it
          reads as the last thing on the page rather than as a distraction from
          the clan the visitor actually came here for. */}
      {full && <section className="section other-cta">
        <div className="section-inner">
          <p className="other-cta-line">Four Clans share this campus. You have met yours.</p>
          <Link className="other-cta-btn" to={`/r/${code}/other-leads`}>
            Meet the other Clan Leaders
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h13M12 5.5 18.5 12 12 18.5" />
            </svg>
          </Link>
        </div>
      </section>}

      <footer className="page-footer">
        {/* The war cry used to be repeated down here. It now lands once,
            in the hero, at the moment the clan is revealed - saying it
            twice on one page read as an accident rather than as a chant. */}
        <span className="footer-logo"><img src={LOGO} alt="Rishihood University" /></span>
        <small>Four Clans. One Rishihood. &copy; 2026 Rishihood University.</small>
      </footer>
    </motion.main>
  )
}
