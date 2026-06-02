"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import AppLayout from "@/components/AppLayout";
import {
  arcaConfigService,
  ArcaConfig,
  ArcaEnvironment,
} from "../../../service/arcaConfig.service";
import {
  BadgeCheck,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileKey2,
  HelpCircle,
  KeyRound,
  Loader2,
  MapPin,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  XCircle,
  type LucideIcon,
} from "lucide-react";

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

function cleanCuit(value: string) {
  return value.replace(/\D/g, "");
}

function formatCuit(value: string) {
  const onlyNumbers = cleanCuit(value);

  if (onlyNumbers.length <= 2) return onlyNumbers;

  if (onlyNumbers.length <= 10) {
    return `${onlyNumbers.slice(0, 2)}-${onlyNumbers.slice(2)}`;
  }

  return `${onlyNumbers.slice(0, 2)}-${onlyNumbers.slice(
    2,
    10
  )}-${onlyNumbers.slice(10, 11)}`;
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

function StepBadge({
  number,
  title,
  active,
  done,
}: {
  number: number;
  title: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
        active
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
          : done
          ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300"
          : "border-white/10 bg-white/[0.03] text-zinc-400"
      }`}
    >
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold ${
          done ? "bg-emerald-400 text-[#04100b]" : "bg-white/10"
        }`}
      >
        {done ? <CheckCircle2 size={17} /> : number}
      </div>

      <span className="text-sm font-medium">{title}</span>
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
          <Icon size={18} />
        </div>

        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>

      <div className="text-sm leading-6 text-zinc-400">{children}</div>
    </div>
  );
}

