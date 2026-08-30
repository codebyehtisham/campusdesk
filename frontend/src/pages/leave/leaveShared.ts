export const LEAVE_TYPE_LABELS = {
  sick: 'Sick leave',
  casual: 'Casual leave',
  maternity: 'Maternity leave',
  annual: 'Annual leave',
};

export const LEAVE_TYPE_ORDER = ['annual', 'sick', 'casual', 'maternity'];

export function leaveStatusClass(status) {
  if (status === 'approved') return 'bg-cardinal-pale text-cardinal';
  if (status === 'rejected') return 'bg-crimson-pale text-crimson';
  return 'bg-bg-alt text-ink';
}
