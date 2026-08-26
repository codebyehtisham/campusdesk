import { CAMPUSDESK_MARK, CAMPUSDESK_NAME } from '../brand/product';

export default function CampusDeskMark({ size = 48, className = '' }) {
  const dim = typeof size === 'number' ? `${size}px` : size;
  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-[22%] bg-[#0F5C5C] ${className}`}
      style={{ width: dim, height: dim }}
    >
      <img
        src={CAMPUSDESK_MARK}
        alt={CAMPUSDESK_NAME}
        width={typeof size === 'number' ? size : 48}
        height={typeof size === 'number' ? size : 48}
        className="h-full w-full object-cover"
        draggable={false}
      />
    </span>
  );
}
