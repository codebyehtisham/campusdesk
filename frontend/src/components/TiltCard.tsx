import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

export default function TiltCard({ children, className = '' }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 180, damping: 18, mass: 0.4 });
  const sry = useSpring(ry, { stiffness: 180, damping: 18, mass: 0.4 });

  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  if (reduce || coarse) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className="tilt-wrap h-full">
      <motion.div
        ref={ref}
        className={`tilt-card h-full ${className}`}
        style={{ rotateX: srx, rotateY: sry }}
        onMouseMove={(e) => {
          const node = ref.current;
          if (!node) return;
          const r = node.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          ry.set((px - 0.5) * 12);
          rx.set((0.5 - py) * 12);
        }}
        onMouseLeave={() => {
          rx.set(0);
          ry.set(0);
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
