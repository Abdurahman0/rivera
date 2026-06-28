export const THEME_STORAGE_KEY = 'rivera-theme';
export const ACCENT_STORAGE_KEY = 'rivera-background-accent';
export const DEFAULT_BACKGROUND_ACCENT = '#6366f1';

export const BACKGROUND_COLOR_PRESETS = [
  { value: '#6366f1', key: 'indigo' },
  { value: '#0f766e', key: 'teal' },
  { value: '#059669', key: 'emerald' },
  { value: '#c2418c', key: 'fuchsia' },
  { value: '#d97706', key: 'amber' },
  { value: '#475569', key: 'slate' },
] as const;

interface PaletteVars {
  primary: string;
  foreground: string;
  accent: string;
  soft: string;
  strong: string;
  textAccent: string;
  borderAccent: string;
}

export const COLOR_PALETTES: Record<string, { light: PaletteVars; dark: PaletteVars }> = {
  '#6366f1': {
    light: { primary: '99 102 241',  foreground: '255 255 255', accent: '79 70 229',   soft: '224 231 255', strong: '67 56 202',   textAccent: '99 102 241',  borderAccent: '199 210 254' },
    dark:  { primary: '129 140 248', foreground: '255 255 255', accent: '99 102 241',  soft: '49 46 129',  strong: '165 180 252', textAccent: '165 180 252', borderAccent: '99 102 241' },
  },
  '#0f766e': {
    light: { primary: '13 148 136',  foreground: '255 255 255', accent: '15 118 110',  soft: '204 251 241', strong: '17 94 89',   textAccent: '13 148 136',  borderAccent: '153 246 228' },
    dark:  { primary: '45 212 191',  foreground: '19 78 74',    accent: '20 184 166',  soft: '19 78 74',   strong: '94 234 212',  textAccent: '94 234 212',  borderAccent: '20 184 166' },
  },
  '#059669': {
    light: { primary: '5 150 105',   foreground: '255 255 255', accent: '4 120 87',    soft: '209 250 229', strong: '6 95 70',    textAccent: '5 150 105',   borderAccent: '167 243 208' },
    dark:  { primary: '52 211 153',  foreground: '6 78 59',     accent: '16 185 129',  soft: '6 78 59',    strong: '110 231 183', textAccent: '110 231 183', borderAccent: '16 185 129' },
  },
  '#c2418c': {
    light: { primary: '219 39 119',  foreground: '255 255 255', accent: '190 24 93',   soft: '252 231 243', strong: '157 23 77',  textAccent: '219 39 119',  borderAccent: '249 168 212' },
    dark:  { primary: '244 114 182', foreground: '131 24 67',   accent: '236 72 153',  soft: '131 24 67',  strong: '249 168 212', textAccent: '249 168 212', borderAccent: '236 72 153' },
  },
  '#d97706': {
    light: { primary: '180 83 9',    foreground: '255 255 255', accent: '146 64 14',   soft: '254 243 199', strong: '120 53 15',  textAccent: '180 83 9',    borderAccent: '253 230 138' },
    dark:  { primary: '251 191 36',  foreground: '120 53 15',   accent: '245 158 11',  soft: '120 53 15',  strong: '252 211 77',  textAccent: '252 211 77',  borderAccent: '245 158 11' },
  },
  '#475569': {
    light: { primary: '71 85 105',   foreground: '255 255 255', accent: '51 65 85',    soft: '241 245 249', strong: '30 41 59',   textAccent: '71 85 105',   borderAccent: '203 213 225' },
    dark:  { primary: '148 163 184', foreground: '15 23 42',    accent: '100 116 139', soft: '51 65 85',   strong: '203 213 225', textAccent: '203 213 225', borderAccent: '100 116 139' },
  },
};

export function applyColorPalette(accentHex: string, theme: 'light' | 'dark') {
  const palette = COLOR_PALETTES[accentHex];
  if (!palette) return;
  const v = theme === 'dark' ? palette.dark : palette.light;
  const root = document.documentElement;
  root.style.setProperty('--color-primary', v.primary);
  root.style.setProperty('--color-primary-foreground', v.foreground);
  root.style.setProperty('--color-primary-accent', v.accent);
  root.style.setProperty('--color-primary-soft', v.soft);
  root.style.setProperty('--color-primary-strong', v.strong);
  root.style.setProperty('--color-text-accent', v.textAccent);
  root.style.setProperty('--color-border-accent', v.borderAccent);
}
