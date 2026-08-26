import { brandAlt, brandLogo, brandTitle, initials } from '../brand/brand';

export default function BrandMark({ org, size = 48, className = '' }) {
  const src = brandLogo(org);
  const title = brandTitle(org);
  const dim = typeof size === 'number' ? `${size}px` : size;

  if (src) {
    return (
      <img
        src={src}
        alt={brandAlt(org)}
        width={typeof size === 'number' ? size : 48}
        height={typeof size === 'number' ? size : 48}
        className={`rounded-full object-cover ${className}`}
        style={{ width: dim, height: dim }}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-cardinal-pale font-serif font-bold text-cardinal ${className}`}
      style={{ width: dim, height: dim, fontSize: typeof size === 'number' ? size * 0.36 : '0.9rem' }}
      aria-hidden="true"
    >
      {initials(org)}
    </span>
  );
}

