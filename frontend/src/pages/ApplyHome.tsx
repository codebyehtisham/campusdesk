import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import ApplicantLogin from '../components/ApplicantLogin';
import BrandMark from '../components/BrandMark';
import usePublicBrand from '../brand/usePublicBrand';
import api from '../api/client';

export default function ApplyHome() {
  const brand = usePublicBrand();
  const [searchParams] = useSearchParams();
  const institute = String(searchParams.get('institute') || '').trim().toLowerCase();
  const [admissionsOpen, setAdmissionsOpen] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .get('/settings', { params: institute ? { institute } : undefined })
      .then((res) => setAdmissionsOpen(res.data?.admissionsOpen !== false))
      .catch(() => setAdmissionsOpen(true))
      .finally(() => setLoaded(true));
  }, [institute]);

  return (
    <div className="relative min-h-svh overflow-hidden bg-white">
      <div className="hero-aurora" aria-hidden="true" />
      <div className="hero-aurora hero-aurora-b" aria-hidden="true" />
      <div className="flex min-h-svh items-center justify-center px-5 py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          <div className="mb-6 flex items-center gap-3 px-1">
            <BrandMark org={brand} size={48} />
            <div className="leading-tight">
              <strong className="font-serif text-sm font-bold tracking-tight text-ink">
                {brand.title || brand.name || 'Campus Desk'}
              </strong>
              <p className="m-0 text-[0.7rem] font-medium text-text-muted">
                Admissions · Campus Desk{institute ? ` · ${institute}` : ''}
              </p>
            </div>
          </div>
          {!loaded ? (
            <div className="glass rounded-[1.8rem] p-8 md:p-10">
              <p className="m-0 text-text-muted">Checking admissions status…</p>
            </div>
          ) : admissionsOpen ? (
            <ApplicantLogin institute={institute} />
          ) : (
            <div className="glass glow-border rounded-[1.8rem] p-8 md:p-10">
              <span className="eyebrow">Admissions</span>
              <h3>Admissions are closed now</h3>
              <p className="m-0 text-text-muted">
                Applications are not being taken at the moment. Please check back when the next intake opens.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
