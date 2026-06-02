import { AlertCircle, Check, CheckCircle2, UploadCloud } from 'lucide-react';
import { readFileAsText } from './arca.utils';

export const toneStyles = {
  neutral: {
    pill: 'bg-slate-800 text-slate-200 border-slate-700',
    dot: 'bg-slate-400',
    soft: 'bg-slate-900/70 border-slate-800 text-slate-300',
    icon: 'bg-slate-800 text-slate-200 border-slate-700',
  },
  success: {
    pill: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    dot: 'bg-emerald-400',
    soft: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200',
    icon: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  },
  warning: {
    pill: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    dot: 'bg-amber-400',
    soft: 'bg-amber-500/10 border-amber-500/20 text-amber-200',
    icon: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  },
  danger: {
    pill: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    dot: 'bg-rose-400',
    soft: 'bg-rose-500/10 border-rose-500/20 text-rose-200',
    icon: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  },
};

export const ui = {
  page: 'min-h-screen bg-[#060816] text-white',
  shell: 'mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8',
  panel: 'rounded-3xl border border-white/10 bg-[#0d1224] shadow-[0_10px_30px_rgba(0,0,0,0.25)]',
  panelHeader: 'flex flex-col gap-3 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between',
  panelBody: 'p-5',
  input: 'w-full rounded-2xl border border-white/10 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/15',
  textarea: 'w-full min-h-[130px] rounded-2xl border border-white/10 bg-[#0a1020] px-4 py-3 font-mono text-xs text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/15',
  label: 'mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400',
  hint: 'mt-1.5 text-xs text-slate-500',
  primaryBtn: 'inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
  secondaryBtn: 'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
  dangerBtn: 'inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-300 transition hover:bg-rose-500/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
};

export function StatusPill({ tone, children }: { tone: keyof typeof toneStyles; children: React.ReactNode }) {
  const s = toneStyles[tone];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${s.pill}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {children}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={ui.label}>{label}</label>
      {children}
      {hint ? <p className={ui.hint}>{hint}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  description?: string;
  icon: any;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={ui.panel}>
      <div className={ui.panelHeader}>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200">
            <Icon size={19} />
          </div>
          <div>
            <h2 className="text-base font-black text-white">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-relaxed text-slate-400">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={ui.panelBody}>{children}</div>
    </section>
  );
}

export function MetricCard({ label, value, icon: Icon, badge }: { label: string; value: string; icon: any; badge?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0b1122] p-4 shadow-[0_6px_24px_rgba(0,0,0,0.2)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400">
          <Icon size={17} />
        </div>
      </div>
      <p className="truncate text-lg font-black text-white">{value}</p>
      {badge ? <div className="mt-3">{badge}</div> : null}
    </div>
  );
}

export function InfoBox({ tone = 'neutral', icon: Icon = AlertCircle, children }: { tone?: keyof typeof toneStyles; icon?: any; children: React.ReactNode }) {
  const s = toneStyles[tone];

  return (
    <div className={`flex gap-3 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${s.soft}`}>
      <Icon size={17} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function ToggleChip({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        'inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition',
        checked
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
      ].join(' ')}
    >
      {checked ? <Check size={15} /> : <AlertCircle size={15} />}
      {label}
    </button>
  );
}

export function DropInput({
  label,
  accept,
  value,
  onFileText,
}: {
  label: string;
  accept: string;
  value: string;
  onFileText: (text: string) => void;
}) {
  return (
    <div>
      <label className={ui.label}>{label}</label>
      <label
        className={[
          'relative flex min-h-[132px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-5 py-6 text-center transition',
          value ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10',
        ].join(' ')}
      >
        <input
          type="file"
          accept={accept}
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const text = await readFileAsText(file);
            onFileText(text);
          }}
        />
        <div
          className={[
            'mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border',
            value
              ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
              : 'border-white/10 bg-[#0a1020] text-slate-400',
          ].join(' ')}
        >
          {value ? <CheckCircle2 size={20} /> : <UploadCloud size={20} />}
        </div>
        <p className={`text-sm font-black ${value ? 'text-emerald-300' : 'text-slate-200'}`}>
          {value ? 'Archivo cargado' : 'Seleccionar archivo'}
        </p>
        <p className="mt-1 text-xs text-slate-500">o pegá el contenido debajo</p>
      </label>
    </div>
  );
}
