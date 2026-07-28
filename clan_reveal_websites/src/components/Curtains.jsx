import { motion } from 'framer-motion'

/* ===========================================================================
   Two velvet halves and a straight pelmet, hung inside the proscenium and
   stopping short of the apron. Rendered by Stage so it shares the theatre's
   stacking context.

   ASSEMBLY (mount): the valance drops with a 2.5% sag-settle; the halves
   close in from the wings while the curtain motor rumbles.

   OPENING: an anticipation tug first (the grip takes the fabric: +1.6% the
   WRONG way, with a 0.7% lift), then the haul. Heavy velvet does not bounce
   - the settle lives on the valance, which overshoots up and damps back.

   The light blade is BEHIND the halves: it is only ever seen through the
   widening gap, and it widens with the gap rather than just fading in.
   =========================================================================== */

const HEAVY = [0.66, 0, 0.22, 1]
const CLOSE = [0.34, 0, 0.26, 1]

export default function Curtains({ open }) {
  return (
    <div className="curtains">
      {/* the blaze, behind the halves */}
      <motion.div
        className="curtain-spill"
        initial={{ opacity: 0, scaleX: 0.12 }}
        animate={
          open
            ? {
                opacity: [0, 0.25, 1, 0.78],
                scaleX: [0.12, 0.3, 1, 1],
                transition: { duration: 2.0, times: [0, 0.28, 0.6, 1], ease: 'easeOut' },
              }
            : { opacity: 0 }
        }
      />

      {[['curtain-left', -1], ['curtain-right', 1]].map(([side, dir]) => (
        <motion.div
          key={side}
          className={`curtain ${side}`}
          initial={{ x: `${100 * dir}%` }}
          animate={
            open
              ? {
                  x: ['0%', `${1.6 * -dir}%`, `${101 * dir}%`],
                  y: ['0%', '0.7%', '0%'],
                  transition: {
                    duration: 2.0,
                    times: [0, 0.11, 1],
                    ease: ['easeOut', HEAVY],
                  },
                }
              : {
                  x: '0%',
                  transition: { delay: 0.5, duration: 1.55, ease: CLOSE },
                }
          }
        />
      ))}

      <motion.div
        className="valance"
        initial={{ y: '-100%' }}
        animate={
          open
            ? {
                y: ['0%', '-46%', '-39%', '-40.5%', '-40%'],
                transition: { duration: 2.35, times: [0, 0.62, 0.82, 0.93, 1], ease: [0.42, 0, 0.2, 1] },
              }
            : {
                y: ['-100%', '2.5%', '0%'],
                transition: { delay: 0.35, duration: 1.25, times: [0, 0.82, 1], ease: CLOSE },
              }
        }
      />
    </div>
  )
}
