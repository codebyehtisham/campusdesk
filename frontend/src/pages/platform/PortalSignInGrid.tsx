import { INSTITUTE_PORTALS } from '../../data/portals';

export default function PortalSignInGrid({ compact = false }) {
  return (
    <div className={`pc-portal-grid ${compact ? 'is-compact' : ''}`}>
      {INSTITUTE_PORTALS.map((portal) => (
        <article key={portal.key} className="pc-portal-card">
          <div>
            <p className="pc-portal-card-label">{portal.label}</p>
            <p className="pc-portal-card-audience">{portal.audience}</p>
          </div>
          <code className="pc-portal-card-path">{portal.path}</code>
        </article>
      ))}
    </div>
  );
}
