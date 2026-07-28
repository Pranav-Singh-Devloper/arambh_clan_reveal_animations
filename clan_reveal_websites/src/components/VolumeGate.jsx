import { motion } from 'framer-motion'
import RuleLabel from './RuleLabel'

/* Bundled, not hotlinked. This logo is on the volume gate - the very first
   thing anyone sees - so a third-party image host is the last place it should
   come from. */
import LOGO from '../assets/rishihood_logo.png'

const QUINT_OUT = [0.22, 1, 0.36, 1]

const DESKTOP =
  typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches

/* One curtain-up gesture instead of five separate arrivals: a single
   choreographed stagger, blur-to-sharp on desktop. The BEGIN button does not
   throb - luxury objects glint (a slow specular sheen, in CSS); they do not
   ask to be tapped. */
const item = {
  hidden: { opacity: 0, y: 18, ...(DESKTOP ? { filter: 'blur(6px)' } : {}) },
  show: {
    opacity: 1, y: 0, ...(DESKTOP ? { filter: 'blur(0px)' } : {}),
    transition: { duration: 0.9, ease: QUINT_OUT },
  },
}

export default function VolumeGate({ onBegin }) {
  return (
    <motion.div
      className="stage gate"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.06 }}
      transition={{ duration: 0.55 }}
    >
      <motion.div
        className="gate-inner"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.11, delayChildren: 0.2 } } }}
      >
        <motion.div variants={item} className="logo-plate">
          <img src={LOGO} alt="Rishihood University" width="140" />
        </motion.div>

        <motion.p
          variants={item}
          className="eyebrow rule-label gate-eyebrow"
          style={{ marginTop: 30 }}
          {...(DESKTOP
            ? {
                initial: { opacity: 0, y: 18, letterSpacing: '0.6em' },
                animate: { opacity: 1, y: 0, letterSpacing: '0.44em' },
                transition: { delay: 0.35, duration: 1.2, ease: QUINT_OUT },
                variants: undefined,
              }
            : {})}
        >
          <RuleLabel delay={0.8}>Clan Allotment 2026</RuleLabel>
        </motion.p>

        <motion.h1 variants={item}>
          Your Clan Is<br />About To Be Revealed
        </motion.h1>

        <motion.div variants={item} className="volume-card">
          <strong>Turn your volume up to 100%</strong>
        </motion.div>

        <motion.button
          variants={item}
          className="begin"
          onClick={onBegin}
          whileTap={{ scale: 0.97, transition: { duration: 0.12 } }}
        >
          Begin the Reveal
        </motion.button>

        <motion.p variants={item} className="gate-note">
          Twenty-three seconds. Don&apos;t skip.
        </motion.p>
      </motion.div>
    </motion.div>
  )
}
