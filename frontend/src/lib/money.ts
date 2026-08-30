export const formatMoney = (cents, currency = 'PKR') => {
  const amount = Number(cents || 0) / 100;
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const rupeesToCents = (value) => Math.round(Number(value || 0) * 100);

export const centsToRupees = (cents) => Number(cents || 0) / 100;
