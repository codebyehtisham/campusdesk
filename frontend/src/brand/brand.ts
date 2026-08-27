export const emptyBrand = {
  name: '',
  title: '',
  tagline: '',
  logo: '',
  slug: '',
};

export const brandTitle = (org) => org?.title || org?.name || 'Campus';

export const brandLogo = (org) => String(org?.logo || '').trim();

export const brandAlt = (org) => `${brandTitle(org)} crest`;

export const initials = (org) => {
  const text = String(org?.title || org?.name || '').trim();
  if (!text) return '';
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return text.slice(0, 2).toUpperCase();
};
