import { useEffect, useState } from 'react';
import api from '../api/client';
import { emptyBrand } from './brand';

export default function usePublicBrand() {
  const [brand, setBrand] = useState(emptyBrand);

  useEffect(() => {
    let ignore = false;
    api
      .get('/settings', { timeout: 3000 })
      .then((res) => {
        if (ignore) return;
        const org = res.data?.organization || {};
        setBrand({
          name: org.name || '',
          title: org.title || org.name || '',
          tagline: org.tagline || '',
          logo: org.logo || '',
          slug: org.slug || '',
        });
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);

  return brand;
}
