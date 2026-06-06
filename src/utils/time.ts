/** Lightweight relative + clock time formatting for the UI. */
import i18n from '@/i18n';

/** "just now" / "3 min ago" / "2 h ago" / "Mon" — for list timestamps. Locale-aware. */
export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return i18n.t('time.justNow');
  if (min < 60) return i18n.t('time.minAgo', { n: min });
  const hours = Math.round(min / 60);
  if (hours < 24) return i18n.t('time.hAgo', { n: hours });
  const days = Math.round(hours / 24);
  if (days < 7) return i18n.t('time.dAgo', { n: days });
  return new Date(iso).toLocaleDateString(i18n.language === 'zh-Hans' ? 'zh-CN' : undefined);
}

/** "2:30 PM" — clock time for message bubbles. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
