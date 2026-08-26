export const COLOR_FIELDS = [
  { key: 'primary', label: 'Primary', group: 'Brand' },
  { key: 'accent', label: 'Accent', group: 'Brand' },
  { key: 'ink', label: 'Headings', group: 'Text' },
  { key: 'text', label: 'Body text', group: 'Text' },
  { key: 'textMuted', label: 'Muted text', group: 'Text' },
  { key: 'bg', label: 'Page background', group: 'Surfaces' },
  { key: 'bgAlt', label: 'Alt sections', group: 'Surfaces' },
  { key: 'paper', label: 'Cards / paper', group: 'Surfaces' },
  { key: 'border', label: 'Borders', group: 'Surfaces' },
  { key: 'gradientFrom', label: 'Gradient start', group: 'Buttons & glow' },
  { key: 'gradientVia', label: 'Gradient middle', group: 'Buttons & glow' },
  { key: 'gradientTo', label: 'Gradient end', group: 'Buttons & glow' },
];

export const HERITAGE_COLORS = {
  primary: '#1a4fd6',
  accent: '#c8102e',
  ink: '#0d2a80',
  text: '#33415c',
  textMuted: '#5b6b86',
  bg: '#ffffff',
  bgAlt: '#f5f8fd',
  border: '#d7e6f7',
  paper: '#ffffff',
  gradientFrom: '#c8102e',
  gradientVia: '#e11d48',
  gradientTo: '#1a4fd6',
};

export const TEMPLATES = [
  {
    id: 'heritage',
    name: 'Heritage',
    badge: 'Current site',
    description: 'The live Explore College look: white canvas, glass pill nav, and the crest blue/red.',
    colors: HERITAGE_COLORS,
  },
  {
    id: 'atlas',
    name: 'Atlas',
    description: 'Geometric campus system with teal structure and sharper frames.',
    colors: {
      primary: '#0f766e',
      accent: '#c2410c',
      ink: '#134e4a',
      text: '#334155',
      textMuted: '#64748b',
      bg: '#f8fafc',
      bgAlt: '#ecfeff',
      border: '#cbe7e4',
      paper: '#ffffff',
      gradientFrom: '#0f766e',
      gradientVia: '#0d9488',
      gradientTo: '#c2410c',
    },
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Magazine layout: serif headlines, tight corners, charcoal and gold.',
    colors: {
      primary: '#1c1917',
      accent: '#b45309',
      ink: '#1c1917',
      text: '#44403c',
      textMuted: '#78716c',
      bg: '#faf7f2',
      bgAlt: '#f3eee6',
      border: '#e7e0d6',
      paper: '#fffdf8',
      gradientFrom: '#1c1917',
      gradientVia: '#44403c',
      gradientTo: '#b45309',
    },
  },
  {
    id: 'lumen',
    name: 'Lumen',
    description: 'Soft academic: sage, cream, and extra-round surfaces.',
    colors: {
      primary: '#3f6212',
      accent: '#a16207',
      ink: '#365314',
      text: '#3f4a3a',
      textMuted: '#6b7a64',
      bg: '#fbfaf4',
      bgAlt: '#f4f1e6',
      border: '#e4e6d4',
      paper: '#ffffff',
      gradientFrom: '#3f6212',
      gradientVia: '#65a30d',
      gradientTo: '#a16207',
    },
  },
  {
    id: 'nocturne',
    name: 'Nocturne',
    description: 'Dark cinematic campus: ink ground, amber highlights, high contrast.',
    colors: {
      primary: '#60a5fa',
      accent: '#f59e0b',
      ink: '#f8fafc',
      text: '#cbd5e1',
      textMuted: '#94a3b8',
      bg: '#0b1220',
      bgAlt: '#111827',
      border: '#1e293b',
      paper: '#0f172a',
      gradientFrom: '#f59e0b',
      gradientVia: '#fbbf24',
      gradientTo: '#60a5fa',
    },
  },
];

export const DEFAULT_THEME = { template: 'heritage', colors: { ...HERITAGE_COLORS } };

export const templateById = (id) => TEMPLATES.find((item) => item.id === id) || TEMPLATES[0];

export const hexToRgb = (hex) => {
  const n = String(hex || '').replace('#', '');
  if (n.length !== 6) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
};

export const mixHex = (a, b, t) => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const h = (x) => Math.round(x).toString(16).padStart(2, '0');
  return `#${h(A.r + (B.r - A.r) * t)}${h(A.g + (B.g - A.g) * t)}${h(A.b + (B.b - A.b) * t)}`;
};

export const toRgb = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
};

export const themeVars = (theme = DEFAULT_THEME) => {
  const colors = { ...HERITAGE_COLORS, ...(theme.colors || {}) };
  const primaryPale = mixHex(colors.primary, '#ffffff', 0.88);
  const accentPale = mixHex(colors.accent, '#ffffff', 0.88);
  const primaryDark = mixHex(colors.primary, '#000000', 0.35);
  const accentDark = mixHex(colors.accent, '#000000', 0.28);
  const primaryLight = mixHex(colors.primary, '#ffffff', 0.32);
  const accentLight = mixHex(colors.accent, '#ffffff', 0.22);
  return {
    '--color-cardinal': colors.primary,
    '--color-cardinal-dark': primaryDark,
    '--color-cardinal-light': primaryLight,
    '--color-cardinal-pale': primaryPale,
    '--color-navy': colors.ink,
    '--color-navy-mid': primaryPale,
    '--color-crimson': colors.accent,
    '--color-crimson-dark': accentDark,
    '--color-crimson-light': accentLight,
    '--color-crimson-pale': accentPale,
    '--color-gold': colors.accent,
    '--color-ink': colors.ink,
    '--color-text': colors.text,
    '--color-text-muted': colors.textMuted,
    '--color-bg': colors.bg,
    '--color-bg-alt': colors.bgAlt,
    '--color-border': colors.border,
    '--color-paper': colors.paper,
    '--color-gradient-from': colors.gradientFrom,
    '--color-gradient-via': colors.gradientVia,
    '--color-gradient-to': colors.gradientTo,
    '--color-cardinal-rgb': toRgb(colors.primary),
    '--color-crimson-rgb': toRgb(colors.accent),
    '--color-ink-rgb': toRgb(colors.ink),
    '--color-paper-rgb': toRgb(colors.paper),
    '--color-bg-rgb': toRgb(colors.bg),
  };
};

const STYLE_KEYS = Object.keys(themeVars(DEFAULT_THEME));

export const applyTheme = (theme = DEFAULT_THEME) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const next = themeVars(theme);
  Object.entries(next).forEach(([key, value]) => root.style.setProperty(key, value));
  root.setAttribute('data-template', templateById(theme.template).id);
  root.style.background = next['--color-bg'];
  document.body.style.background = next['--color-bg'];
  document.body.style.color = next['--color-text'];
};

export const clearTheme = () => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  STYLE_KEYS.forEach((key) => root.style.removeProperty(key));
  root.removeAttribute('data-template');
  root.style.removeProperty('background');
  document.body.style.removeProperty('background');
  document.body.style.removeProperty('color');
};

export const normalizeTheme = (input) => {
  const template = templateById(input?.template);
  return {
    template: template.id,
    colors: { ...template.colors, ...(input?.colors || {}) },
  };
};
