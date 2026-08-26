import { CAMPUSDESK_MARK, CAMPUSDESK_NAME } from '../brand/product';

export default function CampusDeskMark({ size = 48, className = '' }) {
  const dim = typeof size === 'number' ? `${size}px` : size;
  return (
    <img
      src={CAMPUSDESK_MARK}
      alt={CAMPUSDESK_NAME}
      width={typeof size === 'number' ? size : 48}
      height={typeof size === 'number' ? size : 48}
      className={`rounded-[22%] object-cover ${className}`}
      style={{ width: dim, height: dim }}
    />
  );
}
