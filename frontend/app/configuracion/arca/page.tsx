"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileKey2,
  HelpCircle,
  KeyRound,
  Loader2,
  MapPin,
  PlayCircle,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Store,
  UploadCloud,
  Video,
  XCircle,
  type LucideIcon,
} from "lucide-react";

// Types
type ArcaEnvironment = "PRODUCCION" | "HOMOLOGACION";

type ArcaConfig = {
  id: string;
  businessName: string;
  cuit: string;
  ivaCondition: string;
  fiscalAddress?: string;
  iibb?: string;
  activityStart?: string;
  environment: ArcaEnvironment;
  defaultPointOfSale?: number;
  certAlias?: string;
  csrGeneratedAt?: string;
  certExpiresAt?: string;
  lastTokenAt?: string;
  lastCheckAt?: string;
  lastError?: string;
  isActive: boolean;
  status: string;
  pointsOfSale?: { number: number; isDefault: boolean }[];
};

type FormState = {
  businessName: string;
  cuit: string;
  ivaCondition: string;
  fiscalAddress: string;
  iibb: string;
  activityStart: string;
  environment: ArcaEnvironment;
  defaultPointOfSale: string;
  certAlias: string;
};

const initialForm: FormState = {
  businessName: "",
  cuit: "",
  ivaCondition: "RESPONSABLE_INSCRIPTO",
  fiscalAddress: "",
  iibb: "",
  activityStart: "",
  environment: "PRODUCCION",
  defaultPointOfSale: "",
  certAlias: "COMARPOS",
};

// Mock service for demo - replace with your actual arcaConfigService
const arcaConfigService = {
  get: async (): Promise<ArcaConfig | null> => {
    await new Promise((r) => setTimeout(r, 800));
    return null;
  },
  generateCsr: async (data: FormState): Promise<ArcaConfig> => {
    await new Promise((r) => setTimeout(r, 1200));
    return {
      id: "1",
      businessName: data.businessName,
      cuit: data.cuit,
      ivaCondition: data.ivaCondition,
      environment: data.environment,
      defaultPointOfSale: Number(data.defaultPointOfSale),
      certAlias: data.certAlias,
      csrGeneratedAt: new Date().toISOString(),
      isActive: false,
      status: "PENDIENTE_CERTIFICADO",
    };
  },
  downloadCsr: async (_id: string): Promise<void> => {
    await new Promise((r) => setTimeout(r, 500));
    // In real implementation, this would trigger a file download
  },
  uploadCertificate: async (_id: string, _file: File): Promise<ArcaConfig> => {
    await new Promise((r) => setTimeout(r, 1500));
    return {
      id: "1",
      businessName: "Demo Empresa",
      cuit: "30123456789",
      ivaCondition: "RESPONSABLE_INSCRIPTO",
      environment: "PRODUCCION",
      defaultPointOfSale: 7,
      certAlias: "COMARPOS",
      csrGeneratedAt: new Date().toISOString(),
      certExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: false,
      status: "PENDIENTE_ACTIVACION",
    };
  },
  test: async (_id: string): Promise<{ message: string }> => {
    await new Promise((r) => setTimeout(r, 2000));
    return { message: "Conexión exitosa con ARCA" };
  },
  activate: async (_id: string): Promise<ArcaConfig> => {
    await new Promise((r) => setTimeout(r, 1000));
    return {
      id: "1",
      businessName: "Demo Empresa",
      cuit: "30123456789",
      ivaCondition: "RESPONSABLE_INSCRIPTO",
      environment: "PRODUCCION",
      defaultPointOfSale: 7,
      certAlias: "COMARPOS",
      csrGeneratedAt: new Date().toISOString(),
      certExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      lastTokenAt: new Date().toISOString(),
      lastCheckAt: new Date().toISOString(),
      isActive: true,
      status: "ACTIVO",
    };
  },
};

