import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';

export const WEEKDAYS = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 7, label: 'Sunday', short: 'Sun' },
] as const;

export const QR_TTL_MS = 30 * 60 * 1000;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const parseDay = (value: unknown) => {
  const day = Number(value);
  return day >= 1 && day <= 7 ? day : null;
};

export const parseTime = (value: unknown) => {
  const time = String(value || '').trim();
  return TIME.test(time) ? time : null;
};

export const minutes = (hhmm: string) => {
  const [hours, mins] = hhmm.split(':').map(Number);
  return hours * 60 + mins;
};

export const jsToWeekday = (date: Date) => {
  const day = date.getDay();
  return day === 0 ? 7 : day;
};

export const dayStamp = (value?: unknown) => {
  const raw = String(value || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

export const newQrToken = () => randomBytes(16).toString('hex');

export const qrPayload = (token: string) => `explore-attend:${token}`;

export const qrImage = (token: string) =>
  QRCode.toDataURL(qrPayload(token), {
    width: 280,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#1a4fd6', light: '#ffffff' },
  });
