'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { arcaConfigApi } from '../service/arcaConfigApi';
import type { ArcaConfig, ArcaConfigPayload, ArcaPointOfSale } from '@/types/arca';
import {
  AlertCircle, Building2, CheckCircle2, ChevronRight, ClipboardCheck,
  FileKey2, KeyRound, Loader2, Plus, RefreshCw, Save, ServerCog,
  ShieldCheck, TestTube2, Trash2, UploadCloud, Wifi, XCircle, Zap,
  PlugZap, CheckCircle, ArrowRight,
} from 'lucide-react';

const IVA_CONDITIONS = ['Responsable Inscripto', 'Monotributista', 'Exento', 'Consumidor Final'];

const CBTE_TYPES = [
  { id: 1,  label: 'Factura A' },
  { id: 6,  label: 'Factura B' },
  { id: 11, label: 'Factura C' },
  { id: 3,  label: 'NC A' },
  { id: 8,  label: 'NC B' },
  { id: 13, label: 'NC C' },
  { id: 2,  label: 'ND A' },
  { id: 7,  label: 'ND B' },
  { id: 12, label: 'ND C' },
];

function onlyDigits(value: string) { return value.replace(/\D/g, ''); }

function formatDate(value?: string | null) {
  if (!value) return 'Sin dato';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin dato';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function maskCuit(cuit?: string | null) {
  const digits = onlyDigits(cuit || '');
  if (digits.length !== 11) return cuit || '—';
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const err = error as any;
    return err.response?.data?.message || err.response?.data?.error || err.message || 'Ocurrió un error';
  }
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error';
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function getStatus(config?: ArcaConfig | null) {
  if (!config)                                         return { label: 'Sin configurar',  title: 'Configuración pendiente', variant: 'gray'  as const, icon: AlertCircle  };
  if (config.status === 'ACTIVE' && config.isActive)  return { label: 'Activo',           title: 'Listo para facturar',     variant: 'green' as const, icon: CheckCircle2 };
  if (config.status === 'ERROR')                       return { label: 'Error',            title: 'Revisar conexión',        variant: 'red'   as const, icon: XCircle      };
  return                                                      { label: 'Incompleto',       title: 'Faltan datos',            variant: 'amber' as const, icon: AlertCircle  };
}

