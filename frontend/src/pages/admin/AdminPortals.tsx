import { Link } from 'react-router-dom';
import { getAdmin } from '../../auth/adminSession';
import { ADMIN_BASE } from '../../admin/paths';
import { adminScreensForOrg, delegatedPortalsForOrg } from '../../data/adminOwnership';
import { roleLabel } from '../../data/roles';

export default function AdminPortals() {
  const modules = getAdmin()?.modules || [];
  const portals = delegatedPortalsForOrg(modules);
  const adminScreens = adminScreensForOrg(modules);

  const screensByGroup = adminScreens.reduce((acc, screen) => {
    const group = screen.group;
    acc[group] = acc[group] || [];
    acc[group].push(screen);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-8">
      <div>
        <span className="eyebrow">Organisation</span>
        <h1 className="mb-2 text-[clamp(2rem,4vw,3.2rem)]">Team portals</h1>
        <p className="m-0 max-w-3xl text-text-muted">
          Day-to-day operations run in role-based staff portals. Use this console to set up structure, create users, and
          oversee campus services — then send each team to their sign-in URL.
        </p>
      </div>

      <section className="glass rounded-[1.8rem] p-6 md:p-8">
        <h2 className="mt-0 text-[1.35rem]">Delegated to staff portals</h2>
        <p className="m-0 mb-6 max-w-3xl text-sm text-text-muted">
          These functions are owned by specialist roles. Create users in{' '}
          <Link to={`${ADMIN_BASE}/users`} className="font-semibold text-cardinal">
            Staff users
          </Link>{' '}
          and share the matching portal URL.
        </p>

        {portals.length === 0 ? (
          <p className="m-0 text-sm text-text-muted">No staff portals are enabled for this subscription yet.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {portals.map((portal) => (
              <article key={portal.key} className="rounded-[1.4rem] border border-border bg-white/80 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="m-0 text-lg">{portal.label}</h3>
                    <p className="m-0 mt-1 text-sm text-text-muted">{portal.audience}</p>
                    <p className="m-0 mt-3 text-sm">
                      <span className="font-semibold text-ink">Roles:</span>{' '}
                      {portal.roles.map((role) => roleLabel(role)).join(', ')}
                    </p>
                  </div>
                  <a href={portal.path} target="_blank" rel="noreferrer" className="btn btn-primary shrink-0 py-2 text-sm">
                    Open sign-in
                  </a>
                </div>
                <code className="mt-4 block rounded-xl bg-bg-alt px-3 py-2 text-xs font-mono text-ink">{portal.path}</code>
                <ul className="m-0 mt-4 grid gap-1.5 pl-4 text-sm text-text-muted">
                  {portal.owns.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="glass rounded-[1.8rem] p-6 md:p-8">
        <h2 className="mt-0 text-[1.35rem]">Stays in org admin</h2>
        <p className="m-0 mb-6 max-w-3xl text-sm text-text-muted">
          Configuration, structure, and campus-wide oversight remain in this console.
        </p>

        <div className="grid gap-6 lg:grid-cols-2">
          {Object.entries(screensByGroup).map(([group, screens]) => (
            <div key={group}>
              <h3 className="mb-3 text-base">{group}</h3>
              <div className="grid gap-3">
                {screens.map((screen) => (
                  <Link
                    key={screen.key}
                    to={screen.to}
                    className="block rounded-[1.2rem] border border-border bg-white/70 p-4 no-underline text-inherit transition hover:border-cardinal/30"
                  >
                    <strong className="text-ink">{screen.label}</strong>
                    <p className="m-0 mt-1 text-sm text-text-muted">{screen.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
