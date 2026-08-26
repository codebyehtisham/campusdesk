import { motion } from 'framer-motion';

export default function PageHero({ eyebrow, title, subtitle, image }) {
  return (
    <section className="relative overflow-hidden px-5 pt-36 pb-20 sm:px-8 md:pt-44 md:pb-28">
      {image && (
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-bg/70 via-bg/88 to-bg" />
      <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-transparent via-crimson to-cardinal" />
      <div className="container relative">
        {eyebrow && (
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="eyebrow"
          >
            {eyebrow}
          </motion.span>
        )}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7 }}
          className="max-w-4xl"
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-5 max-w-xl text-lg text-text-muted"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
    </section>
  );
}
