'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { arcaConfigApi } from '../service/arcaConfigApi';
import type { ArcaConfig, ArcaConfigPayload, ArcaPointOfSale } from '@/types/arca';
import {
  AlertCircle, Building2, CheckCircle2, ChevronRight, ClipboardCheck,
  FileKey2, KeyRound, Loader2, Plus, RefreshCw, Save, ServerCog,
  ShieldCheck, TestTube2, Trash2, UploadCloud, Wifi, XCircle, Zap,
  PlugZap, CheckCircle,
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
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function maskCuit(cuit?: string | null) {
  const digits = onlyDigits(cuit || '');
  if (digits.length !== 11) return cuit || 'Sin CUIT';
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
  if (!config)                                         return { label: 'Sin configurar',      title: 'Configuración pendiente', variant: 'gray'    as const, icon: AlertCircle  };
  if (config.status === 'ACTIVE' && config.isActive)  return { label: 'Activo',               title: 'Listo para facturar',     variant: 'green'   as const, icon: CheckCircle2 };
  if (config.status === 'ERROR')                       return { label: 'Error',                title: 'Revisar conexión',        variant: 'red'     as const, icon: XCircle      };
  return                                                      { label: 'Incompleto',           title: 'Faltan datos',            variant: 'amber'   as const, icon: AlertCircle  };
}

/* ─── design tokens ─────────────────────────────────────────── */

const css = {
  // inputs
  input: [
    'w-full rounded-lg border bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition-all',
    'border-gray-200 placeholder:text-gray-400',
    'focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' '),

  // labels
  label: 'mb-1.5 block text-xs font-medium text-gray-500',
  hint:  'mt-1 block text-[11px] text-gray-400',

  // buttons
  btnPrimary: [
    'inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white',
    'transition-all hover:bg-emerald-600 active:scale-[0.98]',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' '),

  btnSecondary: [
    'inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700',
    'transition-all hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98]',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' '),

  btnDanger: [
    'inline-flex shrink-0 items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600',
    'transition-all hover:bg-red-100 active:scale-[0.98]',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' '),
};

/* ─── reusable components ────────────────────────────────────── */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={css.label}>{label}</label>
      {children}
      {hint && <span className={css.hint}>{hint}</span>}
    </div>
  );
}

