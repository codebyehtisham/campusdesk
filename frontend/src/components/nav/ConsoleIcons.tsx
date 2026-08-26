type IconProps = { className?: string };

const stroke = { strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function IconDashboard({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" {...stroke} />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" {...stroke} />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" stroke="currentColor" {...stroke} />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" stroke="currentColor" {...stroke} />
    </svg>
  );
}

export function IconUsers({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="5.5" r="2.2" stroke="currentColor" {...stroke} />
      <path d="M2 13.5c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" {...stroke} />
      <path d="M11 6.2a1.8 1.8 0 1 0 0-3.6M11 8.5c1.6 0 3 1.1 3.5 2.8" stroke="currentColor" {...stroke} />
    </svg>
  );
}

export function IconClipboard({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3.5" y="2.5" width="9" height="11" rx="1.4" stroke="currentColor" {...stroke} />
      <path d="M6 2.5V4a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V2.5" stroke="currentColor" {...stroke} />
    </svg>
  );
}

export function IconShield({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.8 2.5 4v4.2c0 3.1 2.3 5.9 5.5 6.8 3.2-.9 5.5-3.7 5.5-6.8V4L8 1.8Z" stroke="currentColor" {...stroke} />
    </svg>
  );
}

export function IconBook({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 3.5h4.8a1.2 1.2 0 0 1 1.2 1.2V13L5.4 11.2 2.5 13V3.5Z" stroke="currentColor" {...stroke} />
      <path d="M13.5 3.5H8.7a1.2 1.2 0 0 0-1.2 1.2V13l2.1-1.8 2.9 1.8V3.5Z" stroke="currentColor" {...stroke} />
    </svg>
  );
}

export function IconCalendar({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="10.5" rx="1.4" stroke="currentColor" {...stroke} />
      <path d="M5 1.8V4.2M11 1.8V4.2M2 6.8h12" stroke="currentColor" {...stroke} />
    </svg>
  );
}

export function IconBriefcase({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="5" width="13" height="8.5" rx="1.4" stroke="currentColor" {...stroke} />
      <path d="M5.5 5V4a1.8 1.8 0 0 1 1.8-1.8h2.4A1.8 1.8 0 0 1 11.5 4v1" stroke="currentColor" {...stroke} />
    </svg>
  );
}

export function IconCheck({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.8" stroke="currentColor" {...stroke} />
      <path d="M5.2 8.1 7.1 10l3.7-3.8" stroke="currentColor" {...stroke} />
    </svg>
  );
}

export function IconLayers({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2 2.5 5 8 8l5.5-3L8 2Z" stroke="currentColor" {...stroke} />
      <path d="M2.5 8 8 11l5.5-3M2.5 11 8 14l5.5-3" stroke="currentColor" {...stroke} />
    </svg>
  );
}

export function IconPalette({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.8a6.2 6.2 0 1 0 0 12.4c1.4 0 2.2-1.2 1.6-2.4a1.6 1.6 0 0 1 1.5-2.2h1.7a2.8 2.8 0 0 0 0-5.6H12a6.2 6.2 0 0 0-4-2.2Z"
        stroke="currentColor"
        {...stroke}
      />
      <circle cx="5.4" cy="6.2" r="0.75" fill="currentColor" />
      <circle cx="7.8" cy="4.8" r="0.75" fill="currentColor" />
      <circle cx="10.2" cy="6.2" r="0.75" fill="currentColor" />
    </svg>
  );
}

export function IconLock({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.4" stroke="currentColor" {...stroke} />
      <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" {...stroke} />
    </svg>
  );
}

export function IconBuildings({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 14V5.5L8 2.5l5.5 3V14" stroke="currentColor" {...stroke} />
      <path d="M6 14V9h4v5" stroke="currentColor" {...stroke} />
    </svg>
  );
}

export function IconSwitches({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="4.2" rx="2.1" stroke="currentColor" {...stroke} />
      <circle cx="11.2" cy="4.6" r="1.35" fill="currentColor" />
      <rect x="1.5" y="9.3" width="13" height="4.2" rx="2.1" stroke="currentColor" {...stroke} />
      <circle cx="4.8" cy="11.4" r="1.35" fill="currentColor" />
    </svg>
  );
}

export function IconCard({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.6" stroke="currentColor" {...stroke} />
      <path d="M1.5 6.4h13" stroke="currentColor" {...stroke} />
    </svg>
  );
}

export function IconPulse({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1.5 8h3l1.4-3.5 2.4 7L10.2 6l1.3 2h3" stroke="currentColor" {...stroke} />
    </svg>
  );
}

export function IconKey({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="8" r="2.6" stroke="currentColor" {...stroke} />
      <path d="M8.4 8H14v2.2M11.2 8v2.2" stroke="currentColor" {...stroke} />
    </svg>
  );
}

const ADMIN_ICON_BY_SUFFIX: Record<string, typeof IconDashboard> = {
  dashboard: IconDashboard,
  admissions: IconClipboard,
  users: IconUsers,
  access: IconShield,
  classes: IconBook,
  timetable: IconCalendar,
  careers: IconBriefcase,
  'attendance/students': IconCheck,
  'attendance/insights': IconPulse,
  'attendance/staff': IconCheck,
  units: IconLayers,
  brand: IconPalette,
  settings: IconLock,
};

export function adminNavIcon(path: string) {
  const suffix = path.replace(/^.*\/org-admin\/?/, '').replace(/^\//, '') || 'dashboard';
  return ADMIN_ICON_BY_SUFFIX[suffix] || IconDashboard;
}