// Utility functions
function cleanCuit(value: string) {
  return value.replace(/\D/g, "");
}

function formatCuit(value: string) {
  const onlyNumbers = cleanCuit(value);
  if (onlyNumbers.length <= 2) return onlyNumbers;
  if (onlyNumbers.length <= 10) {
    return `${onlyNumbers.slice(0, 2)}-${onlyNumbers.slice(2)}`;
  }
  return `${onlyNumbers.slice(0, 2)}-${onlyNumbers.slice(2, 10)}-${onlyNumbers.slice(10, 11)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin datos";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sin datos";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStep(config: ArcaConfig | null) {
  if (!config) return 1;
  if (!config.csrGeneratedAt) return 1;
  if (!config.certExpiresAt) return 2;
  if (!config.isActive) return 3;
  return 4;
}

// Components
function StepIndicator({
  number,
  title,
  description,
  active,
  done,
}: {
  number: number;
  title: string;
  description: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={`relative flex items-start gap-4 rounded-2xl border p-4 transition-all duration-300 ${
        active
          ? "border-primary/40 bg-primary/10 shadow-lg shadow-primary/5"
          : done
          ? "border-primary/20 bg-primary/5"
          : "border-border bg-card/50"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-all ${
          done
            ? "bg-primary text-primary-foreground"
            : active
            ? "bg-primary/20 text-primary"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? <CheckCircle2 size={18} /> : number}
      </div>
      <div className="flex-1">
        <h3
          className={`font-semibold ${
            active || done ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {title}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {active && (
        <div className="absolute -right-1 top-1/2 -translate-y-1/2">
          <ChevronRight className="text-primary" size={20} />
        </div>
      )}
    </div>
  );
}

function HelpCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="group rounded-2xl border border-border bg-card/50 p-5 transition-all hover:border-primary/30 hover:bg-card">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
          <Icon size={20} />
        </div>
        <h4 className="font-semibold text-foreground">{title}</h4>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function VideoTutorialCard({
  title,
  description,
  duration,
  stepNumber,
}: {
  title: string;
  description: string;
  duration: string;
  stepNumber: number;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card/50 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      {/* Video Placeholder */}
      <div className="relative aspect-video bg-gradient-to-br from-muted to-muted/50">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 backdrop-blur-sm transition-transform group-hover:scale-110">
            <PlayCircle className="text-primary" size={32} />
          </div>
        </div>
        <div className="absolute bottom-3 right-3 rounded-lg bg-background/80 px-2 py-1 text-xs font-medium backdrop-blur-sm">
          {duration}
        </div>
        <div className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
          {stepNumber}
        </div>
      </div>
      <div className="p-4">
        <h4 className="font-semibold text-foreground">{title}</h4>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function FormField({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1 text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StatusBadge({ isActive, status }: { isActive: boolean; status: string }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
        <CheckCircle2 size={14} />
        Activa
      </span>
    );
  }
  if (status === "ERROR") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/15 px-3 py-1 text-xs font-medium text-destructive">
        <XCircle size={14} />
        Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-400">
      <ShieldCheck size={14} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  children,
  color = "emerald",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
  color?: "emerald" | "sky" | "violet";
}) {
  const colorClasses = {
    emerald: "bg-primary/10 text-primary",
    sky: "bg-sky-400/10 text-sky-400",
    violet: "bg-violet-400/10 text-violet-400",
  };

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card/50 p-5">
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${colorClasses[color]}`}
      >
        <Icon size={24} />
      </div>
      <h4 className="mb-2 font-semibold text-foreground">{title}</h4>
      <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

export default function ArcaConfigPage() {
  const [config, setConfig] = useState<ArcaConfig | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [certificate, setCertificate] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const currentStep = useMemo(() => getStep(config), [config]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await arcaConfigService.get();
      setConfig(data);

      if (data) {
        setForm({
          businessName: data.businessName || "",
          cuit: data.cuit || "",
          ivaCondition: data.ivaCondition || "RESPONSABLE_INSCRIPTO",
          fiscalAddress: data.fiscalAddress || "",
          iibb: data.iibb || "",
          activityStart: data.activityStart ? data.activityStart.slice(0, 10) : "",
          environment: data.environment || "PRODUCCION",
          defaultPointOfSale: String(
            data.defaultPointOfSale ||
              data.pointsOfSale?.find((point) => point.isDefault)?.number ||
              ""
          ),
          certAlias: data.certAlias || "COMARPOS",
        });
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err?.response?.data?.error || "No se pudo cargar la configuración de ARCA");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateFiscalData = () => {
    if (!form.businessName.trim()) return "Ingresá la razón social.";
    if (cleanCuit(form.cuit).length !== 11) return "El CUIT debe tener 11 dígitos.";
    if (!form.defaultPointOfSale || Number(form.defaultPointOfSale) <= 0)
      return "Ingresá un punto de venta válido.";
    return null;
  };

  const handleGenerateCsr = async () => {
    const error = validateFiscalData();
    if (error) {
      toast.error(error);
      return;
    }

    try {
      setGenerating(true);
      const next = await arcaConfigService.generateCsr({
        ...form,
        cuit: cleanCuit(form.cuit),
      });
      setConfig(next);
      toast.success("CSR generado correctamente", {
        description: "Descargalo y mandáselo al contador para que lo suba a ARCA.",
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; message?: string } } };
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "No se pudo generar el CSR");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadCsr = async () => {
    if (!config) return;
    try {
      setDownloading(true);
      await arcaConfigService.downloadCsr(config.id);
      toast.success("CSR descargado", {
        description: "Enviá este archivo a tu contador para generar el certificado en ARCA.",
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err?.response?.data?.error || "No se pudo descargar el CSR");
    } finally {
      setDownloading(false);
    }
  };

  const handleUploadCertificate = async () => {
    if (!config) return;
    if (!certificate) {
      toast.error("Seleccioná el archivo .crt que te devuelve ARCA");
      return;
    }
    if (!certificate.name.toLowerCase().endsWith(".crt")) {
      toast.error("El archivo debe tener extensión .crt");
      return;
    }

    try {
      setUploading(true);
      const next = await arcaConfigService.uploadCertificate(config.id, certificate);
      setConfig(next);
      setCertificate(null);
      toast.success("Certificado cargado correctamente", {
        description: "Ahora podés probar la conexión y activar ARCA.",
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; message?: string } } };
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "No se pudo subir el certificado");
    } finally {
      setUploading(false);
    }
  };

  const handleTest = async () => {
    if (!config) return;
    try {
      setTesting(true);
      const result = await arcaConfigService.test(config.id);
      toast.success("Conexión exitosa", {
        description: result?.message || "La conexión con ARCA funciona correctamente.",
      });
      await loadConfig();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err?.response?.data?.error || "No se pudo conectar con ARCA");
    } finally {
      setTesting(false);
    }
  };

  const handleActivate = async () => {
    if (!config) return;
    try {
      setActivating(true);
      const next = await arcaConfigService.activate(config.id);
      setConfig(next);
      toast.success("ARCA activado correctamente", {
        description: "Ya podés emitir facturas electrónicas.",
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err?.response?.data?.error || "No se pudo activar ARCA");
    } finally {
      setActivating(false);
    }
  };

  const handleCopyAccountantMessage = async () => {
    const message = `Hola, necesito configurar la facturación electrónica del sistema.

No necesito compartir usuario ni clave fiscal de ARCA.

El sistema ya generó el archivo CSR. Necesito que por favor:

1. Ingreses a ARCA con clave fiscal.
2. Generes el certificado digital usando el archivo CSR.
3. Autorices el servicio WSFE / Facturación Electrónica para ese certificado.
4. Me devuelvas el archivo certificado .crt.
5. Me confirmes el punto de venta habilitado para facturación electrónica.

Gracias.`;

    try {
      await navigator.clipboard.writeText(message);
      toast.success("Mensaje copiado", {
        description: "Pegalo en un email o WhatsApp para enviárselo a tu contador.",
      });
    } catch {
      toast.error("No se pudo copiar. Copialo manualmente desde la guía.");
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        {/* Header */}
        <header className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-xl shadow-black/10 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <ShieldCheck size={16} />
                Asistente de Configuración ARCA
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                Facturación Electrónica
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
                Conectá tu sistema con ARCA en 4 pasos simples. No necesitás compartir usuario
                ni clave fiscal. El asistente genera los archivos necesarios de forma segura.
              </p>
            </div>
            <button
              onClick={loadConfig}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-5 py-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </header>

        {/* Steps Progress */}
        <section className="grid gap-3 md:grid-cols-4">
          <StepIndicator
            number={1}
            title="Datos Fiscales"
            description="Completá la información de tu empresa"
            active={currentStep === 1}
            done={currentStep > 1}
          />
          <StepIndicator
            number={2}
            title="Descargar CSR"
            description="Enviá el archivo a tu contador"
            active={currentStep === 2}
            done={currentStep > 2}
          />
          <StepIndicator
            number={3}
            title="Subir Certificado"
            description="Cargá el .crt que recibiste"
            active={currentStep === 3}
            done={currentStep > 3}
          />
          <StepIndicator
            number={4}
            title="Activar"
            description="Probá y habilitá la conexión"
            active={currentStep === 4}
            done={currentStep === 4 && config?.isActive}
          />
        </section>

        {/* Video Tutorials Section */}
        <section className="rounded-3xl border border-border bg-card/50 p-6 lg:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Video size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Tutoriales en Video</h2>
              <p className="text-sm text-muted-foreground">
                Guías paso a paso para completar cada etapa
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <VideoTutorialCard
              stepNumber={1}
              title="Cómo crear un Punto de Venta"
              description="Aprende a habilitar un punto de venta para Web Service en ARCA."
              duration="3:45"
            />
            <VideoTutorialCard
              stepNumber={2}
              title="Cómo generar el Certificado"
              description="Subí el CSR a ARCA y descargá el certificado .crt."
              duration="2:30"
            />
            <VideoTutorialCard
              stepNumber={3}
              title="Autorizar WSFE"
              description="Habilitá el servicio de facturación electrónica para tu certificado."
              duration="1:50"
            />
          </div>
        </section>

        {/* Main Content Grid */}
        <div className="grid gap-8 xl:grid-cols-[480px_1fr]">
          {/* Form Section */}
          <section className="rounded-3xl border border-border bg-card p-6 shadow-xl shadow-black/10">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileKey2 size={22} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Datos Fiscales</h2>
                <p className="text-sm text-muted-foreground">
                  Información necesaria para generar el CSR
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <FormField
                label="Razón Social"
                hint="Es el nombre fiscal de la empresa o persona que va a emitir las facturas."
                required
              >
                <input
                  value={form.businessName}
                  onChange={(e) => setField("businessName", e.target.value)}
                  placeholder="Ej: Grupo VJ SRL"
                  className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </FormField>

              <FormField
                label="CUIT"
                hint="Lo encontrás en la constancia de inscripción de ARCA."
                required
              >
                <input
                  value={formatCuit(form.cuit)}
                  onChange={(e) => setField("cuit", e.target.value)}
                  placeholder="30-12345678-9"
                  className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </FormField>

              <FormField label="Condición IVA" hint="También sale de la constancia de inscripción.">
                <select
                  value={form.ivaCondition}
                  onChange={(e) => setField("ivaCondition", e.target.value)}
                  className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="RESPONSABLE_INSCRIPTO">Responsable Inscripto</option>
                  <option value="MONOTRIBUTO">Monotributo</option>
                  <option value="EXENTO">Exento</option>
                </select>
              </FormField>

              <FormField
                label="Domicilio Fiscal"
                hint="Campo opcional. Sirve para tener los datos fiscales completos dentro del sistema."
              >
                <input
                  value={form.fiscalAddress}
                  onChange={(e) => setField("fiscalAddress", e.target.value)}
                  placeholder="Opcional"
                  className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Ambiente"
                  hint="Producción emite comprobantes reales. Homologación es para pruebas."
                >
                  <select
                    value={form.environment}
                    onChange={(e) => setField("environment", e.target.value as ArcaEnvironment)}
                    className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    <option value="PRODUCCION">Producción</option>
                    <option value="HOMOLOGACION">Homologación</option>
                  </select>
                </FormField>

                <FormField
                  label="Punto de Venta"
                  hint="Debe estar habilitado para Web Service."
                  required
                >
                  <input
                    type="number"
                    value={form.defaultPointOfSale}
                    onChange={(e) => setField("defaultPointOfSale", e.target.value)}
                    placeholder="Ej: 7"
                    className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </FormField>
              </div>

              <FormField
                label="Alias del Certificado"
                hint="Es un nombre interno para identificar el certificado. Puede ser el nombre del sistema."
              >
                <input
                  value={form.certAlias}
                  onChange={(e) => setField("certAlias", e.target.value)}
                  placeholder="COMARPOS"
                  className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </FormField>

              <button
                onClick={handleGenerateCsr}
                disabled={generating}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {generating ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <FileKey2 size={18} />
                )}
                Generar pedido CSR
              </button>
            </div>
          </section>

          {/* Config Status Section */}
          <section className="rounded-3xl border border-border bg-card p-6 shadow-xl shadow-black/10">
            {loading ? (
              <div className="flex min-h-[500px] items-center justify-center text-muted-foreground">
                <Loader2 className="mr-3 animate-spin" size={24} />
                Cargando configuración...
              </div>
            ) : !config ? (
              <div className="flex min-h-[500px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <FileKey2 size={32} />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  Todavía no generaste la configuración
                </h3>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Completá los datos fiscales en el formulario de la izquierda y generá el pedido
                  CSR para comenzar.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* Business Info Card */}
                <div className="rounded-2xl border border-border bg-secondary/30 p-5">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <StatusBadge isActive={config.isActive} status={config.status} />
                    <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
                      {config.environment === "PRODUCCION" ? "Producción" : "Homologación"}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">{config.businessName}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    CUIT {formatCuit(config.cuit)} · PV {config.defaultPointOfSale || "sin definir"}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: "CSR generado", value: formatDateTime(config.csrGeneratedAt) },
                      { label: "Vence certificado", value: formatDate(config.certExpiresAt) },
                      { label: "Último token", value: formatDateTime(config.lastTokenAt) },
                      { label: "Última prueba", value: formatDateTime(config.lastCheckAt) },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-border bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="mt-1 font-medium text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {config.lastError && (
                    <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                      {config.lastError}
                    </div>
                  )}
                </div>

                {/* Action Cards */}
                <div className="grid gap-4 lg:grid-cols-3">
                  <ActionCard
                    icon={Download}
                    title="1. Descargar CSR"
                    description="Este archivo se sube en ARCA para generar el certificado. Descargalo y mandáselo al contador."
                    color="emerald"
                  >
                    <button
                      onClick={handleDownloadCsr}
                      disabled={!config.csrGeneratedAt || downloading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                    >
                      {downloading ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <Download size={18} />
                      )}
                      Descargar CSR
                    </button>
                  </ActionCard>

                  <ActionCard
                    icon={UploadCloud}
                    title="2. Subir certificado .crt"
                    description="Cuando ARCA o el contador devuelva el certificado, cargalo acá."
                    color="sky"
                  >
                    <div className="space-y-3">
                      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-4 py-4 text-center transition-colors hover:border-sky-400/50 hover:bg-sky-400/5">
                        <UploadCloud className="mb-2 text-sky-400" size={24} />
                        <span className="text-sm text-muted-foreground">
                          {certificate ? certificate.name : "Seleccionar .crt"}
                        </span>
                        <input
                          type="file"
                          accept=".crt"
                          className="hidden"
                          onChange={(e) => setCertificate(e.target.files?.[0] || null)}
                        />
                      </label>
                      <button
                        onClick={handleUploadCertificate}
                        disabled={uploading || !certificate}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm font-medium text-sky-400 transition-colors hover:bg-sky-400/20 disabled:opacity-50"
                      >
                        {uploading ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <FileCheck2 size={18} />
                        )}
                        Subir certificado
                      </button>
                    </div>
                  </ActionCard>

                  <ActionCard
                    icon={PlugZap}
                    title="3. Probar y activar"
                    description="Validá WSAA, generá token y dejá ARCA listo para emitir facturas."
                    color="violet"
                  >
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={handleTest}
                        disabled={testing || !config.certExpiresAt}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-violet-400/10 px-4 py-3 text-sm font-medium text-violet-400 transition-colors hover:bg-violet-400/20 disabled:opacity-50"
                      >
                        {testing ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <PlugZap size={18} />
                        )}
                        Probar conexión
                      </button>
                      <button
                        onClick={handleActivate}
                        disabled={activating || !config.certExpiresAt}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                      >
                        {activating ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <BadgeCheck size={18} />
                        )}
                        Activar ARCA
                      </button>
                    </div>
                  </ActionCard>
                </div>

                {/* Message for accountant */}
                <div className="flex items-center gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex-1 text-sm leading-relaxed text-amber-200">
                    <strong className="text-amber-100">Mensaje para el contador:</strong>{" "}
                    {'"Te paso el archivo CSR generado por el sistema. Por favor generá el certificado digital en ARCA, autorizá WSFE / Facturación Electrónica y devolveme el archivo .crt."'}
                  </div>
                  <button
                    onClick={handleCopyAccountantMessage}
                    className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/20 p-2.5 text-amber-200 transition-colors hover:bg-amber-500/30"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Help Guide Section */}
        <section className="rounded-3xl border border-border bg-card p-6 shadow-xl shadow-black/10 lg:p-8">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <HelpCircle size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">¿Cómo consigo cada cosa?</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Esta guía está pensada para un usuario normal. La idea es que puedas conectar ARCA
                sin entender de certificados y sin entregar usuario ni clave fiscal.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <HelpCard icon={ShieldCheck} title="CUIT, razón social y condición IVA">
              Estos datos salen de la constancia de inscripción de ARCA. Normalmente los tiene el
              cliente o el contador. El CUIT se puede escribir con o sin guiones.
            </HelpCard>

            <HelpCard icon={Store} title="Punto de venta">
              Es el número habilitado para facturación electrónica. Si el cliente ya factura
              electrónicamente, el contador puede confirmar cuál usar. Si no tiene uno, el contador
              debe dar de alta un punto de venta para Web Service en ARCA.
            </HelpCard>

            <HelpCard icon={KeyRound} title="CSR y clave privada">
              El sistema genera automáticamente la clave privada y el archivo CSR. La clave privada
              queda guardada encriptada en el backend. El usuario solo descarga el CSR y se lo manda
              al contador.
            </HelpCard>

            <HelpCard icon={FileCheck2} title="Certificado .crt">
              El contador entra a ARCA, sube el archivo CSR, genera el certificado digital y
              devuelve un archivo .crt. Ese .crt es lo único que después se sube al sistema.
            </HelpCard>

            <HelpCard icon={PlugZap} title="Autorizar WSFE">
              Además de generar el certificado, el contador debe autorizar el servicio WSFE /
              Facturación Electrónica para ese certificado. Si esto no se hace, la prueba de
              conexión puede fallar.
            </HelpCard>

            <HelpCard icon={UploadCloud} title="Qué archivos se manejan">
              El sistema genera el CSR. El contador devuelve el .crt. No se pide clave fiscal. No se
              pide usuario de ARCA. No se sube manualmente una .key porque la clave privada ya la
              generó el sistema.
            </HelpCard>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm leading-relaxed text-amber-100">
            <strong className="text-amber-50">Importante:</strong> nunca pidas ni guardes la clave
            fiscal de ARCA. La configuración correcta se hace con certificado digital, clave privada
            encriptada y token de Web Service.
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={handleCopyAccountantMessage}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-5 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Copy size={17} />
              Copiar mensaje para el contador
            </button>

            <a
              href="https://www.arca.gob.ar/ws/documentacion/wsaa.asp"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-5 py-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              <ExternalLink size={17} />
              Documentación ARCA
            </a>
          </div>
        </section>

        {/* How to create POS Step by Step */}
        <section className="rounded-3xl border border-border bg-card p-6 shadow-xl shadow-black/10 lg:p-8">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-400">
              <MapPin size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Cómo crear un Punto de Venta en ARCA
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Guía paso a paso para habilitar un punto de venta para facturación electrónica
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              {
                step: 1,
                title: 'Buscar "Administración de puntos de venta y domicilios"',
                description: "Ingresá a ARCA y buscá esta opción en el menú de servicios.",
              },
              {
                step: 2,
                title: "Seleccionar la Empresa a representar",
                description:
                  "Por lo general será la que aparece con tu propio CUIT. Hacé clic para seleccionarla.",
              },
              {
                step: 3,
                title: "Ir a A/B/M de punto de venta/emisión",
                description:
                  "Dentro de la empresa seleccionada, buscá la opción para agregar o modificar puntos de venta.",
              },
              {
                step: 4,
                title: "Agregar nuevo punto de venta",
                description:
                  'Completá con un nombre de fantasía. En el campo "SISTEMA" es obligatorio seleccionar "RECE para aplicativo y web services".',
              },
              {
                step: 5,
                title: "Anotar el número del punto de venta",
                description:
                  "Los números de punto de venta deben ser correlativos. Anotá el número asignado porque es el que vas a poner en el sistema.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex gap-4 rounded-xl border border-border bg-secondary/30 p-4"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-400/20 text-sm font-bold text-sky-400">
                  {item.step}
                </div>
                <div>
                  <h4 className="font-medium text-foreground">{item.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Certificate Generation Steps */}
        <section className="rounded-3xl border border-border bg-card p-6 shadow-xl shadow-black/10 lg:p-8">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-400">
              <FileKey2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Cómo generar el Certificado en ARCA
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Pasos para que el contador suba el CSR y genere el certificado .crt
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              {
                step: 1,
                title: 'Buscar "Administración de Certificados Digitales"',
                description: "El contador debe ingresar a ARCA y buscar esta opción.",
              },
              {
                step: 2,
                title: "Agregar un nuevo Alias",
                description:
                  "Hacer clic en Agregar Alias y poner un nombre distintivo para identificar el certificado.",
              },
              {
                step: 3,
                title: "Subir el archivo CSR",
                description:
                  'Cargar el archivo que entregó el sistema (suele empezar con "pedido-arca...").',
              },
              {
                step: 4,
                title: "Descargar el certificado .crt",
                description:
                  "Una vez aprobado, volver a certificados, hacer clic en Ver detalle del alias creado y descargar el certificado.",
              },
              {
                step: 5,
                title: "Autorizar WSFE",
                description:
                  "Ir a la sección de autorización de servicios y habilitar WSFE / Facturación Electrónica para el certificado recién creado.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex gap-4 rounded-xl border border-border bg-secondary/30 p-4"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-400/20 text-sm font-bold text-violet-400">
                  {item.step}
                </div>
                <div>
                  <h4 className="font-medium text-foreground">{item.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
