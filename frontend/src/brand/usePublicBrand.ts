import { useEffect, useState } from 'react';
import api from '../api/client';
import { emptyBrand } from './brand';

const fromSettings = (org = {}) => ({
  name: org.name || '',
  title: org.title || org.name || '',
  tagline: org.tagline || '',
  logo: org.logo || '',
  slug: org.slug || '',
});

export default function usePublicBrand() {
  const [brand, setBrand] = useState(emptyBrand);

  useEffect(() => {
    let ignore = false;

    const load = (attempt = 0) =>
      api
        .get('/settings')
        .then((res) => {
          if (ignore) return;
          setBrand(fromSettings(res.data?.organization));
        })
        .catch(() => {
          if (ignore) return;
          // Cold hosts often exceed a tight timeout; retry once before giving up.
          if (attempt < 1) {
            window.setTimeout(() => {
              if (!ignore) load(attempt + 1);
            }, 400);
            return;
          }
        });

    load();
    return () => {
      ignore = true;
    };
  }, []);

  return brand;
}
