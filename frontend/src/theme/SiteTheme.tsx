import { useEffect } from 'react';
import api from '../api/client';
import { applyTheme, clearTheme, DEFAULT_THEME, normalizeTheme } from './catalog';

export default function SiteTheme({ children }) {
  useEffect(() => {
    let ignore = false;
    applyTheme(DEFAULT_THEME);
    api
      .get('/settings')
      .then((res) => {
        if (ignore) return;
        applyTheme(normalizeTheme(res.data?.organization?.theme));
      })
      .catch(() => {
        if (!ignore) applyTheme(DEFAULT_THEME);
      });
    return () => {
      ignore = true;
      clearTheme();
    };
  }, []);

  return children;
}
