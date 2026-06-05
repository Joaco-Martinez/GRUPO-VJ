'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import AppLayout from '@/components/AppLayout';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  HelpCircle,
  Info,
  Loader2,
  Lock,
  Play,
  RefreshCcw,
  Save,
  Shield,
  Upload,
  Wifi,
  WifiOff,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  arcaConfigApi,
  type ArcaConfig,
  type ArcaEnvironment,
} from '../../../service/arcaConfig.service';


type UIConnectionStatus =
  | 'unconfigured'
  | 'incomplete'
  | 'error'
  | 'homologation'
  | 'production'
  | 'expired';

type CardStatus = 'complete' | 'incomplete' | 'pending';

function getErrorMessage(error: unknown, fallback: string) {
  const e = error as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message ?? fallback;
}

function deriveUIStatus(config: ArcaConfig | null): UIConnectionStatus {
  if (!config) return 'unconfigured';
  if (config.status === 'CERT_EXPIRED') return 'expired';
  if (config.status === 'ERROR') return 'error';
  if (config.status === 'ACTIVE') {
    return config.environment === 'PRODUCCION' ? 'production' : 'homologation';
  }
  return 'incomplete';
}

function deriveCurrentStep(config: ArcaConfig | null): number {
  if (!config) return 1;

  const hasFiscal = Boolean(config.businessName && config.cuit && config.ivaCondition);
  const hasEnvironment = Boolean(config.environment && config.defaultPointOfSale);
  const hasCertificate = Boolean(config.certAlias && config.certExpiresAt);
  const hasTest = Boolean(config.lastSuccessAt);

  if (!hasFiscal) return 1;
  if (!hasEnvironment) return 2;
  if (!hasCertificate) return 3;
  if (!hasTest) return 4;

  return 5;
}

