export default function LocationMatchBadge({ location, status }) {
  if (status !== 'present' || !location || location.onCampus == null) return null;
  const onCampus = Boolean(location.onCampus);
  const distance =
    location.distanceMeters != null ? `${Math.round(location.distanceMeters)} m from campus` : null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.68rem] font-bold ${
        onCampus ? 'bg-emerald-100 text-emerald-800' : 'bg-crimson-pale text-crimson-dark'
      }`}
    >
      {onCampus ? 'Onsite' : distance ? `Not onsite · ${distance}` : 'Not onsite'}
    </span>
  );
}
