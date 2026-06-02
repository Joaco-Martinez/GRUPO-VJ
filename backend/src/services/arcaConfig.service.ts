import prisma from "../prisma";
import { arcaCryptoService } from "./arcaCrypto.service";

type ArcaEnvironment = "HOMOLOGACION" | "PRODUCCION";
type RemitoMode = "DIGITAL_FULL" | "PREPRINTED_FORM";

type UpdateArcaConfigInput = {
  businessName?: string;
  cuit?: string;
  ivaCondition?: string | null;
  fiscalAddress?: string | null;
  iibb?: string | null;
  activityStart?: string | Date | null;
  activityStartDate?: string | Date | null;
  environment?: ArcaEnvironment;
  status?: "ACTIVE" | "INACTIVE" | "ERROR" | "INCOMPLETE" | "CERT_EXPIRED";
  pointOfSale?: number | string | null;
  defaultPointOfSale?: number | string | null;
  defaultCurrencyId?: string | null;
  defaultConcept?: number | string | null;
  certPem?: string | null;
  keyPem?: string | null;
  certExpiresAt?: string | Date | null;
};

type PointOfSaleInput = {
  id?: string;
  number?: number | string;
  pointOfSale?: number | string;
  description?: string | null;
  enabled?: boolean;
  isDefault?: boolean;
  enabledCbteTypes?: number[] | string | null;
};

type RemitoCaiInput = {
  id?: string;
  mode?: RemitoMode;
  pointOfSale?: number | string;
  cai?: string;
  expiresAt?: string | Date;
  rangeFrom?: number | string | null;
  rangeTo?: number | string | null;
  nextNumber?: number | string | null;
  enabled?: boolean;
};

function normalizeCuit(cuit?: string | null) {
  return String(cuit || "").replace(/\D/g, "");
}

function toNullableDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNullableNumber(value?: number | string | null) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanObject<T extends Record<string, any>>(obj: T) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function decryptRequired(value: string | null, fieldName: string) {
  if (!value) throw new Error(`Falta configurar ${fieldName} en ARCA.`);
  return arcaCryptoService.decrypt(value);
}

function parseEnabledCbteTypes(value: PointOfSaleInput["enabledCbteTypes"]) {
  if (Array.isArray(value)) {
    return value.map(Number).filter((n) => Number.isFinite(n));
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(Number).filter((n) => Number.isFinite(n));
      }
    } catch {
      return value
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n));
    }
  }

  return [];
}