function ArcaUserGuide({
  currentStep,
  onCopyMessage,
}: {
  currentStep: number;
  onCopyMessage: () => void;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#0b1115] p-5 shadow-xl shadow-black/20">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
          <HelpCircle size={22} />
        </div>

        <div>
          <h2 className="text-lg font-semibold">¿Cómo consigo cada cosa?</h2>

          <p className="mt-1 text-sm leading-6 text-zinc-500">
            Esta guía está pensada para un usuario normal. La idea es que pueda
            conectar ARCA sin entender de certificados y sin entregar usuario ni
            clave fiscal.
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <HelpCard icon={ShieldCheck} title="CUIT, razón social y condición IVA">
          Estos datos salen de la constancia de inscripción de ARCA. Normalmente
          los tiene el cliente o el contador. El CUIT se puede escribir con o sin
          guiones.
        </HelpCard>

        <HelpCard icon={MapPin} title="Punto de venta">
          Es el número habilitado para facturación electrónica. Si el cliente ya
          factura electrónicamente, el contador puede confirmar cuál usar. Si no
          tiene uno, el contador debe dar de alta un punto de venta para Web
          Service en ARCA.
        </HelpCard>

        <HelpCard icon={KeyRound} title="CSR y clave privada">
          El sistema genera automáticamente la clave privada y el archivo CSR.
          La clave privada queda guardada encriptada en el backend. El usuario
          solo descarga el CSR y se lo manda al contador.
        </HelpCard>

        <HelpCard icon={FileCheck2} title="Certificado .crt">
          El contador entra a ARCA, sube el archivo CSR, genera el certificado
          digital y devuelve un archivo .crt. Ese .crt es lo único que después
          se sube al sistema.
        </HelpCard>

        <HelpCard icon={PlugZap} title="Autorizar WSFE">
          Además de generar el certificado, el contador debe autorizar el
          servicio WSFE / Facturación Electrónica para ese certificado. Si esto
          no se hace, la prueba de conexión puede fallar.
        </HelpCard>

        <HelpCard icon={UploadCloud} title="Qué archivos se manejan">
          El sistema genera el CSR. El contador devuelve el .crt. No se pide
          clave fiscal. No se pide usuario de ARCA. No se sube manualmente una
          .key porque la clave privada ya la generó el sistema.
        </HelpCard>
      </div>

      <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
        <strong>Importante:</strong> nunca pidas ni guardes la clave fiscal de
        ARCA. La configuración correcta se hace con certificado digital, clave
        privada encriptada y token de Web Service.
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Estado actual
          </p>

          <p className="text-sm leading-6 text-zinc-300">
            {currentStep === 1 &&
              "Completá los datos fiscales y generá el pedido CSR."}
            {currentStep === 2 &&
              "Descargá el CSR y mandáselo al contador para generar el certificado en ARCA."}
            {currentStep === 3 &&
              "Subí el certificado .crt que entregó ARCA o el contador."}
            {currentStep === 4 &&
              "La configuración ya está lista. Podés probar conexión y activar ARCA."}
          </p>
        </div>

        <button
          type="button"
          onClick={onCopyMessage}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-400/15"
        >
          <Copy size={17} />
          Copiar mensaje para el contador
        </button>

        <a
          href="https://www.arca.gob.ar/ws/documentacion/wsaa.asp"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.04]"
        >
          <ExternalLink size={17} />
          Documentación ARCA
        </a>
      </div>
    </section>
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

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
          activityStart: data.activityStart
            ? data.activityStart.slice(0, 10)
            : "",
          environment: data.environment || "PRODUCCION",
          defaultPointOfSale: String(
            data.defaultPointOfSale ||
              data.pointsOfSale?.find((point) => point.isDefault)?.number ||
              ""
          ),
          certAlias: data.certAlias || "COMARPOS",
        });
      }
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.response?.data?.error || "No se pudo cargar ARCA.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const validateFiscalData = () => {
    if (!form.businessName.trim()) {
      return "Ingresá la razón social.";
    }

    if (cleanCuit(form.cuit).length !== 11) {
      return "El CUIT debe tener 11 dígitos.";
    }

    if (!form.defaultPointOfSale || Number(form.defaultPointOfSale) <= 0) {
      return "Ingresá un punto de venta válido.";
    }

    return null;
  };

  const handleGenerateCsr = async () => {
    const error = validateFiscalData();

    if (error) {
      setMessage({
        type: "error",
        text: error,
      });
      return;
    }

    try {
      setGenerating(true);
      setMessage(null);

      const next = await arcaConfigService.generateCsr({
        ...form,
        cuit: cleanCuit(form.cuit),
      });

      setConfig(next);

      setMessage({
        type: "success",
        text: "Pedido CSR generado. Descargalo y mandáselo al contador para que lo suba a ARCA.",
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          "No se pudo generar el CSR.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadCsr = async () => {
    if (!config) return;

    try {
      setDownloading(true);
      await arcaConfigService.downloadCsr(config.id);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.response?.data?.error || "No se pudo descargar el CSR.",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleUploadCertificate = async () => {
    if (!config) return;

    if (!certificate) {
      setMessage({
        type: "error",
        text: "Subí el certificado .crt que te devuelve ARCA.",
      });
      return;
    }

    if (!certificate.name.toLowerCase().endsWith(".crt")) {
      setMessage({
        type: "error",
        text: "El archivo debe ser .crt.",
      });
      return;
    }

    try {
      setUploading(true);
      setMessage(null);

      const next = await arcaConfigService.uploadCertificate(
        config.id,
        certificate
      );

      setConfig(next);
      setCertificate(null);

      setMessage({
        type: "success",
        text: "Certificado cargado correctamente. Ahora podés probar conexión.",
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          "No se pudo subir el certificado.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleTest = async () => {
    if (!config) return;

    try {
      setTesting(true);
      setMessage(null);

      const result = await arcaConfigService.test(config.id);

      setMessage({
        type: "success",
        text: result?.message || "Conexión con ARCA correcta.",
      });

      await loadConfig();
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.response?.data?.error ||
          "No se pudo probar la conexión con ARCA.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleActivate = async () => {
    if (!config) return;

    try {
      setActivating(true);
      setMessage(null);

      const next = await arcaConfigService.activate(config.id);
      setConfig(next);

      setMessage({
        type: "success",
        text: "Configuración ARCA activada correctamente.",
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.response?.data?.error ||
          "No se pudo activar la configuración ARCA.",
      });
    } finally {
      setActivating(false);
    }
  };

  const handleCopyAccountantMessage = async () => {
    const accountantMessage = `Hola, necesito configurar la facturación electrónica del sistema.

No necesito compartir usuario ni clave fiscal de ARCA.

El sistema ya generó el archivo CSR. Necesito que por favor:

1. Ingreses a ARCA con clave fiscal.
2. Generes el certificado digital usando el archivo CSR.
3. Autorices el servicio WSFE / Facturación Electrónica para ese certificado.
4. Me devuelvas el archivo certificado .crt.
5. Me confirmes el punto de venta habilitado para facturación electrónica.

Gracias.`;

    try {
      await navigator.clipboard.writeText(accountantMessage);

      setMessage({
        type: "success",
        text: "Mensaje para el contador copiado correctamente.",
      });
    } catch {
      setMessage({
        type: "error",
        text: "No se pudo copiar el mensaje. Copialo manualmente desde la guía.",
      });
    }
  };

  return (
    <AppLayout>
      <main className="min-h-screen bg-[#050b0f] px-4 py-6 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#071318] via-[#0b171c] to-[#071014] p-6 shadow-2xl shadow-black/30">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
                  <ShieldCheck size={16} />
                  Asistente ARCA
                </div>

                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Configuración de facturación electrónica
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                  Este asistente te guía paso a paso para conectar el sistema
                  con ARCA. Primero cargás los datos fiscales, después el
                  sistema genera un archivo CSR para enviar al contador, y
                  finalmente subís el certificado .crt que devuelve ARCA. En
                  ningún momento se pide usuario ni clave fiscal.
                </p>
              </div>

              <button
                onClick={loadConfig}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.04] disabled:opacity-60"
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
                Actualizar
              </button>
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-4">
            <StepBadge
              number={1}
              title="Datos fiscales"
              active={currentStep === 1}
              done={currentStep > 1}
            />
            <StepBadge
              number={2}
              title="Descargar CSR"
              active={currentStep === 2}
              done={currentStep > 2}
            />
            <StepBadge
              number={3}
              title="Subir .crt"
              active={currentStep === 3}
              done={currentStep > 3}
            />
            <StepBadge
              number={4}
              title="Activar"
              active={currentStep === 4}
              done={currentStep === 4}
            />
          </div>

          {message && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                message.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/30 bg-red-500/10 text-red-300"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
            <section className="rounded-3xl border border-white/10 bg-[#0b1115] p-5 shadow-xl shadow-black/20">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                  <FileKey2 size={22} />
                </div>

                <div>
                  <h2 className="text-lg font-semibold">Datos fiscales</h2>
                  <p className="text-sm text-zinc-500">
                    Primer paso para generar el CSR.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block text-sm text-zinc-300">
                    Razón social
                  </label>

                  <input
                    value={form.businessName}
                    onChange={(event) =>
                      setField("businessName", event.target.value)
                    }
                    placeholder="Ej: Grupo VJ SRL"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none transition focus:border-emerald-400/50"
                  />

                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Es el nombre fiscal de la empresa o persona que va a emitir
                    las facturas.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-zinc-300">
                    CUIT
                  </label>

                  <input
                    value={formatCuit(form.cuit)}
                    onChange={(event) => setField("cuit", event.target.value)}
                    placeholder="30-12345678-9"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none transition focus:border-emerald-400/50"
                  />

                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Lo encontrás en la constancia de inscripción de ARCA.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-zinc-300">
                    Condición IVA
                  </label>

                  <select
                    value={form.ivaCondition}
                    onChange={(event) =>
                      setField("ivaCondition", event.target.value)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none transition focus:border-emerald-400/50"
                  >
                    <option
                      className="bg-[#0b1115]"
                      value="RESPONSABLE_INSCRIPTO"
                    >
                      Responsable Inscripto
                    </option>
                    <option className="bg-[#0b1115]" value="MONOTRIBUTO">
                      Monotributo
                    </option>
                    <option className="bg-[#0b1115]" value="EXENTO">
                      Exento
                    </option>
                  </select>

                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    También sale de la constancia de inscripción.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-zinc-300">
                    Domicilio fiscal
                  </label>

                  <input
                    value={form.fiscalAddress}
                    onChange={(event) =>
                      setField("fiscalAddress", event.target.value)
                    }
                    placeholder="Opcional"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none transition focus:border-emerald-400/50"
                  />

                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Campo opcional. Sirve para tener los datos fiscales
                    completos dentro del sistema.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-zinc-300">
                      Ambiente
                    </label>

                    <select
                      value={form.environment}
                      onChange={(event) =>
                        setField(
                          "environment",
                          event.target.value as ArcaEnvironment
                        )
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none transition focus:border-emerald-400/50"
                    >
                      <option className="bg-[#0b1115]" value="PRODUCCION">
                        Producción
                      </option>
                      <option className="bg-[#0b1115]" value="HOMOLOGACION">
                        Homologación
                      </option>
                    </select>

                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      Producción emite comprobantes reales. Homologación es para
                      pruebas.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-zinc-300">
                      Punto de venta
                    </label>

                    <input
                      type="number"
                      value={form.defaultPointOfSale}
                      onChange={(event) =>
                        setField("defaultPointOfSale", event.target.value)
                      }
                      placeholder="Ej: 7"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none transition focus:border-emerald-400/50"
                    />

                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      Te lo confirma el contador. Debe estar habilitado para
                      facturación electrónica / Web Service.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-zinc-300">
                    Alias certificado
                  </label>

                  <input
                    value={form.certAlias}
                    onChange={(event) =>
                      setField("certAlias", event.target.value)
                    }
                    placeholder="COMARPOS"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none transition focus:border-emerald-400/50"
                  />

                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Es un nombre interno para identificar el certificado. Puede
                    ser el nombre del sistema.
                  </p>
                </div>

                <button
                  onClick={handleGenerateCsr}
                  disabled={generating}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#04100b] transition hover:bg-emerald-300 disabled:opacity-60"
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

            <section className="rounded-3xl border border-white/10 bg-[#0b1115] p-5 shadow-xl shadow-black/20">
              {loading ? (
                <div className="flex min-h-[400px] items-center justify-center text-zinc-400">
                  <Loader2 className="mr-2 animate-spin" size={22} />
                  Cargando configuración...
                </div>
              ) : !config ? (
                <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] text-center">
                  <FileKey2 className="mb-3 text-zinc-500" size={38} />

                  <p className="font-medium text-zinc-300">
                    Todavía no generaste la configuración.
                  </p>

                  <p className="mt-1 max-w-md text-sm text-zinc-500">
                    Completá los datos fiscales y generá el pedido CSR.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${
                          config.isActive
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                            : config.status === "ERROR"
                            ? "border-red-500/30 bg-red-500/15 text-red-300"
                            : "border-zinc-500/30 bg-zinc-500/15 text-zinc-300"
                        }`}
                      >
                        {config.isActive ? (
                          <CheckCircle2 size={14} />
                        ) : config.status === "ERROR" ? (
                          <XCircle size={14} />
                        ) : (
                          <ShieldCheck size={14} />
                        )}

                        {config.isActive ? "Activa" : config.status}
                      </span>

                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
                        {config.environment === "PRODUCCION"
                          ? "Producción"
                          : "Homologación"}
                      </span>
                    </div>

                    <h3 className="text-xl font-semibold">
                      {config.businessName}
                    </h3>

                    <p className="mt-1 text-sm text-zinc-400">
                      CUIT {formatCuit(config.cuit)} · PV{" "}
                      {config.defaultPointOfSale || "sin definir"}
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                        <p className="text-xs text-zinc-500">CSR generado</p>
                        <p className="mt-1 font-medium text-zinc-200">
                          {formatDateTime(config.csrGeneratedAt)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                        <p className="text-xs text-zinc-500">
                          Vence certificado
                        </p>
                        <p className="mt-1 font-medium text-zinc-200">
                          {formatDate(config.certExpiresAt)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                        <p className="text-xs text-zinc-500">Último token</p>
                        <p className="mt-1 font-medium text-zinc-200">
                          {formatDateTime(config.lastTokenAt)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                        <p className="text-xs text-zinc-500">Última prueba</p>
                        <p className="mt-1 font-medium text-zinc-200">
                          {formatDateTime(config.lastCheckAt)}
                        </p>
                      </div>
                    </div>

                    {config.lastError && (
                      <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                        {config.lastError}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                        <Download size={22} />
                      </div>

                      <h4 className="font-semibold">1. Descargar CSR</h4>

                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        Este archivo se sube en ARCA para generar el
                        certificado. Descargalo y mandáselo al contador.
                      </p>

                      <button
                        onClick={handleDownloadCsr}
                        disabled={!config.csrGeneratedAt || downloading}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-50"
                      >
                        {downloading ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <Download size={18} />
                        )}
                        Descargar CSR
                      </button>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
                        <UploadCloud size={22} />
                      </div>

                      <h4 className="font-semibold">
                        2. Subir certificado .crt
                      </h4>

                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        Cuando ARCA o el contador devuelva el certificado,
                        cargalo acá.
                      </p>

                      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-4 text-center transition hover:border-sky-400/40">
                        <UploadCloud className="mb-2 text-sky-300" size={24} />

                        <span className="text-sm">
                          {certificate
                            ? certificate.name
                            : "Seleccionar .crt"}
                        </span>

                        <input
                          type="file"
                          accept=".crt"
                          className="hidden"
                          onChange={(event) =>
                            setCertificate(event.target.files?.[0] || null)
                          }
                        />
                      </label>

                      <button
                        onClick={handleUploadCertificate}
                        disabled={uploading || !certificate}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/25 bg-sky-400/10 px-4 py-3 text-sm font-medium text-sky-300 transition hover:bg-sky-400/15 disabled:opacity-50"
                      >
                        {uploading ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <FileCheck2 size={18} />
                        )}
                        Subir certificado
                      </button>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-300">
                        <PlugZap size={22} />
                      </div>

                      <h4 className="font-semibold">3. Probar y activar</h4>

                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        Valida WSAA, genera token y deja ARCA listo para emitir
                        facturas.
                      </p>

                      <div className="mt-4 flex flex-col gap-3">
                        <button
                          onClick={handleTest}
                          disabled={testing || !config.certExpiresAt}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-400/25 bg-violet-400/10 px-4 py-3 text-sm font-medium text-violet-300 transition hover:bg-violet-400/15 disabled:opacity-50"
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
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-[#04100b] transition hover:bg-emerald-300 disabled:opacity-50"
                        >
                          {activating ? (
                            <Loader2 className="animate-spin" size={18} />
                          ) : (
                            <BadgeCheck size={18} />
                          )}
                          Activar ARCA
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
                    <strong>Mensaje para el contador:</strong> “Te paso el
                    archivo CSR generado por el sistema. Por favor generá el
                    certificado digital en ARCA, autorizá WSFE / Facturación
                    Electrónica y devolveme el archivo .crt. No necesito usuario
                    ni clave fiscal.”
                  </div>
                </div>
              )}
            </section>
          </div>

          <ArcaUserGuide
            currentStep={currentStep}
            onCopyMessage={handleCopyAccountantMessage}
          />
        </div>
      </main>
    </AppLayout>
  );
}