function Panel({
  title, description, icon: Icon, children, action,
}: {
  title: string; description?: string; icon: any; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 border border-gray-100">
            <Icon size={16} className="text-gray-500" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            {description && <p className="mt-0.5 text-xs text-gray-400">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

const statVariants = {
  gray:  { icon: 'bg-gray-100 text-gray-500',   card: 'bg-white', dot: 'bg-gray-400'    },
  green: { icon: 'bg-emerald-50 text-emerald-600', card: 'bg-white', dot: 'bg-emerald-500' },
  amber: { icon: 'bg-amber-50 text-amber-600',  card: 'bg-white', dot: 'bg-amber-500'   },
  red:   { icon: 'bg-red-50 text-red-500',      card: 'bg-white', dot: 'bg-red-500'     },
};

function StatCard({
  label, value, sub, icon: Icon, variant = 'gray', dot,
}: { label: string; value: string; sub: string; icon: any; variant?: keyof typeof statVariants; dot?: boolean }) {
  const v = statVariants[variant];
  return (
    <div className={`flex items-center gap-4 rounded-xl border border-gray-200 p-4 ${v.card} shadow-sm`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${v.icon}`}>
        <Icon size={17} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">{value}</p>
        {dot ? (
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} />
            <span className="text-[11px] text-gray-400">{sub}</span>
          </div>
        ) : (
          <p className="mt-0.5 truncate text-[11px] text-gray-400">{sub}</p>
        )}
      </div>
    </div>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
        checked
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700',
      ].join(' ')}
    >
      {checked ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
      {label}
    </button>
  );
}

function Divider() {
  return <div className="my-5 border-t border-gray-100" />;
}

/* ─── page ───────────────────────────────────────────────────── */

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

  const [certText, setCertText]         = useState('');
  const [keyText, setKeyText]           = useState('');
  const [certExpiresAt, setCertExpiresAt] = useState('');

  const [pointForm, setPointForm] = useState({
    number: '',
    description: 'Punto de venta Web Service',
    isDefault: true,
    enabled: true,
    enabledCbteTypes: [1, 6, 3, 8] as number[],
  });

  const status      = useMemo(() => getStatus(config), [config]);
  const StatusIcon  = status.icon;
  const certLoaded  = Boolean(config?.certEncrypted && config?.keyEncrypted);
  const defaultPoint = points.find((p) => p.isDefault) || points[0];

  const checklist = [
    { ok: Boolean(form.cuit && form.cuit.length === 11), text: 'CUIT cargado (11 dígitos)' },
    { ok: Boolean(form.businessName?.trim()),            text: 'Razón social cargada' },
    { ok: certLoaded,                                    text: 'Certificado y private key guardados' },
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
      setMessage({ type: 'success', text: 'Configuración fiscal guardada correctamente.' });
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
      setMessage({ type: 'success', text: 'Certificado y private key guardados correctamente.' });
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

  /* ── render ── */
  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50">

        {/* ── TOPBAR ────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-4 px-8 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 items-center rounded-lg bg-gray-900 px-3">
                <span className="text-base font-bold tracking-tight text-white">ARCA</span>
                <span className="ml-0.5 text-base font-bold text-emerald-400">.</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Configuración de facturación electrónica</p>
                <p className="text-xs text-gray-400">Conectá el ERP con AFIP sin guardar clave fiscal</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={load} disabled={loading} className={css.btnSecondary}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Actualizar
              </button>
              <button onClick={activate} disabled={saving || loading} className={css.btnPrimary}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} strokeWidth={2.5} />}
                Activar ARCA
              </button>
            </div>
          </div>
        </div>

        {/* ── STATUS STRIP ─────────────────────────────────────── */}
        <div className="border-b border-gray-200 bg-white px-8 py-4">
          <div className="mx-auto max-w-screen-xl">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard
                label="Estado"
                value={status.title}
                sub={status.label}
                icon={StatusIcon}
                variant={status.variant}
                dot
              />
              <StatCard
                label="CUIT"
                value={maskCuit(config?.cuit || form.cuit) || 'Sin CUIT'}
                sub={config?.businessName || form.businessName || 'Grupo VJ'}
                icon={Building2}
                variant="green"
              />
              <StatCard
                label="Ambiente"
                value={config?.environment || form.environment}
                sub={form.environment === 'PRODUCCION' ? 'Comprobantes reales' : 'Modo prueba'}
                icon={ServerCog}
                variant="amber"
              />
              <StatCard
                label="Certificado"
                value={certLoaded ? 'Cargado' : 'Faltante'}
                sub={`Vence: ${formatDate(config?.certExpiresAt)}`}
                icon={FileKey2}
                variant={certLoaded ? 'green' : 'red'}
              />
            </div>
          </div>
        </div>

        {/* ── BODY ──────────────────────────────────────────────── */}
        <div className="mx-auto max-w-screen-xl px-8 py-6">

          {/* message banner */}
          {message && (
            <div className={[
              'mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium',
              message.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-600',
            ].join(' ')}>
              {message.type === 'success' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              {message.text}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-gray-200 bg-white">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={24} className="animate-spin text-gray-300" />
                <span className="text-sm text-gray-400">Cargando configuración ARCA…</span>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">

              {/* ── LEFT COLUMN ─────────────────────────────────── */}
              <div className="space-y-4">

                {/* DATOS FISCALES */}
                <Panel
                  title="Datos fiscales"
                  description="Datos reales del contribuyente que emite comprobantes"
                  icon={Building2}
                  action={
                    <button onClick={saveConfig} disabled={saving} className={css.btnPrimary}>
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Guardar
                    </button>
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Razón social">
                      <input
                        className={css.input}
                        value={form.businessName || ''}
                        onChange={(e) => setForm((p) => ({ ...p, businessName: e.target.value }))}
                        placeholder="Grupo VJ"
                      />
                    </Field>
                    <Field label="CUIT" hint="Solo números — 11 dígitos">
                      <input
                        className={css.input}
                        value={form.cuit || ''}
                        onChange={(e) => setForm((p) => ({ ...p, cuit: onlyDigits(e.target.value).slice(0, 11) }))}
                        placeholder="30711222333"
                      />
                    </Field>
                    <Field label="Condición IVA">
                      <select
                        className={css.input}
                        value={form.ivaCondition || ''}
                        onChange={(e) => setForm((p) => ({ ...p, ivaCondition: e.target.value }))}
                      >
                        {IVA_CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Inicio de actividades">
                      <input
                        type="date"
                        className={css.input}
                        value={String(form.activityStart || '')}
                        onChange={(e) => setForm((p) => ({ ...p, activityStart: e.target.value }))}
                      />
                    </Field>
                    <Field label="Domicilio fiscal">
                      <input
                        className={css.input}
                        value={form.fiscalAddress || ''}
                        onChange={(e) => setForm((p) => ({ ...p, fiscalAddress: e.target.value }))}
                        placeholder="Domicilio declarado en ARCA"
                      />
                    </Field>
                    <Field label="Ambiente">
                      <select
                        className={css.input}
                        value={form.environment || 'HOMOLOGACION'}
                        onChange={(e) => setForm((p) => ({ ...p, environment: e.target.value as any }))}
                      >
                        <option value="HOMOLOGACION">Homologación / pruebas</option>
                        <option value="PRODUCCION">Producción / real</option>
                      </select>
                    </Field>
                  </div>

                  <Divider />
                  <div className="flex items-start gap-2.5 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700">
                    <AlertCircle size={13} className="mt-0.5 shrink-0 text-amber-500" />
                    Grupo VJ no carga usuario ni clave fiscal. Solo certificado digital, private key y punto de venta para Web Service.
                  </div>
                </Panel>

                {/* CERTIFICADO */}
                <Panel
                  title="Certificado y private key"
                  description="Subí los archivos PEM para WSAA. Se guardan cifrados en el backend"
                  icon={KeyRound}
                  action={certLoaded ? (
                    <button onClick={deleteCertificates} disabled={certSaving} className={css.btnDanger}>
                      {certSaving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      Eliminar
                    </button>
                  ) : undefined}
                >
                  {/* upload zones */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {([
                      { label: 'Certificado .crt / .pem', setter: setCertText, accept: '.crt,.pem,.cer,.txt,.key' },
                      { label: 'Private key .key / .pem',  setter: setKeyText,  accept: '.key,.pem,.txt' },
                    ] as const).map(({ label, setter, accept }) => (
                      <div key={label}>
                        <span className={css.label}>{label}</span>
                        <label className="group relative flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-center transition-all hover:border-gray-400 hover:bg-gray-100">
                          <UploadCloud size={20} strokeWidth={1.5} className="text-gray-300 transition-colors group-hover:text-gray-500" />
                          <p className="text-xs font-medium text-gray-500">Seleccionar archivo</p>
                          <p className="text-[11px] text-gray-400">o pegalo en el textarea</p>
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

                  {/* textareas */}
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Contenido del certificado">
                      <textarea
                        className={`${css.input} min-h-[100px] resize-y font-mono text-[11px] leading-relaxed`}
                        value={certText}
                        onChange={(e) => setCertText(e.target.value)}
                        placeholder="—— BEGIN CERTIFICATE ——"
                      />
                    </Field>
                    <Field label="Contenido de la private key">
                      <textarea
                        className={`${css.input} min-h-[100px] resize-y font-mono text-[11px] leading-relaxed`}
                        value={keyText}
                        onChange={(e) => setKeyText(e.target.value)}
                        placeholder="—— BEGIN PRIVATE KEY ——"
                      />
                    </Field>
                  </div>

                  <Divider />

                  {/* expiry + save */}
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="w-48 shrink-0">
                      <Field label="Vencimiento del certificado">
                        <input
                          type="date"
                          className={css.input}
                          value={certExpiresAt}
                          onChange={(e) => setCertExpiresAt(e.target.value)}
                        />
                      </Field>
                    </div>
                    <button onClick={saveCertificate} disabled={certSaving} className={`${css.btnPrimary} flex-1 justify-center py-2.5`}>
                      {certSaving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
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
                  <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <Field label="Número">
                      <input
                        className={css.input}
                        value={pointForm.number}
                        onChange={(e) => setPointForm((p) => ({ ...p, number: onlyDigits(e.target.value) }))}
                        placeholder="Ej: 5"
                      />
                    </Field>
                    <Field label="Descripción">
                      <input
                        className={css.input}
                        value={pointForm.description}
                        onChange={(e) => setPointForm((p) => ({ ...p, description: e.target.value }))}
                      />
                    </Field>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Toggle
                      checked={pointForm.isDefault}
                      label="Punto default"
                      onChange={(v) => setPointForm((p) => ({ ...p, isDefault: v }))}
                    />
                    <Toggle
                      checked={pointForm.enabled}
                      label="Habilitado"
                      onChange={(v) => setPointForm((p) => ({ ...p, enabled: v }))}
                    />
                  </div>

                  <Divider />

                  <p className="mb-3 text-xs font-medium text-gray-500">Comprobantes habilitados</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                    {CBTE_TYPES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleCbte(t.id)}
                        className={[
                          'rounded-lg border px-3 py-2 text-center text-xs font-medium transition-all',
                          pointForm.enabledCbteTypes.includes(t.id)
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700',
                        ].join(' ')}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <Divider />

                  <button onClick={savePointOfSale} disabled={pointSaving} className={css.btnSecondary}>
                    {pointSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Agregar punto de venta
                  </button>

                  {/* table */}
                  <div className="mt-5 overflow-hidden rounded-xl border border-gray-200">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          {['Número', 'Descripción', 'Estado', 'Tipos', ''].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {points.length ? points.map((p) => (
                          <tr key={p.id} className="transition-colors hover:bg-gray-50">
                            <td className="px-4 py-3 font-semibold text-gray-900 tabular-nums">
                              {String(p.number).padStart(4, '0')}
                            </td>
                            <td className="px-4 py-3 text-gray-500">{p.description || '—'}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                {p.isDefault && (
                                  <span className="inline-flex items-center rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                    Default
                                  </span>
                                )}
                                <span className={[
                                  'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                  p.enabled
                                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                    : 'border-gray-200 bg-gray-100 text-gray-400',
                                ].join(' ')}>
                                  {p.enabled ? 'Activo' : 'Inactivo'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-gray-400">
                              {p.enabledCbteTypes?.join(', ') || '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => deletePoint(p.id)}
                                className="rounded-lg p-1.5 text-gray-300 transition-all hover:bg-red-50 hover:text-red-500"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                              Todavía no hay puntos de venta configurados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Panel>

              </div>

              {/* ── SIDEBAR ─────────────────────────────────────── */}
              <aside className="space-y-4 xl:sticky xl:top-[73px] xl:self-start">

                {/* TESTS */}
                <Panel title="Pruebas de conexión" description="Validá WSAA y WSFE antes de facturar" icon={TestTube2}>
                  <div className="space-y-2">
                    <button
                      onClick={() => runTest('wsaa')}
                      disabled={testing !== null || !config}
                      className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="flex items-center gap-2">
                        {testing === 'wsaa' ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} className="text-gray-400" />}
                        Probar WSAA
                      </span>
                      <ChevronRight size={13} className="text-gray-300" />
                    </button>
                    <button
                      onClick={() => runTest('wsfe')}
                      disabled={testing !== null || !config}
                      className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="flex items-center gap-2">
                        {testing === 'wsfe' ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} className="text-gray-400" />}
                        Probar WSFE / FEDummy
                      </span>
                      <ChevronRight size={13} className="text-gray-300" />
                    </button>
                  </div>

                  <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
                    {[
                      { k: 'Último token',  v: formatDate(config?.lastTokenAt) },
                      { k: 'Último test',   v: formatDate(config?.lastCheckAt) },
                      { k: 'Punto default', v: defaultPoint ? String(defaultPoint.number).padStart(4, '0') : 'Sin punto' },
                    ].map(({ k, v }) => (
                      <div key={k} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-gray-400">{k}</span>
                        <span className="font-mono text-[11px] font-medium text-gray-500">{v}</span>
                      </div>
                    ))}
                  </div>
                </Panel>

                {/* CHECKLIST */}
                <Panel title="Checklist de activación" icon={ClipboardCheck}>
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs text-gray-400">Progreso</span>
                      <span className="text-xs font-semibold text-emerald-600">{progress}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {checklist.map((item) => (
                      <div
                        key={item.text}
                        className={[
                          'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs transition-all',
                          item.ok
                            ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                            : 'border-gray-100 bg-gray-50 text-gray-400',
                        ].join(' ')}
                      >
                        {item.ok
                          ? <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                          : <AlertCircle  size={13} className="shrink-0 text-gray-300" />}
                        <span className={item.ok ? 'font-medium' : ''}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </Panel>

                {/* HOW-TO */}
                <Panel title="Cómo preparar ARCA" icon={ShieldCheck}>
                  <ol className="space-y-2">
                    {[
                      'Ingresá a ARCA con CUIT y clave fiscal.',
                      'Habilitá Administración de Certificados Digitales.',
                      'Asociá el certificado al servicio WSFE.',
                      'Verificá que el punto de venta sea Web Service.',
                      'Cargá certificado y private key desde este panel.',
                    ].map((text, i) => (
                      <li
                        key={text}
                        className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs text-gray-500 leading-relaxed"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-[10px] font-bold text-emerald-600 border border-emerald-100">
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