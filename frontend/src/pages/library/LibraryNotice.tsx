import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export function useLibraryNotice() {
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 2800);
    return () => clearTimeout(t);
  }, [notice]);
  return [notice, setNotice] as const;
}

export default function LibraryNotice({ message }: { message: string }) {
  return (
    <AnimatePresence>
      {message ? (
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed right-5 bottom-5 z-50 m-0 max-w-sm rounded-2xl bg-cardinal px-4 py-3 text-sm font-bold text-white shadow-[0_16px_40px_rgba(26,79,214,0.28)]"
        >
          {message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}
