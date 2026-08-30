import { Link } from 'react-router-dom';

export default function StaffComingSoon({ title, hint, base }) {
  return (
    <div className="glass rounded-[1.5rem] p-8 md:p-10">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-cardinal">Coming soon</p>
      <h1 className="mb-3 font-serif text-2xl font-bold text-ink">{title}</h1>
      <p className="mb-6 max-w-xl text-sm leading-relaxed text-text-muted">{hint}</p>
      <p className="m-0 text-sm text-text-muted">
        Your role and portal are ready. Module screens will appear here as they are enabled for your institute.
      </p>
      <Link to={`${base}/password`} className="btn btn-outline mt-6 inline-flex">
        Account password
      </Link>
    </div>
  );
}
