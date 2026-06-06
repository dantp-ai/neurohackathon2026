/**
 * Shared design system for the EEG Elderly Monitoring app.
 *
 * One source of truth for colors, spacing, type, and radii so all four
 * teammates build screens that look like they belong to the same app.
 * Import from "@/theme" everywhere — never hard-code a hex value or a
 * magic number in a screen.
 *
 * Defaults lean large and high-contrast because the patient view targets
 * elderly users.
 */

export const colors = {
  // Surfaces
  background: '#F4F6F8', // app background (soft grey)
  surface: '#FFFFFF', // cards, sheets
  surfaceAlt: '#ECEFF3', // subtle alternate fill (e.g. unselected)

  // Text
  text: '#16202A', // primary text (near-black, high contrast)
  textMuted: '#5C6B7A', // secondary text, timestamps
  textInverse: '#FFFFFF', // text on colored backgrounds

  // Lines
  border: '#DCE2E8',

  // Brand / actions
  primary: '#208AEF', // primary action blue (matches splash)
  primaryDark: '#176FC1',

  // Wellness status (the green / yellow / red traffic-light system)
  statusGood: '#2EA66B',
  statusGoodBg: '#E4F5EC',
  statusWarn: '#E8A317',
  statusWarnBg: '#FBF1DC',
  statusBad: '#D64545',
  statusBadBg: '#FBE6E6',

  // Metric + chart accents — colorblind-safe (Okabe-Ito palette), distinguishable
  // across deuteranopia / protanopia / tritanopia.
  fatigue: '#E69F00', // orange  (shown as "Energy")
  attention: '#0072B2', // blue
  relaxation: '#009E73', // bluish green
  heart: '#D55E00', // vermillion (heart-rate line)
} as const;

/** Colors for the EEG frequency-band spectrum (delta → gamma). */
export const bandColors = {
  delta: '#6366F1',
  theta: '#7A5AF0',
  alpha: '#0EA5A0',
  beta: '#208AEF',
  gamma: '#E8730C',
} as const;

export type StatusLevel = 'good' | 'warn' | 'bad';

/** Map a status level to its foreground + background pair. */
export const statusColors: Record<StatusLevel, { fg: string; bg: string }> = {
  good: { fg: colors.statusGood, bg: colors.statusGoodBg },
  warn: { fg: colors.statusWarn, bg: colors.statusWarnBg },
  bad: { fg: colors.statusBad, bg: colors.statusBadBg },
};

/** 8pt-ish spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Corner radii. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/**
 * Type scale. Sizes run large on purpose — the patient view must be legible
 * for elderly users at arm's length.
 */
export const typography = {
  display: { fontSize: 40, fontWeight: '800' as const, lineHeight: 46 },
  title: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  heading: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  body: { fontSize: 18, fontWeight: '400' as const, lineHeight: 26 },
  bodyStrong: { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
  label: { fontSize: 15, fontWeight: '600' as const, lineHeight: 20 },
  caption: { fontSize: 14, fontWeight: '400' as const, lineHeight: 18 },
} as const;

export const theme = { colors, statusColors, spacing, radius, typography } as const;
export default theme;
