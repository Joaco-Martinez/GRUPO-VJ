'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { arcaConfigApi } from '../service/arcaConfigApi';
import type { ArcaConfig, ArcaConfigPayload, ArcaPointOfSale } from '@/types/arca';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Bell,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileKey2,
  HelpCircle,
  Info,
  KeyRound,
  Loader2,
  MonitorPlay,
  Plus,
  RefreshCw,
  Save,
  ServerCog,
  ShieldCheck,
  Sparkles,
  TestTube2,
  Trash2,
  UploadCloud,
  Wifi,
  X,
  XCircle,
  Zap,
  PlugZap,
} from 'lucide-react';

const IVA_CONDITIONS = [
  'Responsable Inscripto',
  'Monotributista',
  'Exento',
  'Consumidor Final',
];

const CBTE_TYPES = [
  { id: 1, label: 'Factura A' },
  { id: 6, label: 'Factura B' },
  { id: 11, label: 'Factura C' },
  { id: 3, label: 'NC A' },
  { id: 8, label: 'NC B' },
  { id: 13, label: 'NC C' },
  { id: 2, label: 'ND A' },
  { id: 7, label: 'ND B' },
  { id: 12, label: 'ND C' },
];

type Toast = {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

function formatDate(value?: string | null) {
  if (!value) return 'Sin dato';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin dato';

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
    return (
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      'Ocurrió un error'
    );
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
  if (!config) {
    return {
      label: 'Sin configurar',
      title: 'Configuración pendiente',
      description: 'Todavía no se guardaron los datos fiscales.',
      variant: 'gray' as const,
      icon: AlertCircle,
    };
  }

  if (config.status === 'ACTIVE' && config.isActive) {
    return {
      label: 'Activo',
      title: 'Listo para facturar',
      description: 'ARCA está conectado y habilitado en el sistema.',
      variant: 'green' as const,
      icon: CheckCircle2,
    };
  }

  if (config.status === 'ERROR') {
    return {
      label: 'Error',
      title: 'Revisar conexión',
      description: 'Hay un problema con el certificado, punto de venta o servicio.',
      variant: 'red' as const,
      icon: XCircle,
    };
  }

  return {
    label: 'Incompleto',
    title: 'Faltan datos',
    description: 'Completá los pasos necesarios para activar ARCA.',
    variant: 'amber' as const,
    icon: AlertCircle,
  };
}

const ui = {
  page: 'min-h-screen bg-[#070A12] text-white',
  shell: 'mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8',
  card: 'rounded-[28px] border border-white/10 bg-white/[0.055] shadow-2xl shadow-black/20 backdrop-blur-xl',
  softCard: 'rounded-3xl border border-white/10 bg-white/[0.045] backdrop-blur',
  input:
    'w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60',
  label: 'mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-white/45',
  hint: 'mt-2 text-xs leading-relaxed text-white/38',
  primary:
    'inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-white/80 transition hover:border-white/20 hover:bg-white/[0.09] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/15 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
};

const statusTheme = {
  gray: {
    pill: 'bg-white/10 text-white/65 border-white/10',
    dot: 'bg-white/35',
    glow: 'from-white/10',
  },
  green: {
    pill: 'bg-emerald-400/10 text-emerald-200 border-emerald-300/20',
    dot: 'bg-emerald-300',
    glow: 'from-emerald-400/20',
  },
  amber: {
    pill: 'bg-amber-400/10 text-amber-200 border-amber-300/20',
    dot: 'bg-amber-300',
    glow: 'from-amber-400/20',
  },
  red: {
    pill: 'bg-red-400/10 text-red-200 border-red-300/20',
    dot: 'bg-red-300',
    glow: 'from-red-400/20',
  },
};

function StatusBadge({
  variant = 'gray',
  label,
}: {
  variant?: keyof typeof statusTheme;
  label: string;
}) {
  const s = statusTheme[variant];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${s.pill}`}
    >
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={ui.label}>{label}</label>
      {children}
      {hint ? <p className={ui.hint}>{hint}</p> : null}
    </div>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
  action,
  id,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon: any;
  children: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={`${ui.card} overflow-hidden`}>
      <div className="border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/10 text-cyan-200">
              <Icon size={21} />
            </div>

            <div>
              {eyebrow ? (
                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200/70">
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="text-lg font-black tracking-tight text-white">
                {title}
              </h2>
              {description ? (
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/48">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>

      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function Toasts({
  items,
  onClose,
}: {
  items: Toast[];
  onClose: (id: string) => void;
}) {
  if (!items.length) return null;

  return (
    <div className="fixed right-4 top-4 z-[90] flex w-[calc(100vw-32px)] max-w-sm flex-col gap-3">
      {items.map((toast) => {
        const Icon =
          toast.type === 'success'
            ? CheckCircle2
            : toast.type === 'error'
              ? XCircle
              : Info;

        const styles =
          toast.type === 'success'
            ? 'border-emerald-300/20 bg-emerald-500/15 text-emerald-100'
            : toast.type === 'error'
              ? 'border-red-300/20 bg-red-500/15 text-red-100'
              : 'border-cyan-300/20 bg-cyan-500/15 text-cyan-100';

        return (
          <div
            key={toast.id}
            className={`rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${styles}`}
          >
            <div className="flex gap-3">
              <Icon size={19} className="mt-0.5 shrink-0" />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-1 text-xs leading-relaxed opacity-75">
                    {toast.description}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => onClose(toast.id)}
                className="rounded-lg p-1 opacity-60 transition hover:bg-white/10 hover:opacity-100"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VideoPlaceholder({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-4 transition hover:border-cyan-300/25 hover:bg-black/35">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 via-transparent to-violet-500/10 opacity-0 transition group-hover:opacity-100" />

      <div className="relative">
        <div className="mb-4 flex aspect-video items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.035]">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200">
              <MonitorPlay size={26} />
            </div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
              Espacio video {number}
            </p>
          </div>
        </div>

        <h3 className="text-sm font-black text-white">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          {description}
        </p>
      </div>
    </div>
  );
}

function StepBox({
  number,
  title,
  description,
  children,
  videoLabel,
}: {
  number: number;
  title: string;
  description: string;
  children?: React.ReactNode;
  videoLabel?: string;
}) {
  return (
    <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-4 flex items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-cyan-300 text-sm font-black text-slate-950">
          {number}
        </div>

        <div>
          <h3 className="text-base font-black text-white">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-white/48">
            {description}
          </p>
        </div>
      </div>

      {children ? <div className="mt-4">{children}</div> : null}

      {videoLabel ? (
        <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/10 px-4 py-3 text-xs font-bold text-cyan-100">
          <div className="flex items-center gap-2">
            <MonitorPlay size={15} />
            {videoLabel}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CbteToggle({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'rounded-2xl border px-3 py-2.5 text-center text-xs font-black transition',
        checked
          ? 'border-cyan-300/30 bg-cyan-300/15 text-cyan-100'
          : 'border-white/10 bg-black/15 text-white/45 hover:border-white/20 hover:bg-white/[0.06]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        'inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black transition',
        checked
          ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
          : 'border-white/10 bg-black/15 text-white/45 hover:border-white/20',
      ].join(' ')}
    >
      {checked ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
      {label}
    </button>
  );
}

export default function ArcaConfigPage() {
  const [config, setConfig] = useState<ArcaConfig | null>(null);
  const [points, setPoints] = useState<ArcaPointOfSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [testing, setTesting] = useState<'wsaa' | 'wsfe' | null>(null);
  const [certSaving, setCertSaving] = useState(false);
  const [pointSaving, setPointSaving] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const [form, setForm] = useState<ArcaConfigPayload>({
    businessName: 'Grupo VJ',
    cuit: '',
    ivaCondition: 'Responsable Inscripto',
    fiscalAddress: '',
    activityStart: '',
    environment: 'HOMOLOGACION',
    pointOfSale: '',
  });

  const [certText, setCertText] = useState('');
  const [keyText, setKeyText] = useState('');
  const [certExpiresAt, setCertExpiresAt] = useState('');

  const [pointForm, setPointForm] = useState({
    number: '',
    description: 'Punto de venta Web Service',
    isDefault: true,
    enabled: true,
    enabledCbteTypes: [1, 6, 3, 8] as number[],
  });

  const status = getStatus(config);
  const StatusIcon = status.icon;

  const certLoaded = Boolean(config?.certEncrypted && config?.keyEncrypted);
  const defaultPoint = points.find((p) => p.isDefault) || points[0];

  const checklist = useMemo(
    () => [
      {
        ok: Boolean(form.businessName?.trim()),
        text: 'Razón social cargada',
      },
      {
        ok: Boolean(form.cuit && onlyDigits(String(form.cuit)).length === 11),
        text: 'CUIT cargado con 11 dígitos',
      },
      {
        ok: Boolean(form.ivaCondition),
        text: 'Condición IVA seleccionada',
      },
      {
        ok: points.length > 0,
        text: 'Punto de venta agregado',
      },
      {
        ok: certLoaded,
        text: 'Certificado y private key cargados',
      },
      {
        ok: Boolean(config?.isActive),
        text: 'ARCA activado',
      },
    ],
    [form.businessName, form.cuit, form.ivaCondition, points.length, certLoaded, config?.isActive],
  );

  const progress = Math.round(
    (checklist.filter((item) => item.ok).length / checklist.length) * 100,
  );

  function pushToast(
    type: Toast['type'],
    title: string,
    description?: string,
    browserNotification = false,
  ) {
    const id = crypto.randomUUID();

    setToasts((current) => [
      {
        id,
        type,
        title,
        description,
      },
      ...current,
    ]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 5500);

    if (
      browserNotification &&
      notificationsEnabled &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      new Notification(title, {
        body: description || 'Grupo VJ App',
      });
    }
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      pushToast(
        'error',
        'Tu navegador no soporta notificaciones',
        'Igual vas a seguir viendo avisos dentro del sistema.',
      );
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      setNotificationsEnabled(true);
      pushToast(
        'success',
        'Notificaciones activadas',
        'Te vamos a avisar cuando una acción importante salga bien o falle.',
        true,
      );
    } else {
      setNotificationsEnabled(false);
      pushToast(
        'info',
        'Notificaciones no activadas',
        'Podés seguir usando los avisos internos del sistema.',
      );
    }
  }

  async function load() {
    setLoading(true);

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
          activityStart: current.activityStart
            ? current.activityStart.slice(0, 10)
            : '',
          environment: current.environment || 'HOMOLOGACION',
          pointOfSale: def?.number || '',
        });

        setCertExpiresAt(
          current.certExpiresAt ? current.certExpiresAt.slice(0, 10) : '',
        );

        setPoints(pts);
      } else {
        setPoints([]);
      }
    } catch (e) {
      pushToast('error', 'No se pudo cargar ARCA', getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      setNotificationsEnabled(true);
    }
  }, []);

  async function saveConfig() {
    setSaving(true);

    try {
      const saved = await arcaConfigApi.saveConfig({
        ...form,
        cuit: onlyDigits(String(form.cuit || '')),
      });

      setConfig(saved);

      pushToast(
        'success',
        'Datos fiscales guardados',
        'La información fiscal quedó actualizada correctamente.',
        true,
      );

      await load();
    } catch (e) {
      pushToast('error', 'No se pudo guardar', getErrorMessage(e), true);
    } finally {
      setSaving(false);
    }
  }

  async function saveCertificate() {
    setCertSaving(true);

    try {
      if (!certText.trim()) {
        throw new Error('Tenés que cargar o pegar el certificado.');
      }

      if (!keyText.trim()) {
        throw new Error('Tenés que cargar o pegar la private key.');
      }

      await arcaConfigApi.uploadCertificates({
        certPem: certText,
        keyPem: keyText,
        certExpiresAt: certExpiresAt || null,
      });

      setCertText('');
      setKeyText('');

      pushToast(
        'success',
        'Certificado guardado',
        'El certificado y la private key se guardaron cifrados en el sistema.',
        true,
      );

      await load();
    } catch (e) {
      pushToast('error', 'Error en certificado', getErrorMessage(e), true);
    } finally {
      setCertSaving(false);
    }
  }

  async function deleteCertificates() {
    if (!window.confirm('¿Eliminar el certificado y la private key?')) return;

    setCertSaving(true);

    try {
      await arcaConfigApi.deleteCertificates();

      setCertText('');
      setKeyText('');

      pushToast(
        'success',
        'Certificados eliminados',
        'Podés cargar un nuevo certificado cuando quieras.',
      );

      await load();
    } catch (e) {
      pushToast('error', 'No se pudo eliminar', getErrorMessage(e));
    } finally {
      setCertSaving(false);
    }
  }

  async function savePointOfSale() {
    setPointSaving(true);

    try {
      const number = Number(pointForm.number);

      if (!number || Number.isNaN(number)) {
        throw new Error('Ingresá un número de punto de venta válido.');
      }

      await arcaConfigApi.createPointOfSale({
        number,
        description: pointForm.description,
        isDefault: pointForm.isDefault,
        enabled: pointForm.enabled,
        enabledCbteTypes: pointForm.enabledCbteTypes,
      });

      setPointForm({
        number: '',
        description: 'Punto de venta Web Service',
        isDefault: true,
        enabled: true,
        enabledCbteTypes: [1, 6, 3, 8],
      });

      pushToast(
        'success',
        'Punto de venta agregado',
        'Recordá que debe coincidir con el punto de venta creado en ARCA.',
        true,
      );

      await load();
    } catch (e) {
      pushToast('error', 'No se pudo agregar el punto', getErrorMessage(e));
    } finally {
      setPointSaving(false);
    }
  }

  async function deletePoint(id: string) {
    if (!window.confirm('¿Eliminar este punto de venta?')) return;

    try {
      await arcaConfigApi.deletePointOfSale(id);

      pushToast(
        'success',
        'Punto de venta eliminado',
        'Se actualizó la configuración de puntos de venta.',
      );

      await load();
    } catch (e) {
      pushToast('error', 'No se pudo eliminar', getErrorMessage(e));
    }
  }

  async function activate() {
    setSaving(true);

    try {
      const updated = await arcaConfigApi.activate();

      setConfig(updated);

      pushToast(
        'success',
        'ARCA activado correctamente',
        'Felicidades, ARCA ya está conectado al sistema.',
        true,
      );

      await load();
    } catch (e) {
      pushToast('error', 'No se pudo activar ARCA', getErrorMessage(e), true);
    } finally {
      setSaving(false);
    }
  }

  async function runTest(type: 'wsaa' | 'wsfe') {
    setTesting(type);

    try {
      if (type === 'wsaa') {
        await arcaConfigApi.testWsaa();

        pushToast(
          'success',
          'WSAA respondió correctamente',
          'Token y Sign generados correctamente.',
          true,
        );
      } else {
        await arcaConfigApi.testWsfeDummy();

        pushToast(
          'success',
          'WSFE respondió correctamente',
          'FEDummy respondió OK. La conexión con facturación funciona.',
          true,
        );
      }

      await load();
    } catch (e) {
      pushToast('error', 'Falló la prueba de conexión', getErrorMessage(e), true);
    } finally {
      setTesting(null);
    }
  }

  function toggleCbte(id: number) {
    setPointForm((previous) => ({
      ...previous,
      enabledCbteTypes: previous.enabledCbteTypes.includes(id)
        ? previous.enabledCbteTypes.filter((item) => item !== id)
        : [...previous.enabledCbteTypes, id],
    }));
  }

  return (
    <AppLayout>
      <div className={ui.page}>
        <Toasts
          items={toasts}
          onClose={(id) =>
            setToasts((current) => current.filter((item) => item.id !== id))
          }
        />

        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute left-[-120px] top-[-120px] h-[360px] w-[360px] rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="absolute right-[-140px] top-[180px] h-[420px] w-[420px] rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute bottom-[-180px] left-[30%] h-[420px] w-[420px] rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070A12]/82 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="flex items-center gap-4">
              <div className="flex h-13 w-13 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-300/10 shadow-lg shadow-cyan-500/10">
                <ShieldCheck size={25} className="text-cyan-200" />
              </div>

              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                    Configuración ARCA
                  </h1>
                  <StatusBadge variant={status.variant} label={status.label} />
                </div>
                <p className="text-sm text-white/45">
                  Conectá facturación electrónica con Grupo VJ App paso a paso.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={enableNotifications}
                className={ui.secondary}
              >
                <Bell size={16} />
                {notificationsEnabled ? 'Notificaciones ON' : 'Activar avisos'}
              </button>

              <button
                type="button"
                onClick={load}
                disabled={loading}
                className={ui.secondary}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Actualizar
              </button>

              <button
                type="button"
                onClick={activate}
                disabled={saving || loading}
                className={ui.primary}
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Zap size={16} />
                )}
                Activar ARCA
              </button>
            </div>
          </div>
        </header>

        <main className={`relative z-10 ${ui.shell}`}>
          <section className="mb-6 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <div
              className={`${ui.card} relative overflow-hidden p-5 sm:p-7`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${statusTheme[status.variant].glow} via-transparent to-cyan-400/5`}
              />

              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-white/55">
                    <Sparkles size={14} className="text-cyan-200" />
                    Panel importante de facturación
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-black/20">
                      <StatusIcon size={25} className="text-cyan-200" />
                    </div>

                    <div>
                      <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                        {status.title}
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/48">
                        {status.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-w-[230px] rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-white/45">
                      Progreso de configuración
                    </span>
                    <span className="text-sm font-black text-cyan-200">
                      {progress}%
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-cyan-300 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-white/38">
                    Completá todos los puntos antes de emitir comprobantes reales.
                  </p>
                </div>
              </div>
            </div>

            <div className={`${ui.card} p-5 sm:p-6`}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-200">
                  <AlertCircle size={20} />
                </div>

                <div>
                  <h3 className="font-black text-white">Importante</h3>
                  <p className="text-xs text-white/40">
                    Seguridad de clave fiscal
                  </p>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-white/52">
                Grupo VJ App no necesita usuario ni clave fiscal del cliente.
                Solo se carga el certificado digital, la private key y el punto
                de venta habilitado para Web Service.
              </p>
            </div>
          </section>

          <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'CUIT',
                value: maskCuit(config?.cuit || form.cuit),
                icon: Building2,
              },
              {
                label: 'Ambiente',
                value:
                  form.environment === 'PRODUCCION'
                    ? 'Producción / real'
                    : 'Homologación / pruebas',
                icon: ServerCog,
              },
              {
                label: 'Punto default',
                value: defaultPoint
                  ? String(defaultPoint.number).padStart(4, '0')
                  : 'Sin punto',
                icon: BadgeCheck,
              },
              {
                label: 'Certificado',
                value: certLoaded ? 'Cargado' : 'Pendiente',
                icon: FileKey2,
              },
            ].map((item) => (
              <div key={item.label} className={`${ui.softCard} p-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">
                    {item.label}
                  </p>
                  <item.icon size={17} className="text-cyan-200/70" />
                </div>
                <p className="truncate text-base font-black text-white">
                  {item.value || '—'}
                </p>
              </div>
            ))}
          </section>

          {loading ? (
            <div className={`${ui.card} flex min-h-[460px] items-center justify-center`}>
              <div className="text-center">
                <Loader2
                  size={34}
                  className="mx-auto mb-4 animate-spin text-cyan-200"
                />
                <p className="text-sm font-bold text-white/55">
                  Cargando configuración ARCA...
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                <SectionCard
                  id="paso-a-paso"
                  eyebrow="Guía para el cliente"
                  title="Paso a paso desde Grupo VJ App"
                  description="Esta sección guía al cliente desde los datos fiscales hasta la activación final de ARCA."
                  icon={BookOpen}
                >
                  <div className="grid gap-4">
                    <StepBox
                      number={1}
                      title="Completar datos fiscales"
                      description="Estos datos salen de la constancia de inscripción de ARCA y definen quién emite las facturas."
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          [
                            'Razón social',
                            'Nombre fiscal de la empresa o persona que va a emitir facturas.',
                          ],
                          [
                            'CUIT',
                            'Se encuentra en la constancia de inscripción de ARCA.',
                          ],
                          [
                            'Condición IVA',
                            'También sale de la constancia de inscripción.',
                          ],
                          [
                            'Domicilio fiscal',
                            'Campo opcional para dejar los datos fiscales completos.',
                          ],
                          [
                            'Ambiente',
                            'Producción emite comprobantes reales. Homologación es solo para pruebas.',
                          ],
                          [
                            'Punto de venta',
                            'Lo confirma el contador. Debe estar habilitado para Web Service.',
                          ],
                        ].map(([title, text]) => (
                          <div
                            key={title}
                            className="rounded-2xl border border-white/10 bg-black/15 p-4"
                          >
                            <p className="text-sm font-black text-white">
                              {title}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-white/43">
                              {text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </StepBox>

                    <StepBox
                      number={2}
                      title="Conseguir un punto de venta"
                      description='En ARCA buscar “Administración de puntos de venta y domicilios”, seleccionar la empresa, entrar a A/B/M de puntos de venta/emisión y agregar un nuevo punto.'
                      videoLabel="Acá va el VIDEO 1: cómo crear el punto de venta"
                    >
                      <div className="rounded-2xl border border-amber-300/15 bg-amber-300/10 p-4 text-sm leading-relaxed text-amber-100/85">
                        En el campo <strong>Sistema</strong> tiene que decir sí o sí:{' '}
                        <strong>“RECE para aplicativo y web services”</strong>.
                        El número de punto de venta debe ser correlativo y ese mismo
                        número se carga después en Grupo VJ App.
                      </div>
                    </StepBox>

                    <StepBox
                      number={3}
                      title="Generar CSR desde el sistema"
                      description="El sistema genera el pedido de certificado. Ese archivo se descarga y luego se sube en ARCA."
                      videoLabel="Acá va el VIDEO 2: cómo descargar/generar el CSR"
                    />

                    <StepBox
                      number={4}
                      title="Subir el CSR en ARCA"
                      description='Buscar “Administración de Certificados Digitales”, tocar Agregar Alias, poner un alias distintivo y subir el archivo generado por el sistema.'
                    >
                      <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm leading-relaxed text-white/50">
                        El archivo suele empezar con algo parecido a{' '}
                        <span className="font-mono text-cyan-100">
                          pedido-arca...
                        </span>
                        . Cuando ARCA lo apruebe, volver al alias, entrar en
                        “Ver detalle” y descargar el certificado.
                      </div>
                    </StepBox>

                    <StepBox
                      number={5}
                      title="Autorizar el certificado para WSFE / RECE"
                      description='Entrar a “Administrador de Relaciones de Clave Fiscal”, crear una nueva relación, buscar ARCA → WebService → Facturación Electrónica.'
                      videoLabel="Acá va el VIDEO 3: cómo autorizar el certificado para WSFE / RECE"
                    >
                      <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/10 p-4 text-sm leading-relaxed text-cyan-100/85">
                        En representante, tocar <strong>Buscar</strong>, elegir
                        el computador fiscal con el alias del certificado creado,
                        confirmar y esperar la aprobación de ARCA.
                      </div>
                    </StepBox>

                    <StepBox
                      number={6}
                      title="Probar y activar ARCA"
                      description="Primero se prueban WSAA y WSFE. Si todo responde OK, tocar Activar ARCA. Desde ese momento el sistema queda listo para facturar."
                    />
                  </div>
                </SectionCard>

                <SectionCard
                  eyebrow="Configuración"
                  title="Datos fiscales"
                  description="Datos del contribuyente que emite los comprobantes."
                  icon={Building2}
                  action={
                    <button
                      type="button"
                      onClick={saveConfig}
                      disabled={saving}
                      className={ui.primary}
                    >
                      {saving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      Guardar datos
                    </button>
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Razón social">
                      <input
                        className={ui.input}
                        value={form.businessName || ''}
                        onChange={(e) =>
                          setForm((previous) => ({
                            ...previous,
                            businessName: e.target.value,
                          }))
                        }
                        placeholder="Ej: Grupo VJ"
                      />
                    </Field>

                    <Field label="CUIT" hint="Solo números. Debe tener 11 dígitos.">
                      <input
                        className={ui.input}
                        value={form.cuit || ''}
                        onChange={(e) =>
                          setForm((previous) => ({
                            ...previous,
                            cuit: onlyDigits(e.target.value).slice(0, 11),
                          }))
                        }
                        placeholder="Ej: 30711222333"
                      />
                    </Field>

                    <Field label="Condición IVA">
                      <select
                        className={ui.input}
                        value={form.ivaCondition || ''}
                        onChange={(e) =>
                          setForm((previous) => ({
                            ...previous,
                            ivaCondition: e.target.value,
                          }))
                        }
                      >
                        {IVA_CONDITIONS.map((condition) => (
                          <option key={condition} className="bg-slate-950">
                            {condition}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Inicio de actividades">
                      <input
                        type="date"
                        className={ui.input}
                        value={String(form.activityStart || '')}
                        onChange={(e) =>
                          setForm((previous) => ({
                            ...previous,
                            activityStart: e.target.value,
                          }))
                        }
                      />
                    </Field>

                    <Field label="Domicilio fiscal">
                      <input
                        className={ui.input}
                        value={form.fiscalAddress || ''}
                        onChange={(e) =>
                          setForm((previous) => ({
                            ...previous,
                            fiscalAddress: e.target.value,
                          }))
                        }
                        placeholder="Ej: domicilio declarado en ARCA"
                      />
                    </Field>

                    <Field label="Ambiente">
                      <select
                        className={ui.input}
                        value={form.environment || 'HOMOLOGACION'}
                        onChange={(e) =>
                          setForm((previous) => ({
                            ...previous,
                            environment: e.target.value as any,
                          }))
                        }
                      >
                        <option value="HOMOLOGACION" className="bg-slate-950">
                          Homologación / pruebas
                        </option>
                        <option value="PRODUCCION" className="bg-slate-950">
                          Producción / real
                        </option>
                      </select>
                    </Field>
                  </div>
                </SectionCard>

                <SectionCard
                  eyebrow="Seguridad"
                  title="Certificado y private key"
                  description="Se guardan cifrados en el backend. No se pide clave fiscal."
                  icon={KeyRound}
                  action={
                    certLoaded ? (
                      <button
                        type="button"
                        onClick={deleteCertificates}
                        disabled={certSaving}
                        className={ui.danger}
                      >
                        {certSaving ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                        Eliminar
                      </button>
                    ) : null
                  }
                >
                  <div className="mb-5 rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start gap-3">
                      <Info size={18} className="mt-0.5 shrink-0 text-cyan-200" />
                      <p className="text-sm leading-relaxed text-white/52">
                        El certificado se descarga desde ARCA después de subir el
                        CSR. La private key queda del lado del sistema y nunca se
                        le pide al cliente la clave fiscal.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {([
                      {
                        label: 'Certificado .crt / .pem',
                        setter: setCertText,
                        accept: '.crt,.pem,.cer,.txt,.key',
                        state: certText,
                      },
                      {
                        label: 'Private key .key / .pem',
                        setter: setKeyText,
                        accept: '.key,.pem,.txt',
                        state: keyText,
                      },
                    ] as const).map(({ label, setter, accept, state }) => (
                      <div key={label}>
                        <label className={ui.label}>{label}</label>

                        <label
                          className={[
                            'relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed px-4 py-8 text-center transition',
                            state
                              ? 'border-emerald-300/35 bg-emerald-400/10'
                              : 'border-white/10 bg-black/20 hover:border-cyan-300/25 hover:bg-black/30',
                          ].join(' ')}
                        >
                          {state ? (
                            <CheckCircle2 size={27} className="text-emerald-200" />
                          ) : (
                            <UploadCloud size={27} className="text-white/30" />
                          )}

                          <p
                            className={`text-sm font-black ${
                              state ? 'text-emerald-100' : 'text-white/50'
                            }`}
                          >
                            {state ? 'Archivo cargado' : 'Seleccionar archivo'}
                          </p>

                          <p className="text-xs text-white/32">
                            También podés pegar el contenido abajo
                          </p>

                          <input
                            type="file"
                            accept={accept}
                            className="absolute inset-0 cursor-pointer opacity-0"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) setter(await readFileAsText(file));
                            }}
                          />
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="Contenido del certificado">
                      <textarea
                        className={`${ui.input} min-h-[130px] resize-y font-mono text-[11px]`}
                        value={certText}
                        onChange={(e) => setCertText(e.target.value)}
                        placeholder="-----BEGIN CERTIFICATE-----"
                      />
                    </Field>

                    <Field label="Contenido de la private key">
                      <textarea
                        className={`${ui.input} min-h-[130px] resize-y font-mono text-[11px]`}
                        value={keyText}
                        onChange={(e) => setKeyText(e.target.value)}
                        placeholder="-----BEGIN PRIVATE KEY-----"
                      />
                    </Field>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-[260px_1fr] sm:items-end">
                    <Field label="Vencimiento del certificado">
                      <input
                        type="date"
                        className={ui.input}
                        value={certExpiresAt}
                        onChange={(e) => setCertExpiresAt(e.target.value)}
                      />
                    </Field>

                    <button
                      type="button"
                      onClick={saveCertificate}
                      disabled={certSaving}
                      className={ui.primary}
                    >
                      {certSaving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <KeyRound size={16} />
                      )}
                      Guardar certificado
                    </button>
                  </div>
                </SectionCard>

                <SectionCard
                  eyebrow="Web Service"
                  title="Puntos de venta"
                  description="El número debe coincidir con el punto de venta creado en ARCA."
                  icon={ServerCog}
                >
                  <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                    <Field label="Número">
                      <input
                        className={ui.input}
                        value={pointForm.number}
                        onChange={(e) =>
                          setPointForm((previous) => ({
                            ...previous,
                            number: onlyDigits(e.target.value),
                          }))
                        }
                        placeholder="Ej: 7"
                      />
                    </Field>

                    <Field label="Descripción">
                      <input
                        className={ui.input}
                        value={pointForm.description}
                        onChange={(e) =>
                          setPointForm((previous) => ({
                            ...previous,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Ej: Punto de venta Web Service"
                      />
                    </Field>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Toggle
                      checked={pointForm.isDefault}
                      label="Punto default"
                      onChange={(value) =>
                        setPointForm((previous) => ({
                          ...previous,
                          isDefault: value,
                        }))
                      }
                    />

                    <Toggle
                      checked={pointForm.enabled}
                      label="Habilitado"
                      onChange={(value) =>
                        setPointForm((previous) => ({
                          ...previous,
                          enabled: value,
                        }))
                      }
                    />
                  </div>

                  <div className="my-6 h-px bg-white/10" />

                  <Field label="Comprobantes habilitados">
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                      {CBTE_TYPES.map((cbte) => (
                        <CbteToggle
                          key={cbte.id}
                          label={cbte.label}
                          checked={pointForm.enabledCbteTypes.includes(cbte.id)}
                          onToggle={() => toggleCbte(cbte.id)}
                        />
                      ))}
                    </div>
                  </Field>

                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={savePointOfSale}
                      disabled={pointSaving}
                      className={ui.secondary}
                    >
                      {pointSaving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Plus size={16} />
                      )}
                      Agregar punto de venta
                    </button>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-3xl border border-white/10">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[680px] text-sm">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/[0.04]">
                            {['N°', 'Descripción', 'Estado', 'Tipos', ''].map(
                              (header) => (
                                <th
                                  key={header}
                                  className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.16em] text-white/35"
                                >
                                  {header}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-white/10">
                          {points.length ? (
                            points.map((point) => (
                              <tr
                                key={point.id}
                                className="transition hover:bg-white/[0.035]"
                              >
                                <td className="px-4 py-4 font-mono text-sm font-black text-white">
                                  {String(point.number).padStart(4, '0')}
                                </td>

                                <td className="px-4 py-4 text-white/52">
                                  {point.description || '—'}
                                </td>

                                <td className="px-4 py-4">
                                  <div className="flex flex-wrap gap-2">
                                    {point.isDefault ? (
                                      <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-100">
                                        Default
                                      </span>
                                    ) : null}

                                    <span
                                      className={[
                                        'rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide',
                                        point.enabled
                                          ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
                                          : 'border-white/10 bg-white/5 text-white/35',
                                      ].join(' ')}
                                    >
                                      {point.enabled ? 'Activo' : 'Inactivo'}
                                    </span>
                                  </div>
                                </td>

                                <td className="px-4 py-4 font-mono text-xs text-white/38">
                                  {point.enabledCbteTypes?.join(', ') || '—'}
                                </td>

                                <td className="px-4 py-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => deletePoint(point.id)}
                                    className="rounded-xl p-2 text-white/30 transition hover:bg-red-500/10 hover:text-red-200"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={5}
                                className="px-4 py-12 text-center text-sm text-white/38"
                              >
                                Todavía no hay puntos de venta configurados.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  eyebrow="Material de ayuda"
                  title="Videos para el cliente"
                  description="Dejé los 3 espacios preparados para que después insertes los videos reales."
                  icon={MonitorPlay}
                >
                  <div className="grid gap-4 lg:grid-cols-3">
                    <VideoPlaceholder
                      number={1}
                      title="Crear punto de venta"
                      description="Tutorial para entrar a ARCA, buscar puntos de venta y elegir RECE para aplicativo y Web Services."
                    />

                    <VideoPlaceholder
                      number={2}
                      title="Generar y subir CSR"
                      description="Tutorial para descargar el pedido generado por el sistema y subirlo en certificados digitales."
                    />

                    <VideoPlaceholder
                      number={3}
                      title="Autorizar WSFE / RECE"
                      description="Tutorial para crear la relación de clave fiscal y asociar el alias del certificado al Web Service."
                    />
                  </div>
                </SectionCard>
              </div>

              <aside className="space-y-6 xl:sticky xl:top-[104px] xl:self-start">
                <SectionCard
                  title="Checklist de activación"
                  description="Lo mínimo necesario para dejar ARCA funcionando."
                  icon={ClipboardCheck}
                >
                  <div className="mb-5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-white/45">
                        Progreso
                      </span>
                      <span className="text-sm font-black text-cyan-200">
                        {progress}%
                      </span>
                    </div>

                    <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-cyan-300 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {checklist.map((item) => (
                      <div
                        key={item.text}
                        className={[
                          'flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition',
                          item.ok
                            ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
                            : 'border-white/10 bg-black/15 text-white/42',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                            item.ok
                              ? 'bg-emerald-300 text-slate-950'
                              : 'bg-white/10 text-white/30',
                          ].join(' ')}
                        >
                          {item.ok ? <Check size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <span className={item.ok ? 'font-bold' : ''}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Pruebas de conexión"
                  description="Probá antes de activar en producción."
                  icon={TestTube2}
                >
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => runTest('wsaa')}
                      disabled={testing !== null || !config}
                      className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm font-black text-white/70 transition hover:border-cyan-300/25 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span className="flex items-center gap-3">
                        {testing === 'wsaa' ? (
                          <Loader2 size={17} className="animate-spin text-cyan-200" />
                        ) : (
                          <PlugZap size={17} className="text-cyan-200" />
                        )}
                        Probar WSAA
                      </span>
                      <ArrowRight size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() => runTest('wsfe')}
                      disabled={testing !== null || !config}
                      className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm font-black text-white/70 transition hover:border-cyan-300/25 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span className="flex items-center gap-3">
                        {testing === 'wsfe' ? (
                          <Loader2 size={17} className="animate-spin text-cyan-200" />
                        ) : (
                          <Wifi size={17} className="text-cyan-200" />
                        )}
                        Probar WSFE / FEDummy
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  </div>

                  <div className="mt-5 space-y-3 rounded-3xl border border-white/10 bg-black/20 p-4">
                    {[
                      {
                        label: 'Último token',
                        value: formatDate(config?.lastTokenAt),
                      },
                      {
                        label: 'Último test',
                        value: formatDate(config?.lastCheckAt),
                      },
                      {
                        label: 'Punto default',
                        value: defaultPoint
                          ? String(defaultPoint.number).padStart(4, '0')
                          : '—',
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between gap-4"
                      >
                        <span className="text-xs text-white/35">
                          {item.label}
                        </span>
                        <span className="text-right font-mono text-xs font-bold text-white/62">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Ayuda rápida"
                  description="Resumen para no equivocarse."
                  icon={HelpCircle}
                >
                  <div className="space-y-3 text-sm leading-relaxed text-white/50">
                    <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                      <p className="font-black text-white">
                        ¿Qué ambiente uso?
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-white/45">
                        Homologación es para probar. Producción emite facturas
                        reales.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                      <p className="font-black text-white">
                        ¿Qué sistema elijo en ARCA?
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-white/45">
                        “RECE para aplicativo y web services”.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                      <p className="font-black text-white">
                        ¿Qué hago al final?
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-white/45">
                        Probar WSAA, probar WSFE y después tocar Activar ARCA.
                      </p>
                    </div>
                  </div>
                </SectionCard>
              </aside>
            </div>
          )}
        </main>
      </div>
    </AppLayout>
  );
}