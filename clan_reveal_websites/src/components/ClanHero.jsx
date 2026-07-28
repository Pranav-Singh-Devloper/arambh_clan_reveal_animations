import { motion } from 'framer-motion'
import RuleLabel from './RuleLabel'
import AudioSpectrum from './AudioSpectrum'

/* ===========================================================================
   The hero resolves OUT of the flash - four separate punches, never a pile-up:

     0.00  clan colour floods (the impact itself)
     0.05  the crest, SOLO - scale 1.18 -> 1, resolving down out of the light
     0.55  eyebrow (the label must precede the title)
     0.95  the name deals out letter by letter
     1.10  a specular sweep crosses the medallion - the struck-coin glint
     2.00  rule draws
     2.30  war cry, word by word (it waits for the name's final letter)
     2.90  welcome line
     3.60  scroll hint

   One element at peak velocity at any moment; overlaps only in settle tails.
   =========================================================================== */

const QUINT_OUT = [0.22, 1, 0.36, 1]

const DESKTOP =
  typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches

export default function ClanHero({ clan, copy }) {
  const letters = clan.name.toUpperCase().split('')

  return (
    <header className="hero">
      <motion.div
        className="hero-aura"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 0.9, 0.72], scale: [0.6, 1.08, 1] }}
        transition={{ duration: 2.2, ease: 'easeOut' }}
      />

      <div style={{ position: 'relative' }}>
        <motion.div
          className="crest-wrap"
          initial={{ opacity: 0, scale: 1.18, ...(DESKTOP ? { filter: 'blur(16px)' } : {}) }}
          animate={{ opacity: 1, scale: 1, ...(DESKTOP ? { filter: 'blur(0px)' } : {}) }}
          transition={{
            delay: 0.05,
            opacity: { delay: 0.05, duration: 0.45 },
            duration: 0.9,
            ease: QUINT_OUT,
          }}
        >
          <motion.img
            className="crest"
            src={clan.crest}
            alt={`${clan.name} clan crest`}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 2.5 }}
          />
          {/* the struck-medallion glint */}
          <span className="crest-sheen">
            <motion.span
              className="crest-sheen-bar"
              initial={{ x: '-130%' }}
              animate={{ x: '230%' }}
              transition={{ delay: 1.1, duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
            />
          </span>
        </motion.div>

        <motion.p
          className="eyebrow rule-label"
          style={{ marginTop: 26 }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 0.72, y: 0 }}
          transition={{ delay: 0.55, duration: 0.6, ease: QUINT_OUT }}
        >
          <RuleLabel delay={0.55}>{copy.preTitle}</RuleLabel>
        </motion.p>

        <h1 className="clan-name" aria-label={clan.name}>
          {letters.map((ch, i) => (
            <motion.span
              key={i}
              className="clan-letter"
              aria-hidden="true"
              initial={{ opacity: 0, y: '0.55em' }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.95 + i * 0.055, duration: 0.8, ease: QUINT_OUT }}
            >
              {ch}
            </motion.span>
          ))}
        </h1>

        <motion.div
          className="rule"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 2.0, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* The clan's own line, and its only one. It lands word by word rather
            than as one fade, because a cry is chanted rather than read - and
            because it lets 'For Victory, For Glory, For Maratha, जय मराठा!'
            arrive in beats instead of as a wall. */}
        {/* aria-label carries the real string. The words are separate flex
            items so they can animate independently, which drops the whitespace
            between them from the accessibility tree and the clipboard - a
            screen reader would otherwise announce the cry as one long
            unbroken word. */}
        <motion.p
          className="cry"
          aria-label={clan.warCry}
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { delayChildren: 2.3, staggerChildren: 0.11 } } }}
        >
          {clan.warCry.split(/\s+/).map((w, i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              variants={{
                hidden: { opacity: 0, y: '0.4em' },
                show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: QUINT_OUT } },
              }}
            >
              {w}
            </motion.span>
          ))}
        </motion.p>

        <motion.p
          className="welcome-line"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.9, duration: 0.9 }}
        >
          {copy.welcome}
        </motion.p>

        {/* Reads as a hairline rule until the bed comes in, then the bars grow
            out of it - a graphic device rather than a media-player widget. */}
        <motion.div
          className="spectrum-wrap"
          initial={{ opacity: 0, scaleX: 0.4 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 3.3, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <AudioSpectrum color={clan.color} />
        </motion.div>
      </div>

      <motion.div
        className="scroll-hint"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.55, y: [0, 6, 0] }}
        transition={{
          opacity: { delay: 3.6, duration: 0.8 },
          y: { delay: 3.6, duration: 2.6, repeat: Infinity, ease: 'easeInOut' },
        }}
      >
        Scroll &darr;
      </motion.div>
    </header>
  )
}
