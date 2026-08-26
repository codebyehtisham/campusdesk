export const TEMPLATES = ['heritage', 'atlas', 'editorial', 'lumen', 'nocturne'] as const;

const HEX = /^#([0-9a-f]{6})$/i;

export const COLOR_KEYS = [
  'primary',
  'accent',
  'ink',
  'text',
  'textMuted',
  'bg',
  'bgAlt',
  'border',
  'paper',
  'gradientFrom',
  'gradientVia',
  'gradientTo',
] as const;

export type ColorKey = (typeof COLOR_KEYS)[number];

export type ThemeColors = Record<ColorKey, string>;

export type SiteTheme = {
  template: (typeof TEMPLATES)[number];
  colors: ThemeColors;
};

export const DEFAULT_COLORS: ThemeColors = {
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

export const DEFAULT_THEME: SiteTheme = { template: 'heritage', colors: { ...DEFAULT_COLORS } };

const sanitizeColors = (input: unknown = {}): ThemeColors => {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_COLORS };
  for (const key of COLOR_KEYS) {
    const value = String(source[key] || '')
      .trim()
      .toLowerCase();
    if (HEX.test(value)) out[key] = value;
  }
  return out;
};

export const sanitizeTheme = (input: unknown = {}): SiteTheme => {
  const source = (input && typeof input === 'object' ? input : {}) as { template?: string; colors?: unknown };
  return {
    template: TEMPLATES.includes(source.template as SiteTheme['template'])
      ? (source.template as SiteTheme['template'])
      : DEFAULT_THEME.template,
    colors: sanitizeColors(source.colors),
  };
};
