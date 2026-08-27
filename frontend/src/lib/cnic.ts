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

/** Pakistani mobile: 03001234567 (11 digits). */
export const PHONE_MAX_DIGITS = 11;
export const PHONE_PATTERN = /^\d{11}$/;

export const formatPhone = (raw) =>
  String(raw ?? '')
    .replace(/\D/g, '')
    .slice(0, PHONE_MAX_DIGITS);

export const isPhoneField = (field) => {
  const key = String(field?.key || '').toLowerCase();
  return field?.type === 'tel' || key === 'phone' || key === 'mobile' || key === 'mobile_number';
};

export const isValidPhone = (value) => PHONE_PATTERN.test(formatPhone(value));
