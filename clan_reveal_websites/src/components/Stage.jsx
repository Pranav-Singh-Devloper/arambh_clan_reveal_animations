import { motion } from 'framer-motion'
import Curtains from './Curtains'

/* ===========================================================================
   The auditorium. Painted in DOM order inside one stacking context, back to
   front: back wall -> raked floor -> curtains -> follow-spots -> footlights
   -> gilt proscenium. The order is load-bearing: spots fall ON the velvet,
   footlights sit IN FRONT of it on the apron, the arch frames the lot.

   Assembly is a SEQUENCE, not a crossfade - each element starts as the
   previous is ~60% home (delays below, relative to mount at T.stage):
   wall 0 -> floor 0.2 -> valance 0.35 -> curtains 0.5 -> arch 0.7 (sheen
   at 1.1) -> footlights 1.2 (driven by `lit`) -> spots 3.5 (= T.spots).

   `gasp`: the world freezes - spots converge into one tight pool, footlights
   dim, everything else holds its breath.
   =========================================================================== */

const FOOTLIGHTS = 9
const QUINT_OUT = [0.22, 1, 0.36, 1]

export default function Stage({ lit, frantic, gasp, curtainOpen }) {
  return (
    <motion.div
      className="theatre"
      initial={{ scale: 1.05 }}
      animate={{ scale: 1 }}
      transition={{ duration: 3.4, ease: [0.16, 1, 0.3, 1] }} // slow dolly settle
      aria-hidden="true"
    >
      <motion.div
        className="theatre-back"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
      <motion.div
        className="theatre-floor"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 1.0, ease: QUINT_OUT }}
      />

      <Curtains open={curtainOpen} />

      {/* follow-spots: enter mid-swing (from -22deg), never from rest.
          Each spot carries an inner haze cone running 1.18x slower - the
          phase drift between the two cones reads as volumetric haze. */}
      {[['spot-left', -1], ['spot-right', 1]].map(([side, dir]) => (
        <motion.div
          key={side}
          className={`spot ${side}`}
          initial={{ opacity: 0, rotate: -22 * dir }}
          animate={
            gasp
              ? { opacity: 0.35, rotate: 0, transition: { duration: 0.45, ease: [0.3, 0, 0.2, 1] } }
              : {
                  opacity: frantic ? 0.92 : 0.55,
                  // null first keyframe: continue from wherever the swing is -
                  // an explicit first keyframe teleports on every state change
                  rotate: frantic ? [null, 20 * dir, -26 * dir] : [null, 10 * dir, -16 * dir],
                  transition: {
                    // the 3.5s delay is the ENTRANCE cue only; framer applies
                    // `delay` on every animation start, so the frantic flip
                    // must not inherit it or the spots freeze mid-countdown
                    opacity: { delay: frantic ? 0 : 3.5, duration: 1.2 },
                    rotate: {
                      delay: frantic ? 0 : 3.5,
                      duration: (frantic ? 1.5 : 5.5) + (dir > 0 ? 0.2 : 0),
                      repeat: Infinity,
                      ease: 'easeInOut',
                    },
                  },
                }
          }
        >
          <div className="spot-haze" />
        </motion.div>
      ))}

      {/* the pool of light on the closed curtain: blooms fast, decays slow;
          in the gasp it contracts - smaller but brighter, one tight pool */}
      <motion.div
        className="follow-pool"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={
          curtainOpen
            ? { opacity: 0, transition: { duration: 0.8 } }
            : gasp
              ? { opacity: 1, scale: 0.72, transition: { duration: 0.45, ease: [0.3, 0, 0.2, 1] } }
              : lit >= FOOTLIGHTS
                ? {
                    opacity: [0, 1, 0.86], scale: 1,
                    transition: { duration: 1.55, times: [0, 0.23, 1], ease: 'easeOut' },
                  }
                : { opacity: 0 }
        }
      />

      {/* footlights: each strikes like a real filament - flash, sag, settle */}
      <div className="footlights">
        {Array.from({ length: FOOTLIGHTS }).map((_, i) => (
          <motion.span
            key={i}
            className="footlight"
            style={{ '--i': i }}
            initial={{ opacity: 0.1 }}
            animate={
              gasp
                ? { opacity: 0.35, transition: { duration: 0.4 } }
                : i < lit
                  ? {
                      opacity: [0.1, 1, 0.55, 0.95, 0.8, 1],
                      transition: { duration: 0.5, times: [0, 0.18, 0.34, 0.55, 0.75, 1] },
                    }
                  : { opacity: 0.1 }
            }
          />
        ))}
      </div>

      <motion.div
        className="proscenium"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 1.0, ease: 'easeOut' }}
      >
        {/* one gilt glint as the arch arrives */}
        <div className="gilt-sheen" />
      </motion.div>
    </motion.div>
  )
}
