import { LEAVE_TYPE_LABELS, LEAVE_TYPE_ORDER } from './leaveShared';

export default function LeaveBalanceCards({ balance, compact = false }) {
  if (!balance?.types) return null;

  return (
    <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
      {LEAVE_TYPE_ORDER.map((type) => {
        const row = balance.types[type];
        if (!row) return null;
        return (
          <article key={type} className="glass rounded-[1.2rem] p-4">
            <p className="m-0 text-xs font-bold tracking-wide text-text-muted uppercase">{LEAVE_TYPE_LABELS[type]}</p>
            <p className="m-0 mt-2 text-2xl font-bold text-ink">{row.remaining}</p>
            <p className="m-0 mt-1 text-sm text-text-muted">
              remaining of {row.allowance}
              {row.pending ? ` · ${row.pending} pending` : ''}
            </p>
          </article>
        );
      })}
    </div>
  );
}
