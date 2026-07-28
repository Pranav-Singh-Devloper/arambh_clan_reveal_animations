import { motion } from 'framer-motion'

/* Letterspaced small caps flanked by hairlines that DRAW outward rather than
   simply appearing. The hairlines used to be ::before/::after pseudos, which
   framer cannot animate - they are real spans now. */
export default function RuleLabel({ children, delay = 0 }) {
  const line = (side) => (
    <motion.span
      aria-hidden="true"
      className={`rl-line ${side}`}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ delay: delay + 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    />
  )
  return (
    <>
      {line('right') /* left line grows leftward from the text */}
      <span>{children}</span>
      {line('left')}
    </>
  )
}
