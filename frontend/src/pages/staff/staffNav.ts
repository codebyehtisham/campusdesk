export const leaveNavItem = (base) => ({ to: `${base}/leave`, label: 'Leave', end: true });

export const withLeaveNav = (base, nav = []) => [...nav, leaveNavItem(base)];