async function getLatestConfig() {
  return prisma.arcaConfig.findFirst({
    include: {
      pointsOfSale: true,
      tokens: true,
      remitoCais: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export const arcaConfigService = {
  async list() {
    return prisma.arcaConfig.findMany({
      include: {
        pointsOfSale: true,
        tokens: true,
        remitoCais: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getConfig() {
    return getLatestConfig();
  },

  async getActive() {
    const config = await prisma.arcaConfig.findFirst({
      where: { isActive: true },
      include: { pointsOfSale: true },
      orderBy: { createdAt: "desc" },
    });

    if (!config) throw new Error("No hay configuración ARCA activa.");
    return config;
  },

  async getActiveDecrypted() {
    const config = await prisma.arcaConfig.findFirst({
      where: { isActive: true },
      include: { pointsOfSale: true },
      orderBy: { createdAt: "desc" },
    });

    if (!config) throw new Error("No hay configuración ARCA activa.");

    return {
      ...config,
      certPem: decryptRequired(config.certEncrypted, "el certificado"),
      keyPem: decryptRequired(config.keyEncrypted, "la private key"),
    };
  },

  async create(data: UpdateArcaConfigInput) {
    const config = await this.upsertConfig(data);

    if (data.certPem && data.keyPem) {
      return this.uploadCertificates({
        certPem: data.certPem,
        keyPem: data.keyPem,
        certExpiresAt: data.certExpiresAt,
      });
    }

    return config;
  },

  async upsertConfig(data: UpdateArcaConfigInput) {
    const existing = await prisma.arcaConfig.findFirst({ orderBy: { createdAt: "desc" } });

    const cuit = data.cuit ? normalizeCuit(data.cuit) : undefined;
    const activityStartValue = data.activityStart ?? data.activityStartDate;
    const defaultPointOfSale = toNullableNumber(data.defaultPointOfSale ?? data.pointOfSale);
    const defaultConcept = toNullableNumber(data.defaultConcept);

    const payload = cleanObject({
      businessName: data.businessName,
      cuit,
      ivaCondition: data.ivaCondition ?? undefined,
      fiscalAddress: data.fiscalAddress ?? undefined,
      iibb: data.iibb ?? undefined,
      activityStart:
        activityStartValue !== undefined ? toNullableDate(activityStartValue) : undefined,
      environment: data.environment,
      defaultPointOfSale: defaultPointOfSale ?? undefined,
      defaultCurrencyId: data.defaultCurrencyId ?? undefined,
      defaultConcept: defaultConcept ?? undefined,
      status: data.status ?? "INACTIVE",
    });

    let config;

    if (existing) {
      config = await prisma.arcaConfig.update({
        where: { id: existing.id },
        data: payload,
        include: { pointsOfSale: true, tokens: true, remitoCais: true },
      });
    } else {
      config = await prisma.arcaConfig.create({
        data: {
          scope: "GRUPO_VJ",
          businessName: data.businessName || "Grupo VJ",
          cuit: cuit || "",
          ivaCondition: data.ivaCondition || null,
          fiscalAddress: data.fiscalAddress || null,
          iibb: data.iibb || null,
          activityStart: toNullableDate(activityStartValue),
          environment: data.environment || "HOMOLOGACION",
          defaultPointOfSale,
          defaultCurrencyId: data.defaultCurrencyId || "PES",
          defaultConcept: defaultConcept || 1,
          status: data.status || "INACTIVE",
          isActive: false,
        },
        include: { pointsOfSale: true, tokens: true, remitoCais: true },
      });
    }

    if (defaultPointOfSale && defaultPointOfSale > 0) {
      await this.upsertPointOfSale({
        number: defaultPointOfSale,
        description: "Punto de venta principal",
        enabled: true,
        isDefault: true,
      });
    }

    return prisma.arcaConfig.findUnique({
      where: { id: config.id },
      include: { pointsOfSale: true, tokens: true, remitoCais: true },
    });
  },

  async uploadCertificates(params: {
    certPem: string;
    keyPem: string;
    certExpiresAt?: string | Date | null;
  }) {
    const config = await this.getConfig();
    if (!config) throw new Error("Primero tenés que crear la configuración ARCA.");

    return prisma.arcaConfig.update({
      where: { id: config.id },
      data: {
        certEncrypted: arcaCryptoService.encrypt(params.certPem),
        keyEncrypted: arcaCryptoService.encrypt(params.keyPem),
        certExpiresAt: toNullableDate(params.certExpiresAt),
        status: "INCOMPLETE",
        lastError: null,
      },
      include: { pointsOfSale: true, tokens: true, remitoCais: true },
    });
  },

  async deleteCertificates() {
    const config = await this.getConfig();
    if (!config) throw new Error("No hay configuración ARCA creada.");

    await prisma.afipToken.deleteMany({ where: { arcaConfigId: config.id } });

    return prisma.arcaConfig.update({
      where: { id: config.id },
      data: {
        certEncrypted: null,
        keyEncrypted: null,
        certExpiresAt: null,
        lastTokenAt: null,
        status: "INCOMPLETE",
        isActive: false,
      },
      include: { pointsOfSale: true, tokens: true, remitoCais: true },
    });
  },

  async activate(configId?: string) {
    const config = configId
      ? await prisma.arcaConfig.findUnique({ where: { id: configId } })
      : await prisma.arcaConfig.findFirst({ orderBy: { createdAt: "desc" } });

    if (!config) throw new Error("No hay configuración ARCA para activar.");
    if (!config.cuit) throw new Error("Falta configurar el CUIT.");
    if (!config.certEncrypted) throw new Error("Falta cargar el certificado.");
    if (!config.keyEncrypted) throw new Error("Falta cargar la private key.");

    const pointsCount = await prisma.arcaPointOfSale.count({
      where: { arcaConfigId: config.id, enabled: true },
    });

    if (pointsCount === 0) throw new Error("Falta configurar al menos un punto de venta.");

    await prisma.arcaConfig.updateMany({ data: { isActive: false } });

    return prisma.arcaConfig.update({
      where: { id: config.id },
      data: { isActive: true, status: "ACTIVE", lastError: null },
      include: { pointsOfSale: true, tokens: true, remitoCais: true },
    });
  },

  async remove(id: string) {
    const config = await prisma.arcaConfig.findUnique({ where: { id } });
    if (!config) throw new Error("Configuración ARCA no encontrada.");

    await prisma.afipToken.deleteMany({ where: { arcaConfigId: id } });
    await prisma.arcaPointOfSale.deleteMany({ where: { arcaConfigId: id } });
    await prisma.remitoCaiConfig.deleteMany({ where: { arcaConfigId: id } });
    await prisma.arcaAuditLog.deleteMany({ where: { arcaConfigId: id } });
    await prisma.arcaConfig.delete({ where: { id } });

    return { ok: true };
  },

  async listPointsOfSale() {
    const config = await this.getConfig();
    if (!config) return [];

    return prisma.arcaPointOfSale.findMany({
      where: { arcaConfigId: config.id },
      orderBy: [{ isDefault: "desc" }, { number: "asc" }],
    });
  },

  async upsertPointOfSale(data: PointOfSaleInput) {
    const config = await this.getConfig();
    if (!config) throw new Error("Primero tenés que crear la configuración ARCA.");

    const number = toNullableNumber(data.number ?? data.pointOfSale);
    if (!number || number <= 0) throw new Error("El punto de venta debe ser un número válido.");

    const isDefault = data.isDefault ?? true;

    if (isDefault) {
      await prisma.arcaPointOfSale.updateMany({
        where: { arcaConfigId: config.id },
        data: { isDefault: false },
      });

      await prisma.arcaConfig.update({
        where: { id: config.id },
        data: { defaultPointOfSale: number },
      });
    }

    return prisma.arcaPointOfSale.upsert({
      where: {
        arcaConfigId_number: {
          arcaConfigId: config.id,
          number,
        },
      },
      update: {
        description: data.description ?? undefined,
        enabled: data.enabled ?? undefined,
        isDefault,
        enabledCbteTypes:
          data.enabledCbteTypes !== undefined
            ? parseEnabledCbteTypes(data.enabledCbteTypes)
            : undefined,
      },
      create: {
        arcaConfigId: config.id,
        number,
        description: data.description || "Punto de venta ARCA",
        enabled: data.enabled ?? true,
        isDefault,
        enabledCbteTypes: parseEnabledCbteTypes(data.enabledCbteTypes),
      },
    });
  },

  async deletePointOfSale(id: string) {
    return prisma.arcaPointOfSale.delete({ where: { id } });
  },

  async listRemitoCais() {
    const config = await this.getConfig();
    if (!config) return [];

    return prisma.remitoCaiConfig.findMany({
      where: { arcaConfigId: config.id },
      orderBy: [{ enabled: "desc" }, { expiresAt: "asc" }],
    });
  },

  async upsertRemitoCai(data: RemitoCaiInput) {
    const config = await this.getConfig();
    if (!config) throw new Error("Primero tenés que crear la configuración ARCA.");

    const pointOfSale = toNullableNumber(data.pointOfSale);
    if (!pointOfSale) throw new Error("El punto de venta de remito es obligatorio.");
    if (!data.cai) throw new Error("El CAI es obligatorio.");
    if (!data.expiresAt) throw new Error("El vencimiento del CAI es obligatorio.");

    const payload = {
      arcaConfigId: config.id,
      mode: data.mode || "PREPRINTED_FORM",
      pointOfSale,
      cai: String(data.cai),
      expiresAt: toNullableDate(data.expiresAt) || new Date(),
      rangeFrom: toNullableNumber(data.rangeFrom),
      rangeTo: toNullableNumber(data.rangeTo),
      nextNumber: toNullableNumber(data.nextNumber),
      enabled: data.enabled ?? true,
    };

    if (data.id) {
      return prisma.remitoCaiConfig.update({
        where: { id: data.id },
        data: payload,
      });
    }

    return prisma.remitoCaiConfig.create({ data: payload });
  },

  async deleteRemitoCai(id: string) {
    return prisma.remitoCaiConfig.delete({ where: { id } });
  },

  async listAuditLogs() {
    const config = await this.getConfig();
    return prisma.arcaAuditLog.findMany({
      where: config ? { arcaConfigId: config.id } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  async audit(action: any, configId?: string | null, userId?: string | null, detail?: string, ip?: string) {
    return prisma.arcaAuditLog.create({
      data: {
        action,
        arcaConfigId: configId || null,
        userId: userId || null,
        detail: detail || null,
        ip: ip || null,
      },
    });
  },

  async markError(configId: string, message: string) {
    return prisma.arcaConfig.update({
      where: { id: configId },
      data: { status: "ERROR", lastError: message, lastCheckAt: new Date() },
    });
  },

  async markChecked(configId: string) {
    return prisma.arcaConfig.update({
      where: { id: configId },
      data: { lastCheckAt: new Date(), lastSuccessAt: new Date(), lastError: null },
    });
  },
};