function formatDate(value?: string | null) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function isCertExpiringSoon(value?: string | null) {
  if (!value) return false;

  const diff = new Date(value).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

function statusLabel(status: UIConnectionStatus) {
  const map: Record<UIConnectionStatus, { label: string; badge: string }> = {
    unconfigured: { label: 'SIN CONFIGURAR', badge: 'badge-gray' },
    incomplete: { label: 'EN REVISIÓN', badge: 'badge-yellow' },
    error: { label: 'ERROR', badge: 'badge-red' },
    homologation: { label: 'HOMOLOGACIÓN', badge: 'badge-blue' },
    production: { label: 'PRODUCCIÓN', badge: 'badge-green' },
    expired: { label: 'CERTIFICADO VENCIDO', badge: 'badge-red' },
  };

  return map[status];
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function FieldHelp({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 6 }}>
      <Info size={13} style={{ color: 'var(--text3)', marginTop: 1, flexShrink: 0 }} />
      <p style={{ color: 'var(--text3)', fontSize: 12, lineHeight: 1.45 }}>{children}</p>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  status,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ElementType;
  status: CardStatus;
  children: ReactNode;
}) {
  const badgeClass =
    status === 'complete' ? 'badge-green' : status === 'incomplete' ? 'badge-yellow' : 'badge-gray';

  const badgeText =
    status === 'complete' ? 'COMPLETO' : status === 'incomplete' ? 'FALTA INFO' : 'PENDIENTE';

  return (
    <section
      className="card"
      style={{
        padding: 22,
        borderColor:
          status === 'complete'
            ? 'rgba(0,229,160,0.32)'
            : status === 'incomplete'
              ? 'rgba(251,191,36,0.32)'
              : undefined,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          alignItems: 'flex-start',
          marginBottom: 22,
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={19} />
          </span>

          <div>
            <h3 style={{ fontSize: 15, fontWeight: 900 }}>{title}</h3>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 3 }}>{subtitle}</p>
          </div>
        </div>

        <span className={`badge ${badgeClass}`}>{badgeText}</span>
      </div>

      {children}
    </section>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  help,
  type = 'text',
  optional = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: ReactNode;
  type?: string;
  optional?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="form-group">
      <label className="form-label">
        {label}
        {optional && (
          <span style={{ marginLeft: 5, color: 'var(--text3)', fontWeight: 500 }}>
            opcional
          </span>
        )}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />

      {help && <FieldHelp>{help}</FieldHelp>}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  ok,
}: {
  label: string;
  value: string;
  icon: ElementType;
  ok?: boolean;
}) {
  return (
    <div
      className="stat-card"
      style={{
        padding: 15,
        minHeight: 92,
        borderColor: ok ? 'rgba(0,229,160,0.28)' : undefined,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <Icon size={15} style={{ color: ok ? 'var(--accent)' : 'var(--text3)' }} />
        <div style={{ color: 'var(--text2)', fontSize: 12, fontWeight: 700 }}>{label}</div>
      </div>

      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 13,
          color: ok ? 'var(--accent)' : 'var(--text)',
          fontWeight: 900,
          lineHeight: 1.35,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StepSidebar({ currentStep }: { currentStep: number }) {
  const steps = [
    {
      id: 1,
      title: 'Datos fiscales',
      subtitle: 'Razón social, CUIT y condición IVA',
    },
    {
      id: 2,
      title: 'Ambiente y punto de venta',
      subtitle: 'Producción u homologación',
    },
    {
      id: 3,
      title: 'Certificado',
      subtitle: 'CSR y certificado ARCA',
    },
    {
      id: 4,
      title: 'Validación',
      subtitle: 'Probar conexión',
    },
    {
      id: 5,
      title: 'Activación',
      subtitle: 'Listo para facturar',
    },
  ];

  return (
    <aside className="card" style={{ padding: 14, position: 'sticky', top: 18 }}>
      <div
        style={{
          color: 'var(--text2)',
          fontFamily: 'var(--mono)',
          fontSize: 11,
          letterSpacing: 1,
          marginBottom: 12,
          textTransform: 'uppercase',
        }}
      >
        Configuración paso a paso
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {steps.map((step) => {
          const done = step.id < currentStep;
          const active = step.id === currentStep;

          return (
            <div
              key={step.id}
              style={{
                display: 'flex',
                gap: 10,
                padding: 10,
                borderRadius: 12,
                border: active ? '1px solid rgba(79,142,255,0.35)' : '1px solid transparent',
                background: active
                  ? 'rgba(79,142,255,0.12)'
                  : done
                    ? 'rgba(0,229,160,0.08)'
                    : 'transparent',
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  background: done
                    ? 'var(--accent)'
                    : active
                      ? 'var(--accent2)'
                      : 'var(--surface2)',
                  color: done || active ? '#000' : 'var(--text2)',
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                {done ? <CheckCircle2 size={14} /> : step.id}
              </span>

              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    color: active ? 'var(--accent2)' : done ? 'var(--accent)' : 'var(--text2)',
                  }}
                >
                  {step.title}
                </div>

                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  {step.subtitle}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function EnvironmentOption({
  selected,
  title,
  description,
  icon: Icon,
  tone,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  icon: ElementType;
  tone: 'blue' | 'orange';
  onClick: () => void;
}) {
  const selectedColor = tone === 'orange' ? 'var(--accent3)' : 'var(--accent2)';
  const selectedBg = tone === 'orange' ? 'rgba(255,107,53,0.1)' : 'rgba(79,142,255,0.1)';
  const selectedBorder =
    tone === 'orange' ? 'rgba(255,107,53,0.45)' : 'rgba(79,142,255,0.45)';

  return (
    <button
      type="button"
      onClick={onClick}
      className="card"
      style={{
        padding: 16,
        textAlign: 'left',
        borderColor: selected ? selectedBorder : undefined,
        background: selected ? selectedBg : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
        <Icon size={17} style={{ color: selected ? selectedColor : 'var(--text3)' }} />

        <strong style={{ color: selected ? selectedColor : 'var(--text)' }}>{title}</strong>

        {selected && (
          <span className={tone === 'orange' ? 'badge badge-orange' : 'badge badge-blue'}>
            Seleccionado
          </span>
        )}
      </div>

      <p style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.45 }}>{description}</p>
    </button>
  );
}

function TutorialCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div
        style={{
          height: 108,
          background:
            'linear-gradient(135deg, rgba(79,142,255,0.16), rgba(0,229,160,0.11), rgba(255,107,53,0.12))',
          borderBottom: '1px solid var(--border)',
          display: 'grid',
          placeItems: 'center',
          position: 'relative',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            fontFamily: 'var(--mono)',
            color: 'var(--text3)',
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          VIDEO {number}
        </span>

        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid var(--border2)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Play size={18} />
        </span>
      </div>

      <div style={{ padding: 15 }}>
        <strong style={{ fontSize: 13 }}>{title}</strong>
        <p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 5, lineHeight: 1.45 }}>
          {description}
        </p>

        <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, paddingLeft: 0 }}>
          Ver tutorial
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

export default function ArcaConfigPage() {
  const [config, setConfig] = useState<ArcaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState('');
  const [cuit, setCuit] = useState('');
  const [ivaCondition, setIvaCondition] = useState('Responsable Inscripto');
  const [fiscalAddress, setFiscalAddress] = useState('');
  const [iibb, setIibb] = useState('');
  const [activityStart, setActivityStart] = useState('');
  const [environment, setEnvironment] = useState<ArcaEnvironment>('HOMOLOGACION');
  const [pointOfSale, setPointOfSale] = useState('');
  const [certAlias, setCertAlias] = useState('');
  const [certFile, setCertFile] = useState<File | null>(null);

  const [testState, setTestState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);

  const [csrLoading, setCsrLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [activateLoading, setActivateLoading] = useState(false);

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyConfig = useCallback((data: ArcaConfig | null) => {
    setConfig(data);

    if (!data) return;

    setBusinessName(data.businessName ?? '');
    setCuit(data.cuit ?? '');
    setIvaCondition(data.ivaCondition ?? 'Responsable Inscripto');
    setFiscalAddress(data.fiscalAddress ?? '');
    setIibb(data.iibb ?? '');
    setActivityStart(toDateInput(data.activityStart));
    setEnvironment(data.environment ?? 'HOMOLOGACION');
    setPointOfSale(data.defaultPointOfSale ? String(data.defaultPointOfSale) : '');
    setCertAlias(data.certAlias ?? '');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const data = await arcaConfigApi.get();
      applyConfig(data);
    } catch {
      setLoadError('No se pudo cargar la configuración ARCA.');
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => {
    load();
  }, [load]);

  const showSuccess = useCallback((message: string) => {
    setGlobalSuccess(message);
    window.setTimeout(() => setGlobalSuccess(null), 4200);
  }, []);

  const showError = useCallback((message: string) => {
    setGlobalError(message);
    window.setTimeout(() => setGlobalError(null), 6500);
  }, []);

  const uiStatus = deriveUIStatus(config);
  const status = statusLabel(uiStatus);
  const currentStep = deriveCurrentStep(config);
  const isProduction = environment === 'PRODUCCION';

  const fiscalCardStatus: CardStatus =
    businessName && cuit && ivaCondition ? 'complete' : 'incomplete';

  const environmentCardStatus: CardStatus = pointOfSale ? 'complete' : 'incomplete';

  const certCardStatus: CardStatus = config?.certExpiresAt
    ? 'complete'
    : config?.csrGeneratedAt
      ? 'incomplete'
      : 'pending';

  const validationOk = testState === 'success' || Boolean(config?.lastSuccessAt);
  const canActivate = validationOk || config?.status === 'ACTIVE';

  const stats = useMemo(
    () => [
      {
        label: 'Ambiente',
        value:
          config?.environment === 'PRODUCCION'
            ? 'Producción'
            : config?.environment === 'HOMOLOGACION'
              ? 'Homologación'
              : '—',
        icon: config?.environment === 'PRODUCCION' ? AlertTriangle : Lock,
        ok: Boolean(config?.environment),
      },
      {
        label: 'CUIT',
        value: config?.cuit ?? '—',
        icon: FileText,
        ok: Boolean(config?.cuit),
      },
      {
        label: 'Punto de venta',
        value: config?.defaultPointOfSale
          ? String(config.defaultPointOfSale).padStart(4, '0')
          : '—',
        icon: Building2,
        ok: Boolean(config?.defaultPointOfSale),
      },
      {
        label: 'Certificado',
        value: config?.certExpiresAt
          ? `Vence ${formatDate(config.certExpiresAt)}`
          : config?.csrGeneratedAt
            ? 'CSR generado'
            : 'Pendiente',
        icon: Shield,
        ok: Boolean(config?.certExpiresAt),
      },
      {
        label: 'Conexión ARCA',
        value:
          config?.status === 'ACTIVE'
            ? 'Validada'
            : config?.status === 'ERROR'
              ? 'Error'
              : 'Sin probar',
        icon: config?.status === 'ACTIVE' ? Wifi : WifiOff,
        ok: config?.status === 'ACTIVE',
      },
      {
        label: 'Última validación',
        value: config?.lastSuccessAt ? formatDateTime(config.lastSuccessAt) : '—',
        icon: Clock,
        ok: Boolean(config?.lastSuccessAt),
      },
    ],
    [config]
  );

  const handleGenerateCsr = async () => {
    if (!businessName.trim() || !cuit.trim() || !environment || !pointOfSale.trim()) {
      showError('Completá razón social, CUIT, ambiente y punto de venta antes de generar el CSR.');
      return;
    }

    setCsrLoading(true);

    try {
      const updated = await arcaConfigApi.generateCsr({
        businessName: businessName.trim(),
        cuit: cuit.trim(),
        ivaCondition,
        fiscalAddress: fiscalAddress.trim(),
        iibb: iibb.trim(),
        activityStart,
        environment,
        defaultPointOfSale: pointOfSale.trim(),
        certAlias: certAlias.trim(),
      });

      applyConfig(updated);
      showSuccess('CSR generado correctamente. Ahora podés descargarlo.');
    } catch (error) {
      showError(getErrorMessage(error, 'Error al generar el CSR.'));
    } finally {
      setCsrLoading(false);
    }
  };

  const handleDownloadCsr = async () => {
    if (!config?.id) return;

    setDownloadLoading(true);

    try {
      await arcaConfigApi.downloadCsr(config.id);
    } catch {
      showError('No se pudo descargar el CSR.');
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleUploadCert = async (file: File) => {
    if (!config?.id) {
      showError('Primero generá el CSR para poder subir el certificado.');
      return;
    }

    setCertFile(file);
    setUploadLoading(true);

    try {
      const updated = await arcaConfigApi.uploadCertificate(config.id, file);
      applyConfig(updated);
      showSuccess('Certificado cargado correctamente.');
    } catch (error) {
      setCertFile(null);
      showError(getErrorMessage(error, 'Error al subir el certificado.'));
    } finally {
      setUploadLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config?.id) {
      showError('Primero generá el CSR y cargá el certificado.');
      return;
    }

    setTestState('loading');
    setTestError(null);

    try {
      await arcaConfigApi.test(config.id);
      const updated = await arcaConfigApi.get();

      applyConfig(updated);
      setTestState('success');
      showSuccess('Conexión validada correctamente.');
    } catch (error) {
      const message = getErrorMessage(error, 'No se pudo conectar con ARCA.');
      setTestError(message);
      setTestState('error');
      showError(message);
    }
  };

  const handleActivate = async () => {
    if (!config?.id) return;

    setActivateLoading(true);

    try {
      const updated = await arcaConfigApi.activate(config.id);
      applyConfig(updated);
      showSuccess('Configuración activada. Ya podés emitir comprobantes.');
    } catch (error) {
      showError(getErrorMessage(error, 'Error al activar la configuración.'));
    } finally {
      setActivateLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Configuración ARCA" subtitle="Conexión fiscal para facturación electrónica">
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text2)' }}>
            <span className="spinner" />
            Cargando configuración ARCA...
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout title="Configuración ARCA" subtitle="Conexión fiscal para facturación electrónica">
        <div className="empty-state card">
          <XCircle size={38} />
          <p>{loadError}</p>

          <button className="btn btn-primary" onClick={load} style={{ marginTop: 14 }}>
            <RefreshCcw size={14} />
            Reintentar
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Configuración ARCA"
      subtitle="Completá los datos fiscales y validá la conexión para emitir comprobantes desde Grupo VJ"
      actions={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => window.history.back()}>
            <ArrowLeft size={14} />
            Volver
          </button>

          <button className="btn btn-secondary btn-sm">
            <BookOpen size={14} />
            Ver guía
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={handleTestConnection}
            disabled={!config?.id || testState === 'loading'}
          >
            {testState === 'loading' ? <span className="spinner" /> : <RefreshCcw size={14} />}
            Probar conexión
          </button>
        </div>
      }
    >
      {globalSuccess && (
        <div className="toast toast-success">
          <CheckCircle2 size={18} />
          {globalSuccess}
        </div>
      )}

      {globalError && (
        <div className="toast toast-error">
          <AlertCircle size={18} />
          {globalError}
        </div>
      )}

      {isProduction && (
        <div
          className="card"
          style={{
            padding: 14,
            marginBottom: 18,
            borderColor: 'rgba(255,107,53,0.42)',
            background: 'rgba(255,107,53,0.1)',
            color: 'var(--accent3)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontWeight: 800,
          }}
        >
          <AlertTriangle size={18} />
          Atención: estás en modo Producción. Los comprobantes emitidos son reales y quedan
          informados ante ARCA.
        </div>
      )}

      {isCertExpiringSoon(config?.certExpiresAt) && (
        <div
          className="card"
          style={{
            padding: 14,
            marginBottom: 18,
            borderColor: 'rgba(251,191,36,0.42)',
            background: 'rgba(251,191,36,0.1)',
            color: 'var(--warn)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontWeight: 800,
          }}
        >
          <AlertTriangle size={18} />
          El certificado vence el {formatDate(config?.certExpiresAt)}. Renovalo para evitar cortes
          de facturación.
        </div>
      )}

      <div
        className="card"
        style={{
          padding: 16,
          marginBottom: 18,
          borderColor: 'rgba(79,142,255,0.3)',
          background: 'rgba(79,142,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <strong>Antes de empezar</strong>
              <span className={`badge ${status.badge}`}>{status.label}</span>
            </div>

            <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.5 }}>
              Esta configuración conecta Grupo VJ con ARCA para emitir comprobantes electrónicos.
              Si no tenés algún dato, pedíselo a tu contador antes de activar Producción.
            </p>
          </div>

          <span className="badge badge-blue">Facturación electrónica</span>
        </div>
      </div>

      {config?.lastError && config.status === 'ERROR' && (
        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 18,
            borderColor: 'rgba(239,68,68,0.35)',
            background: 'rgba(239,68,68,0.09)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertCircle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
            <div>
              <strong style={{ color: 'var(--danger)' }}>Último error de conexión</strong>
              <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>{config.lastError}</p>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        {stats.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            icon={item.icon}
            ok={item.ok}
          />
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '280px minmax(0, 1fr)',
          gap: 18,
          alignItems: 'start',
        }}
      >
        <StepSidebar currentStep={currentStep} />

        <div style={{ display: 'grid', gap: 18 }}>
          <SectionCard
            title="Datos fiscales"
            subtitle="Información de la empresa que emitirá los comprobantes"
            icon={FileText}
            status={fiscalCardStatus}
          >
            <div className="form-group">
              <label className="form-label">Razón social *</label>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ej: LEDESEMA MARIA PAULA"
              />
              <FieldHelp>
                Es el nombre fiscal de la empresa o persona que va a emitir las facturas.
              </FieldHelp>
            </div>

            <div className="form-row">
              <InputField
                label="CUIT *"
                value={cuit}
                onChange={setCuit}
                placeholder="20-12345678-9"
                help="Lo encontrás en la constancia de inscripción de ARCA."
              />

              <div className="form-group">
                <label className="form-label">Condición IVA *</label>
                <select value={ivaCondition} onChange={(e) => setIvaCondition(e.target.value)}>
                  <option value="Responsable Inscripto">Responsable Inscripto</option>
                  <option value="Monotributista">Monotributista</option>
                  <option value="Exento">Exento</option>
                  <option value="No Responsable">No Responsable</option>
                </select>
                <FieldHelp>También sale de la constancia de inscripción de ARCA.</FieldHelp>
              </div>
            </div>

            <InputField
              label="Domicilio fiscal"
              value={fiscalAddress}
              onChange={setFiscalAddress}
              placeholder="Ej: Pública 0 Dpto:13 M:15"
              optional
              help="Campo opcional. Sirve para tener los datos fiscales completos dentro del sistema."
            />

            <div className="form-row">
              <InputField
                label="IIBB"
                value={iibb}
                onChange={setIibb}
                placeholder="123456789"
                optional
                help="Número de Ingresos Brutos. Opcional, según tu actividad."
              />

              <InputField
                label="Inicio de actividades"
                value={activityStart}
                onChange={setActivityStart}
                type="date"
                optional
                help="Fecha de inicio de actividades según ARCA."
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Ambiente y punto de venta"
            subtitle="Configurá si emitís comprobantes reales o de prueba"
            icon={Building2}
            status={environmentCardStatus}
          >
            <div className="form-group">
              <label className="form-label">Ambiente *</label>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 12,
                }}
              >
                <EnvironmentOption
                  selected={environment === 'HOMOLOGACION'}
                  title="Homologación"
                  description="Modo de prueba. Los comprobantes no son reales."
                  icon={Lock}
                  tone="blue"
                  onClick={() => setEnvironment('HOMOLOGACION')}
                />

                <EnvironmentOption
                  selected={environment === 'PRODUCCION'}
                  title="Producción"
                  description="Comprobantes reales informados ante ARCA."
                  icon={AlertTriangle}
                  tone="orange"
                  onClick={() => setEnvironment('PRODUCCION')}
                />
              </div>

              {isProduction && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid rgba(255,107,53,0.35)',
                    background: 'rgba(255,107,53,0.08)',
                    color: 'var(--accent3)',
                    fontSize: 12,
                    lineHeight: 1.45,
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>
                    <strong>Atención:</strong> En Producción se emiten comprobantes reales.
                    Asegurate de tener todo configurado correctamente antes de activar.
                  </span>
                </div>
              )}
            </div>

            <InputField
              label="Punto de venta *"
              value={pointOfSale}
              onChange={setPointOfSale}
              placeholder="0001"
              help="Te lo confirma el contador. Debe estar habilitado para facturación electrónica / Web Service."
            />

            {config?.pointsOfSale && config.pointsOfSale.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <label className="form-label">Puntos de venta detectados</label>

                <div style={{ display: 'grid', gap: 8 }}>
                  {config.pointsOfSale.map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      className="card"
                      onClick={() => setPointOfSale(String(pos.number))}
                      style={{
                        padding: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: 'center',
                        textAlign: 'left',
                        borderColor:
                          String(pos.number) === pointOfSale
                            ? 'rgba(79,142,255,0.45)'
                            : undefined,
                        background:
                          String(pos.number) === pointOfSale ? 'rgba(79,142,255,0.08)' : undefined,
                      }}
                    >
                      <strong style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
                        PV {String(pos.number).padStart(4, '0')}
                      </strong>

                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {pos.description && (
                          <span style={{ color: 'var(--text2)', fontSize: 12 }}>
                            {pos.description}
                          </span>
                        )}

                        {pos.isDefault && <span className="badge badge-blue">Default</span>}

                        <span className={`badge ${pos.enabled ? 'badge-green' : 'badge-red'}`}>
                          {pos.enabled ? 'Habilitado' : 'Deshabilitado'}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Certificado ARCA"
            subtitle="Autorización para conectar Grupo VJ con los servicios de ARCA"
            icon={Shield}
            status={certCardStatus}
          >
            <InputField
              label="Alias del certificado"
              value={certAlias}
              onChange={setCertAlias}
              placeholder="grupo-vj-arca"
              help="Nombre interno para identificar el certificado dentro del sistema."
            />

            <div
              className="card"
              style={{
                padding: 16,
                marginBottom: 14,
                background: 'var(--surface2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <strong style={{ fontSize: 13 }}>Paso 1 — Generar solicitud CSR</strong>
                  <p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 5, lineHeight: 1.45 }}>
                    Se genera un archivo CSR con tus datos. Ese archivo se sube al portal de ARCA
                    para obtener el certificado.
                  </p>
                </div>

                {config?.csrGeneratedAt && (
                  <span className="badge badge-green">
                    Generado {formatDate(config.csrGeneratedAt)}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleGenerateCsr}
                  disabled={csrLoading}
                >
                  {csrLoading ? <span className="spinner" /> : <Save size={14} />}
                  {config?.csrGeneratedAt ? 'Regenerar CSR' : 'Generar CSR'}
                </button>

                {config?.csrGeneratedAt && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleDownloadCsr}
                    disabled={downloadLoading}
                  >
                    {downloadLoading ? <span className="spinner" /> : <Download size={14} />}
                    Descargar CSR
                  </button>
                )}
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: 16,
                background: 'var(--surface2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <strong style={{ fontSize: 13 }}>Paso 2 — Subir certificado</strong>
                  <p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 5, lineHeight: 1.45 }}>
                    Cuando ARCA emita el certificado, subí el archivo .crt, .pem o .cer para
                    autorizar la conexión.
                  </p>
                </div>

                {config?.certExpiresAt && (
                  <span
                    className={`badge ${
                      isCertExpiringSoon(config.certExpiresAt) ? 'badge-yellow' : 'badge-green'
                    }`}
                  >
                    Vence {formatDate(config.certExpiresAt)}
                  </span>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".crt,.pem,.cer"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadCert(file);
                }}
              />

              <button
                type="button"
                className="card"
                onClick={() => {
                  if (!config?.id) {
                    showError('Primero generá el CSR para poder subir el certificado.');
                    return;
                  }

                  fileInputRef.current?.click();
                }}
                disabled={uploadLoading}
                style={{
                  width: '100%',
                  marginTop: 14,
                  padding: 20,
                  borderStyle: 'dashed',
                  textAlign: 'center',
                  background: 'var(--surface)',
                  opacity: !config?.id ? 0.55 : 1,
                }}
              >
                {uploadLoading ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      color: 'var(--text2)',
                    }}
                  >
                    <span className="spinner" />
                    Subiendo certificado...
                  </span>
                ) : (
                  <>
                    <Upload size={22} style={{ margin: '0 auto 8px', color: 'var(--text3)' }} />
                    <strong style={{ fontSize: 13 }}>
                      {certFile
                        ? certFile.name
                        : config?.certExpiresAt
                          ? 'Reemplazar certificado'
                          : 'Seleccionar archivo del certificado'}
                    </strong>
                    <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>
                      Formatos aceptados: .crt, .pem, .cer
                    </p>
                  </>
                )}
              </button>
            </div>
          </SectionCard>

          <div>
            <div
              style={{
                color: 'var(--text2)',
                fontFamily: 'var(--mono)',
                fontSize: 11,
                letterSpacing: 1,
                marginBottom: 12,
                textTransform: 'uppercase',
              }}
            >
              Tutoriales
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 12,
              }}
            >
              <TutorialCard
                number={1}
                title="Cómo completar los datos fiscales"
                description="Dónde encontrar razón social, CUIT, condición IVA y domicilio fiscal."
              />

              <TutorialCard
                number={2}
                title="Cómo activar el punto de venta"
                description="Qué pedirle al contador y qué significa el punto de venta fiscal."
              />

              <TutorialCard
                number={3}
                title="Cómo validar la conexión"
                description="Qué revisar si falla la conexión y cuándo contactar soporte."
              />
            </div>
          </div>

          <section
            className="card"
            style={{
              padding: 22,
              borderColor:
                testState === 'error'
                  ? 'rgba(239,68,68,0.35)'
                  : validationOk
                    ? 'rgba(0,229,160,0.32)'
                    : 'rgba(79,142,255,0.32)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                alignItems: 'flex-start',
                marginBottom: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Wifi size={19} />
                </span>

                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 900 }}>Validación de conexión</h3>
                  <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 3 }}>
                    Probá que ARCA responde correctamente antes de activar
                  </p>
                </div>
              </div>

              {validationOk && <span className="badge badge-green">CONEXIÓN VALIDADA</span>}
            </div>

            {testState === 'idle' && !validationOk && (
              <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
                Una vez que cargues el certificado, probá la conexión para confirmar que el CUIT,
                el punto de venta, el ambiente y el certificado correspondan entre sí.
              </p>
            )}

            {testState === 'loading' && (
              <div
                style={{
                  padding: 14,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  color: 'var(--text2)',
                  marginBottom: 16,
                }}
              >
                <span className="spinner" />
                Conectando con los servidores de ARCA...
              </div>
            )}

            {validationOk && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid rgba(0,229,160,0.28)',
                  background: 'rgba(0,229,160,0.08)',
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', gap: 10 }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: 'var(--accent)' }}>
                      Conexión validada correctamente
                    </strong>
                    <p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 4 }}>
                      La configuración está lista para ser activada.
                      {config?.lastSuccessAt && ` Última prueba: ${formatDateTime(config.lastSuccessAt)}`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {testState === 'error' && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid rgba(239,68,68,0.32)',
                  background: 'rgba(239,68,68,0.08)',
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <AlertCircle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: 'var(--danger)' }}>No se pudo conectar con ARCA</strong>
                    <p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 4 }}>
                      {testError ??
                        'Revisá que el CUIT, el punto de venta, el ambiente y el certificado correspondan entre sí.'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 7 }}>
                  {[
                    'Verificar CUIT correcto',
                    'Confirmar punto de venta con el contador',
                    'Verificar que el ambiente coincida',
                    'Revisar certificado vigente',
                  ].map((item) => (
                    <div
                      key={item}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        color: 'var(--text2)',
                        fontSize: 12,
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 4,
                          border: '1px solid rgba(239,68,68,0.35)',
                          background: 'var(--surface)',
                        }}
                      />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleTestConnection}
              disabled={!config?.id || testState === 'loading'}
            >
              {testState === 'loading' ? <span className="spinner" /> : <RefreshCcw size={16} />}
              {testState === 'error' ? 'Reintentar conexión' : 'Probar conexión'}
            </button>
          </section>

          <div
            className="card"
            style={{
              padding: 16,
              position: 'sticky',
              bottom: 0,
              zIndex: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              boxShadow: '0 -12px 40px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <HelpCircle size={18} style={{ color: 'var(--text3)' }} />
              <p style={{ color: 'var(--text2)', fontSize: 12 }}>
                Generá el CSR, subí el certificado y probá la conexión antes de activar.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                onClick={handleGenerateCsr}
                disabled={csrLoading}
              >
                {csrLoading ? <span className="spinner" /> : <Save size={15} />}
                {config?.csrGeneratedAt ? 'Regenerar CSR' : 'Generar CSR'}
              </button>

              <button
                className="btn btn-primary"
                onClick={handleActivate}
                disabled={!canActivate || activateLoading || config?.status === 'ACTIVE'}
              >
                {activateLoading ? <span className="spinner" /> : <Zap size={15} />}
                {config?.status === 'ACTIVE' ? 'Configuración activa' : 'Activar configuración'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}