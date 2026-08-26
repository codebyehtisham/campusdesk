import { COLOR_FIELDS, TEMPLATES, templateById } from '../../theme/catalog';

const groups = [...new Set(COLOR_FIELDS.map((item) => item.group))];

function MiniSite({ theme }) {
  const colors = theme.colors;
  const template = templateById(theme.template);
  const radius =
    template.id === 'editorial' ? '4px' : template.id === 'atlas' ? '10px' : template.id === 'lumen' ? '22px' : '999px';
  const dark = template.id === 'nocturne';

  return (
    <div
      className="overflow-hidden border"
      style={{
        background: colors.bg,
        borderColor: colors.border,
        borderRadius: template.id === 'editorial' ? 6 : 18,
        color: colors.text,
      }}
    >
      <div className="flex items-center gap-1 border-b px-3 py-2" style={{ borderColor: colors.border, background: colors.paper }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: colors.accent }} />
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: colors.primary }} />
        <span className="ml-2 text-[0.65rem] font-semibold" style={{ color: colors.textMuted }}>
          {template.name} preview
        </span>
      </div>
      <div className="p-3">
        <div
          className="mb-3 flex items-center justify-between px-3 py-2"
          style={{ background: dark ? colors.paper : colors.bgAlt, borderRadius: radius }}
        >
          <span className="text-[0.7rem] font-bold" style={{ color: colors.ink }}>
            Campus
          </span>
          <span className="px-2 py-1 text-[0.6rem] font-bold text-white" style={{ background: colors.accent, borderRadius: radius }}>
            Apply
          </span>
        </div>
        <p className="mb-1 text-[0.58rem] font-bold tracking-[0.16em] uppercase" style={{ color: colors.accent }}>
          Admissions
        </p>
        <p className="mb-2 text-sm font-extrabold" style={{ color: colors.ink, fontFamily: template.id === 'editorial' ? 'Georgia, serif' : 'inherit' }}>
          Educating the next generation.
        </p>
        <div
          className="h-10"
          style={{
            borderRadius: template.id === 'editorial' ? 4 : 14,
            background: `linear-gradient(135deg, ${colors.gradientFrom}, ${colors.gradientVia}, ${colors.gradientTo})`,
          }}
        />
      </div>
    </div>
  );
}

export default function ThemeStudio({ theme, onChange }) {
  const setTemplate = (id) => {
    const next = templateById(id);
    onChange({ template: next.id, colors: { ...next.colors } });
  };

  const setColor = (key, value) => {
    onChange({ ...theme, colors: { ...theme.colors, [key]: value } });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="m-0 text-sm font-semibold text-ink">Public site template</p>
        <p className="mt-1 mb-4 text-sm text-text-muted">
          Layout, type, and surface shape for this organisation’s public website. Super admin only — org admins cannot change this.
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {TEMPLATES.map((item) => {
            const active = theme.template === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTemplate(item.id)}
                className={`rounded-[1rem] border p-4 text-left transition-colors ${
                  active ? 'border-cardinal bg-cardinal-pale' : 'border-border bg-white hover:border-cardinal/40'
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <strong className="text-ink">{item.name}</strong>
                  {item.badge && <span className="tag tag-allied">{item.badge}</span>}
                  {active && <span className="tag tag-nursing">Selected</span>}
                </div>
                <MiniSite theme={{ template: item.id, colors: item.colors }} />
                <p className="mt-3 mb-0 text-sm text-text-muted">{item.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="m-0 text-sm font-semibold text-ink">Colour scheme</p>
        <p className="mt-1 mb-4 text-sm text-text-muted">
          These tokens drive text, surfaces, buttons, and the background glow on the public site. Picking a template loads its palette; you can then tune every colour.
        </p>
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="flex flex-col gap-5">
            {groups.map((group) => (
              <div key={group}>
                <p className="mb-3 text-[0.7rem] font-semibold tracking-[0.16em] text-text-muted uppercase">{group}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {COLOR_FIELDS.filter((item) => item.group === group).map((item) => (
                    <label key={item.key} className="flex items-center gap-3 rounded-[12px] border border-border bg-white px-3 py-2.5 text-sm font-semibold text-ink">
                      <input
                        type="color"
                        className="h-10 w-10 shrink-0 cursor-pointer rounded-xl border border-border bg-white"
                        value={theme.colors[item.key]}
                        onChange={(e) => setColor(item.key, e.target.value)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block">{item.label}</span>
                        <input
                          className="mt-1 w-full border-0 bg-transparent p-0 font-mono text-xs font-medium text-text-muted outline-none"
                          defaultValue={theme.colors[item.key]}
                          key={`${item.key}-${theme.colors[item.key]}`}
                          onBlur={(e) => {
                            const value = e.target.value.trim().toLowerCase();
                            if (/^#([0-9a-f]{6})$/.test(value)) setColor(item.key, value);
                            else e.target.value = theme.colors[item.key];
                          }}
                        />
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-3 text-[0.7rem] font-semibold tracking-[0.16em] text-text-muted uppercase">Live mock</p>
            <MiniSite theme={theme} />
            <a href="/" target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-semibold text-cardinal">
              Open public site →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
