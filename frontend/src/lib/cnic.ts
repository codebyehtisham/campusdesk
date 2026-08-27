/** Pakistani CNIC: 34209-9090987-0 (13 digits / 15 chars with hyphens). */
export const CNIC_MAX_DIGITS = 13;
export const CNIC_MAX_LENGTH = 15;
export const CNIC_PATTERN = /^\d{5}-\d{7}-\d$/;

export const formatCnic = (raw) => {
  const digits = String(raw ?? '')
    .replace(/\D/g, '')
    .slice(0, CNIC_MAX_DIGITS);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
};

export const isCnicField = (field) =>
  field?.type === 'cnic' || String(field?.key || '').toLowerCase() === 'cnic';

export const isValidCnic = (value) => CNIC_PATTERN.test(formatCnic(value));
