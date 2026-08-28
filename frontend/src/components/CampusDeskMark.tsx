import { CAMPUSDESK_APP_ICON, CAMPUSDESK_NAME } from '../brand/product';

export default function CampusDeskMark({ size = 48, className = '' }) {
  const dim = typeof size === 'number' ? `${size}px` : size;
  return (
    <img
      src={CAMPUSDESK_APP_ICON}
      alt={CAMPUSDESK_NAME}
      width={typeof size === 'number' ? size : 48}
      height={typeof size === 'number' ? size : 48}
      className={`inline-block shrink-0 rounded-[22%] object-cover ${className}`}
      style={{ width: dim, height: dim }}
      draggable={false}
    />
  );
}