/* ─── Tokens ─────────────────────────────────────────────────── */
const t = {
  // Layout
  page:    'min-h-screen bg-slate-50',
  body:    'mx-auto max-w-6xl px-6 py-6',
  cols:    'grid gap-6 lg:grid-cols-[1fr_300px]',
  stack:   'flex flex-col gap-5',

  // Card / Panel
  card:    'rounded-2xl border border-slate-200 bg-white shadow-sm',
  cardHd:  'flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4',
  cardBd:  'p-6',

  // Icon badge
  iconWrap: 'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500',

  // Form
  label:   'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400',
  input:   [
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800',
    'placeholder:text-slate-300 outline-none transition',
    'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100',
    'disabled:bg-slate-50 disabled:cursor-not-allowed',
  ].join(' '),
  hint:    'mt-1 text-[11px] text-slate-400',

  // Buttons
  btnPrimary: [
    'inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white',
    'hover:bg-indigo-700 active:scale-[0.98] transition-all',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
  btnSecondary: [
    'inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600',
    'hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
  btnDanger: [
    'inline-flex shrink-0 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600',
    'hover:bg-red-100 active:scale-[0.98] transition-all',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),

  // Divider
  divider: 'my-5 border-t border-slate-100',
};

/* ─── Mini components ────────────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return <p className={t.label}>{children}</p>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && <p className={t.hint}>{hint}</p>}
    </div>
  );
}

function Divider() { return <hr className={t.divider} />; }

function Panel({
  title, description, icon: Icon, children, action, accent,
}: {
  title: string; description?: string; icon: any;
  children: React.ReactNode; action?: React.ReactNode;
  accent?: 'green' | 'amber' | 'red';
}) {
  const accentBar = {
    green: 'before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-l-2xl before:bg-emerald-400',
    amber: 'before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-l-2xl before:bg-amber-400',
    red:   'before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-l-2xl before:bg-red-400',
  };

  return (
    <section className={`relative ${t.card} ${accent ? accentBar[accent] : ''}`}>
      <div className={t.cardHd}>
        <div className="flex items-center gap-3">
          <div className={t.iconWrap}>
            <Icon size={15} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            {description && <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={t.cardBd}>{children}</div>
    </section>
  );
}

/* Status badge variants */
const statusStyles = {
  gray:  { bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400'   },
  green: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  amber: { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  red:   { bg: 'bg-red-100',     text: 'text-red-600',     dot: 'bg-red-500'     },
};

function StatusBadge({ variant = 'gray', label }: { variant?: keyof typeof statusStyles; label: string }) {
  const s = statusStyles[variant];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}

function StatBar({ config, form }: { config: ArcaConfig | null; form: any }) {
  const status = getStatus(config);
  const certLoaded = Boolean(config?.certEncrypted && config?.keyEncrypted);

  const items = [
    {
      label: 'Estado',
      value: status.title,
      badge: <StatusBadge variant={status.variant} label={status.label} />,
      icon: status.icon,
    },
    {
      label: 'CUIT',
      value: maskCuit(config?.cuit || form.cuit) || 'Sin CUIT',
      badge: null,
      icon: Building2,
    },
    {
      label: 'Ambiente',
      value: config?.environment || form.environment,
      badge: <StatusBadge variant="amber" label={form.environment === 'PRODUCCION' ? 'Real' : 'Pruebas'} />,
      icon: ServerCog,
    },
    {
      label: 'Certificado',
      value: certLoaded ? 'Cargado' : 'Faltante',
      badge: <StatusBadge variant={certLoaded ? 'green' : 'red'} label={certLoaded ? 'OK' : 'Pendiente'} />,
      icon: FileKey2,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map(({ label, value, badge, icon: Icon }) => (
        <div key={label} className={`${t.card} px-4 py-3.5`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className={t.label}>{label}</p>
            <Icon size={14} className="text-slate-300 mt-0.5 shrink-0" strokeWidth={1.75} />
          </div>
          <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
          {badge && <div className="mt-2">{badge}</div>}
        </div>
      ))}
    </div>
  );
}

function CbteToggle({ id, label, checked, onToggle }: { id: number; label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'rounded-xl border px-3 py-2 text-center text-xs font-medium transition-all',
        checked
          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all',
        checked
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
      ].join(' ')}
    >
      {checked ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
      {label}
    </button>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function ArcaConfigPage() {
  const [config, setConfig]           = useState<ArcaConfig | null>(null);
  const [points, setPoints]           = useState<ArcaPointOfSale[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [testing, setTesting]         = useState<'wsaa' | 'wsfe' | null>(null);
  const [certSaving, setCertSaving]   = useState(false);
  const [pointSaving, setPointSaving] = useState(false);
  const [message, setMessage]         = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState<ArcaConfigPayload>({
    businessName: 'Grupo VJ',
    cuit: '',
    ivaCondition: 'Responsable Inscripto',
    fiscalAddress: '',
    activityStart: '',
    environment: 'HOMOLOGACION',
    pointOfSale: '',
  });

  const [certText, setCertText]           = useState('');
  const [keyText, setKeyText]             = useState('');
  const [certExpiresAt, setCertExpiresAt] = useState('');

  const [pointForm, setPointForm] = useState({
    number: '',
    description: 'Punto de venta Web Service',
    isDefault: true,
    enabled: true,
    enabledCbteTypes: [1, 6, 3, 8] as number[],
  });

  const certLoaded   = Boolean(config?.certEncrypted && config?.keyEncrypted);
  const defaultPoint = points.find((p) => p.isDefault) || points[0];

  const checklist = [
    { ok: Boolean(form.cuit && form.cuit.length === 11), text: 'CUIT cargado (11 dígitos)' },
    { ok: Boolean(form.businessName?.trim()),            text: 'Razón social cargada' },
    { ok: certLoaded,                                    text: 'Certificado y private key' },
    { ok: points.length > 0,                             text: 'Punto de venta configurado' },
    { ok: Boolean(config?.isActive),                     text: 'Configuración activada' },
  ];
  const progress = Math.round((checklist.filter((i) => i.ok).length / checklist.length) * 100);

  async function load() {
    setLoading(true); setMessage(null);
    try {
      const current = await arcaConfigApi.getConfig().catch(() => null);
      setConfig(current);
      if (current) {
        const pts = current.pointsOfSale || [];
        const def = pts.find((p) => p.isDefault) || pts[0];
        setForm({
          businessName: current.businessName || 'Grupo VJ',
          cuit: current.cuit || '',
          ivaCondition: current.ivaCondition || 'Responsable Inscripto',
          fiscalAddress: current.fiscalAddress || '',
          activityStart: current.activityStart ? current.activityStart.slice(0, 10) : '',
          environment: current.environment || 'HOMOLOGACION',
          pointOfSale: def?.number || '',
        });
        setCertExpiresAt(current.certExpiresAt ? current.certExpiresAt.slice(0, 10) : '');
        setPoints(pts);
      } else {
        setPoints([]);
      }
    } catch (e) {
      setMessage({ type: 'error', text: getErrorMessage(e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveConfig() {
    setSaving(true); setMessage(null);
    try {
      const saved = await arcaConfigApi.saveConfig({ ...form, cuit: onlyDigits(String(form.cuit || '')) });
      setConfig(saved);
      setMessage({ type: 'success', text: 'Configuración fiscal guardada.' });
      await load();
    } catch (e) { setMessage({ type: 'error', text: getErrorMessage(e) }); }
    finally { setSaving(false); }
  }

  async function saveCertificate() {
    setCertSaving(true); setMessage(null);
    try {
      if (!certText.trim()) throw new Error('Tenés que cargar o pegar el certificado.');
      if (!keyText.trim())  throw new Error('Tenés que cargar o pegar la private key.');
      await arcaConfigApi.uploadCertificates({ certPem: certText, keyPem: keyText, certExpiresAt: certExpiresAt || null });
      setCertText(''); setKeyText('');
      setMessage({ type: 'success', text: 'Certificado y private key guardados.' });
      await load();
    } catch (e) { setMessage({ type: 'error', text: getErrorMessage(e) }); }
    finally { setCertSaving(false); }
  }

  async function deleteCertificates() {
    if (!window.confirm('¿Eliminar el certificado y la private key?')) return;
    setCertSaving(true); setMessage(null);
    try {
      await arcaConfigApi.deleteCertificates();
      setCertText(''); setKeyText('');
      setMessage({ type: 'success', text: 'Certificados eliminados.' });
      await load();
    } catch (e) { setMessage({ type: 'error', text: getErrorMessage(e) }); }
    finally { setCertSaving(false); }
  }

  async function savePointOfSale() {
    setPointSaving(true); setMessage(null);
    try {
      const number = Number(pointForm.number);
      if (!number || Number.isNaN(number)) throw new Error('Ingresá un número de punto de venta válido.');
      await arcaConfigApi.createPointOfSale({
        number,
        description: pointForm.description,
        isDefault: pointForm.isDefault,
        enabled: pointForm.enabled,
        enabledCbteTypes: pointForm.enabledCbteTypes,
      });
      setPointForm({ number: '', description: 'Punto de venta Web Service', isDefault: true, enabled: true, enabledCbteTypes: [1, 6, 3, 8] });
      setMessage({ type: 'success', text: 'Punto de venta guardado.' });
      await load();
    } catch (e) { setMessage({ type: 'error', text: getErrorMessage(e) }); }
    finally { setPointSaving(false); }
  }

  async function deletePoint(id: string) {
    if (!window.confirm('¿Eliminar este punto de venta?')) return;
    setMessage(null);
    try {
      await arcaConfigApi.deletePointOfSale(id);
      setMessage({ type: 'success', text: 'Punto de venta eliminado.' });
      await load();
    } catch (e) { setMessage({ type: 'error', text: getErrorMessage(e) }); }
  }

  async function activate() {
    setSaving(true); setMessage(null);
    try {
      const updated = await arcaConfigApi.activate();
      setConfig(updated);
      setMessage({ type: 'success', text: 'ARCA activado correctamente.' });
      await load();
    } catch (e) { setMessage({ type: 'error', text: getErrorMessage(e) }); }
    finally { setSaving(false); }
  }

  async function runTest(type: 'wsaa' | 'wsfe') {
    setTesting(type); setMessage(null);
    try {
      if (type === 'wsaa') {
        await arcaConfigApi.testWsaa();
        setMessage({ type: 'success', text: 'WSAA respondió correctamente. Token/Sign OK.' });
      } else {
        await arcaConfigApi.testWsfeDummy();
        setMessage({ type: 'success', text: 'WSFE / FEDummy respondió correctamente.' });
      }
      await load();
    } catch (e) { setMessage({ type: 'error', text: getErrorMessage(e) }); }
    finally { setTesting(null); }
  }

  function toggleCbte(id: number) {
    setPointForm((p) => ({
      ...p,
      enabledCbteTypes: p.enabledCbteTypes.includes(id)
        ? p.enabledCbteTypes.filter((x) => x !== id)
        : [...p.enabledCbteTypes, id],
    }));
  }

  return (
    <AppLayout>
      <div className={t.page}>

        {/* ── TOPBAR ─────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
            <div className="flex items-center gap-3">
              {/* ARCA logo pill */}
              <div className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5">
                <span className="text-sm font-bold tracking-tight text-white">ARCA</span>
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Facturación electrónica</p>
                <p className="text-[11px] text-slate-400">Configuración del Web Service AFIP</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={load} disabled={loading} className={t.btnSecondary}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Actualizar
              </button>
              <button onClick={activate} disabled={saving || loading} className={t.btnPrimary}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} strokeWidth={2.5} />}
                Activar ARCA
              </button>
            </div>
          </div>
        </header>

        {/* ── STATUS BAR ──────────────────────────────────────── */}
        <div className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="mx-auto max-w-6xl">
            <StatBar config={config} form={form} />
          </div>
        </div>

        {/* ── BODY ────────────────────────────────────────────── */}
        <div className={t.body}>

          {/* Message banner */}
          {message && (
            <div className={[
              'mb-5 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium',
              message.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-600',
            ].join(' ')}>
              {message.type === 'success'
                ? <CheckCircle2 size={15} className="shrink-0" />
                : <XCircle size={15} className="shrink-0" />}
              {message.text}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={22} className="animate-spin text-slate-300" />
                <span className="text-sm text-slate-400">Cargando configuración ARCA…</span>
              </div>
            </div>
          ) : (
            <div className={t.cols}>

              {/* ── LEFT ──────────────────────────────────────── */}
              <div className={t.stack}>

                {/* DATOS FISCALES */}
                <Panel
                  title="Datos fiscales"
                  description="Datos del contribuyente que emite los comprobantes"
                  icon={Building2}
                  action={
                    <button onClick={saveConfig} disabled={saving} className={t.btnPrimary}>
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      Guardar
                    </button>
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Razón social">
                      <input
                        className={t.input}
                        value={form.businessName || ''}
                        onChange={(e) => setForm((p) => ({ ...p, businessName: e.target.value }))}
                        placeholder="Grupo VJ"
                      />
                    </Field>
                    <Field label="CUIT" hint="Solo números — 11 dígitos">
                      <input
                        className={t.input}
                        value={form.cuit || ''}
                        onChange={(e) => setForm((p) => ({ ...p, cuit: onlyDigits(e.target.value).slice(0, 11) }))}
                        placeholder="30711222333"
                      />
                    </Field>
                    <Field label="Condición IVA">
                      <select
                        className={t.input}
                        value={form.ivaCondition || ''}
                        onChange={(e) => setForm((p) => ({ ...p, ivaCondition: e.target.value }))}
                      >
                        {IVA_CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Inicio de actividades">
                      <input
                        type="date"
                        className={t.input}
                        value={String(form.activityStart || '')}
                        onChange={(e) => setForm((p) => ({ ...p, activityStart: e.target.value }))}
                      />
                    </Field>
                    <Field label="Domicilio fiscal">
                      <input
                        className={t.input}
                        value={form.fiscalAddress || ''}
                        onChange={(e) => setForm((p) => ({ ...p, fiscalAddress: e.target.value }))}
                        placeholder="Domicilio declarado en ARCA"
                      />
                    </Field>
                    <Field label="Ambiente">
                      <select
                        className={t.input}
                        value={form.environment || 'HOMOLOGACION'}
                        onChange={(e) => setForm((p) => ({ ...p, environment: e.target.value as any }))}
                      >
                        <option value="HOMOLOGACION">Homologación / pruebas</option>
                        <option value="PRODUCCION">Producción / real</option>
                      </select>
                    </Field>
                  </div>

                  <Divider />
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700">
                    <AlertCircle size={13} className="mt-0.5 shrink-0 text-amber-500" />
                    Grupo VJ no carga usuario ni clave fiscal. Solo certificado digital, private key y punto de venta para Web Service.
                  </div>
                </Panel>

                {/* CERTIFICADO */}
                <Panel
                  title="Certificado y private key"
                  description="Archivos PEM para WSAA — se guardan cifrados en el backend"
                  icon={KeyRound}
                  accent={certLoaded ? 'green' : 'red'}
                  action={certLoaded ? (
                    <button onClick={deleteCertificates} disabled={certSaving} className={t.btnDanger}>
                      {certSaving ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      Eliminar
                    </button>
                  ) : undefined}
                >
                  {/* Upload zones */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {([
                      { label: 'Certificado .crt / .pem', setter: setCertText, accept: '.crt,.pem,.cer,.txt,.key', state: certText },
                      { label: 'Private key .key / .pem',  setter: setKeyText,  accept: '.key,.pem,.txt',          state: keyText  },
                    ] as const).map(({ label, setter, accept, state }) => (
                      <div key={label}>
                        <Label>{label}</Label>
                        <label className={[
                          'relative flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-all',
                          state
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white',
                        ].join(' ')}>
                          {state
                            ? <CheckCircle2 size={18} className="text-emerald-500" />
                            : <UploadCloud size={18} className="text-slate-300" />}
                          <p className={`text-xs font-medium ${state ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {state ? 'Archivo cargado' : 'Seleccionar archivo'}
                          </p>
                          <p className="text-[10px] text-slate-400">o pegalo abajo</p>
                          <input
                            type="file"
                            accept={accept}
                            className="absolute inset-0 cursor-pointer opacity-0"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (f) setter(await readFileAsText(f));
                            }}
                          />
                        </label>
                      </div>
                    ))}
                  </div>

                  {/* Textareas */}
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Contenido del certificado">
                      <textarea
                        className={`${t.input} min-h-[90px] resize-y font-mono text-[11px]`}
                        value={certText}
                        onChange={(e) => setCertText(e.target.value)}
                        placeholder="—— BEGIN CERTIFICATE ——"
                      />
                    </Field>
                    <Field label="Contenido de la private key">
                      <textarea
                        className={`${t.input} min-h-[90px] resize-y font-mono text-[11px]`}
                        value={keyText}
                        onChange={(e) => setKeyText(e.target.value)}
                        placeholder="—— BEGIN PRIVATE KEY ——"
                      />
                    </Field>
                  </div>

                  <Divider />

                  <div className="flex flex-wrap items-end gap-4">
                    <div className="w-48 shrink-0">
                      <Field label="Vencimiento del certificado">
                        <input
                          type="date"
                          className={t.input}
                          value={certExpiresAt}
                          onChange={(e) => setCertExpiresAt(e.target.value)}
                        />
                      </Field>
                    </div>
                    <button onClick={saveCertificate} disabled={certSaving} className={`${t.btnPrimary} flex-1 justify-center`}>
                      {certSaving ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                      Guardar certificado
                    </button>
                  </div>
                </Panel>

                {/* PUNTOS DE VENTA */}
                <Panel
                  title="Puntos de venta"
                  description="Punto de venta habilitado en ARCA para Web Service"
                  icon={ServerCog}
                >
                  <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
                    <Field label="Número">
                      <input
                        className={t.input}
                        value={pointForm.number}
                        onChange={(e) => setPointForm((p) => ({ ...p, number: onlyDigits(e.target.value) }))}
                        placeholder="Ej: 5"
                      />
                    </Field>
                    <Field label="Descripción">
                      <input
                        className={t.input}
                        value={pointForm.description}
                        onChange={(e) => setPointForm((p) => ({ ...p, description: e.target.value }))}
                      />
                    </Field>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Toggle checked={pointForm.isDefault} label="Punto default" onChange={(v) => setPointForm((p) => ({ ...p, isDefault: v }))} />
                    <Toggle checked={pointForm.enabled}   label="Habilitado"    onChange={(v) => setPointForm((p) => ({ ...p, enabled: v }))} />
                  </div>

                  <Divider />

                  <Label>Comprobantes habilitados</Label>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                    {CBTE_TYPES.map((cbte) => (
                      <CbteToggle
                        key={cbte.id}
                        id={cbte.id}
                        label={cbte.label}
                        checked={pointForm.enabledCbteTypes.includes(cbte.id)}
                        onToggle={() => toggleCbte(cbte.id)}
                      />
                    ))}
                  </div>

                  <Divider />

                  <button onClick={savePointOfSale} disabled={pointSaving} className={t.btnSecondary}>
                    {pointSaving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    Agregar punto de venta
                  </button>

                  {/* Table */}
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          {['N°', 'Descripción', 'Estado', 'Tipos', ''].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {points.length ? points.map((p) => (
                          <tr key={p.id} className="transition-colors hover:bg-slate-50">
                            <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-800">
                              {String(p.number).padStart(4, '0')}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-500">{p.description || '—'}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                {p.isDefault && (
                                  <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                                    Default
                                  </span>
                                )}
                                <span className={[
                                  'inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                  p.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400',
                                ].join(' ')}>
                                  {p.enabled ? 'Activo' : 'Inactivo'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                              {p.enabledCbteTypes?.join(', ') || '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => deletePoint(p.id)}
                                className="rounded-lg p-1.5 text-slate-300 transition-all hover:bg-red-50 hover:text-red-500"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                              No hay puntos de venta configurados todavía.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>

              {/* ── SIDEBAR ───────────────────────────────────── */}
              <aside className="space-y-4 lg:sticky lg:top-[69px] lg:self-start">

                {/* TESTS */}
                <Panel title="Pruebas de conexión" description="Validá WSAA y WSFE antes de facturar" icon={TestTube2}>
                  <div className="space-y-2">
                    {([
                      { key: 'wsaa', label: 'Probar WSAA',          Icon: PlugZap },
                      { key: 'wsfe', label: 'Probar WSFE / FEDummy', Icon: Wifi   },
                    ] as const).map(({ key, label, Icon }) => (
                      <button
                        key={key}
                        onClick={() => runTest(key)}
                        disabled={testing !== null || !config}
                        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span className="flex items-center gap-2">
                          {testing === key
                            ? <Loader2 size={13} className="animate-spin text-indigo-500" />
                            : <Icon size={13} className="text-slate-400" />}
                          {label}
                        </span>
                        <ChevronRight size={13} className="text-slate-300" />
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 space-y-2.5">
                    {[
                      { k: 'Último token',  v: formatDate(config?.lastTokenAt) },
                      { k: 'Último test',   v: formatDate(config?.lastCheckAt) },
                      { k: 'Punto default', v: defaultPoint ? String(defaultPoint.number).padStart(4, '0') : '—' },
                    ].map(({ k, v }) => (
                      <div key={k} className="flex items-center justify-between gap-3">
                        <span className="text-[11px] text-slate-400">{k}</span>
                        <span className="font-mono text-[11px] font-medium text-slate-600">{v}</span>
                      </div>
                    ))}
                  </div>
                </Panel>

                {/* CHECKLIST */}
                <Panel title="Checklist de activación" icon={ClipboardCheck}>
                  <div className="mb-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Progreso</span>
                      <span className="text-[11px] font-bold text-indigo-600">{progress}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {checklist.map((item) => (
                      <div
                        key={item.text}
                        className={[
                          'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs transition-all',
                          item.ok
                            ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                            : 'border-slate-100 bg-slate-50 text-slate-400',
                        ].join(' ')}
                      >
                        {item.ok
                          ? <CheckCircle2 size={12} className="shrink-0 text-emerald-500" />
                          : <AlertCircle  size={12} className="shrink-0 text-slate-300" />}
                        <span className={item.ok ? 'font-medium' : ''}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </Panel>

                {/* HOW-TO */}
                <Panel title="Cómo preparar ARCA" icon={ShieldCheck}>
                  <ol className="space-y-1.5">
                    {[
                      'Ingresá a ARCA con CUIT y clave fiscal.',
                      'Habilitá Administración de Certificados Digitales.',
                      'Asociá el certificado al servicio WSFE.',
                      'Verificá que el punto de venta sea Web Service.',
                      'Cargá certificado y private key desde este panel.',
                    ].map((text, i) => (
                      <li
                        key={text}
                        className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500 leading-relaxed"
                      >
                        <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-[9px] font-bold text-indigo-600 border border-indigo-100">
                          {i + 1}
                        </span>
                        {text}
                      </li>
                    ))}
                  </ol>
                </Panel>
              </aside>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}