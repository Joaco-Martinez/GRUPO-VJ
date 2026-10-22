"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.arcaConfigService = void 0;
const node_forge_1 = __importDefault(require("node-forge"));
const prisma_1 = __importDefault(require("../prisma"));
const arcaCrypto_service_1 = require("./arcaCrypto.service");
function normalizeCuit(cuit) {
    return String(cuit || "").replace(/\D/g, "");
}
function toNullableDate(value) {
    if (!value)
        return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
function toNullableNumber(value) {
    if (value === undefined || value === null || value === "")
        return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
function cleanObject(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}
function decryptRequired(value, fieldName) {
    if (!value)
        throw new Error(`Falta configurar ${fieldName} en ARCA.`);
    return arcaCrypto_service_1.arcaCryptoService.decrypt(value);
}
function parseEnabledCbteTypes(value) {
    if (Array.isArray(value)) {
        return value.map(Number).filter((n) => Number.isFinite(n));
    }
    if (typeof value === "string" && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map(Number).filter((n) => Number.isFinite(n));
            }
        }
        catch {
            return value
                .split(",")
                .map((x) => Number(x.trim()))
                .filter((n) => Number.isFinite(n));
        }
    }
    return [];
}
function assertValidCuit(cuit) {
    if (!/^\d{11}$/.test(cuit)) {
        throw new Error("El CUIT debe tener 11 dígitos, sin guiones.");
    }
}
function getCertExpiration(certPem) {
    try {
        const cert = node_forge_1.default.pki.certificateFromPem(certPem);
        return cert.validity.notAfter;
    }
    catch {
        throw new Error("El certificado .crt no es válido.");
    }
}
function validatePrivateKey(keyPem) {
    try {
        node_forge_1.default.pki.privateKeyFromPem(keyPem);
    }
    catch {
        throw new Error("La clave privada .key no es válida.");
    }
}
function buildCsrSubject(params) {
    return [
        { name: "countryName", value: "AR" },
        { name: "organizationName", value: params.businessName },
        { name: "commonName", value: params.certAlias || "COMARPOS" },
        { name: "serialNumber", value: `CUIT ${params.cuit}` },
    ];
}
async function getLatestConfig() {
    return prisma_1.default.arcaConfig.findFirst({
        include: {
            pointsOfSale: true,
            tokens: true,
            remitoCais: true,
        },
        orderBy: { createdAt: "desc" },
    });
}
exports.arcaConfigService = {
    async list() {
        return prisma_1.default.arcaConfig.findMany({
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
        const config = await prisma_1.default.arcaConfig.findFirst({
            where: { isActive: true },
            include: { pointsOfSale: true },
            orderBy: { createdAt: "desc" },
        });
        if (!config)
            throw new Error("No hay configuración ARCA activa.");
        return config;
    },
    async getActiveDecrypted() {
        const config = await prisma_1.default.arcaConfig.findFirst({
            where: { isActive: true },
            include: { pointsOfSale: true },
            orderBy: { createdAt: "desc" },
        });
        if (!config)
            throw new Error("No hay configuración ARCA activa.");
        return {
            ...config,
            certPem: decryptRequired(config.certEncrypted, "el certificado"),
            keyPem: decryptRequired(config.keyEncrypted, "la private key"),
        };
    },
    async create(data) {
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
    async upsertConfig(data) {
        const existing = await prisma_1.default.arcaConfig.findFirst({ orderBy: { createdAt: "desc" } });
        const cuit = data.cuit ? normalizeCuit(data.cuit) : undefined;
        const activityStartValue = data.activityStart ?? data.activityStartDate;
        const defaultPointOfSale = toNullableNumber(data.defaultPointOfSale ?? data.pointOfSale);
        const defaultConcept = toNullableNumber(data.defaultConcept);
        if (cuit !== undefined && cuit !== "")
            assertValidCuit(cuit);
        const payload = cleanObject({
            businessName: data.businessName,
            cuit,
            ivaCondition: data.ivaCondition ?? undefined,
            fiscalAddress: data.fiscalAddress ?? undefined,
            iibb: data.iibb ?? undefined,
            activityStart: activityStartValue !== undefined ? toNullableDate(activityStartValue) : undefined,
            environment: data.environment,
            defaultPointOfSale: defaultPointOfSale ?? undefined,
            defaultCurrencyId: data.defaultCurrencyId ?? undefined,
            defaultConcept: defaultConcept ?? undefined,
            status: data.status ?? "INACTIVE",
        });
        let config;
        if (existing) {
            config = await prisma_1.default.arcaConfig.update({
                where: { id: existing.id },
                data: payload,
                include: { pointsOfSale: true, tokens: true, remitoCais: true },
            });
        }
        else {
            config = await prisma_1.default.arcaConfig.create({
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
        return prisma_1.default.arcaConfig.findUnique({
            where: { id: config.id },
            include: { pointsOfSale: true, tokens: true, remitoCais: true },
        });
    },
    async generateCsr(data) {
        const cuit = normalizeCuit(data.cuit);
        assertValidCuit(cuit);
        if (!data.businessName?.trim()) {
            throw new Error("La razón social es obligatoria para generar el CSR.");
        }
        const point = toNullableNumber(data.defaultPointOfSale ?? data.pointOfSale);
        if (!point || point <= 0) {
            throw new Error("El punto de venta es obligatorio para configurar ARCA.");
        }
        const config = await this.upsertConfig({
            ...data,
            cuit,
            defaultPointOfSale: point,
            status: "INCOMPLETE",
        });
        if (!config) {
            throw new Error("No se pudo crear la configuración ARCA.");
        }
        const keyPair = node_forge_1.default.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
        const csr = node_forge_1.default.pki.createCertificationRequest();
        csr.publicKey = keyPair.publicKey;
        csr.setSubject(buildCsrSubject({
            businessName: data.businessName.trim(),
            cuit,
            certAlias: data.certAlias || "COMARPOS",
        }));
        csr.sign(keyPair.privateKey, node_forge_1.default.md.sha256.create());
        if (!csr.verify()) {
            throw new Error("No se pudo generar correctamente el pedido CSR.");
        }
        const privateKeyPem = node_forge_1.default.pki.privateKeyToPem(keyPair.privateKey);
        const csrPem = node_forge_1.default.pki.certificationRequestToPem(csr);
        await prisma_1.default.afipToken.deleteMany({ where: { arcaConfigId: config.id } });
        return prisma_1.default.arcaConfig.update({
            where: { id: config.id },
            data: {
                keyEncrypted: arcaCrypto_service_1.arcaCryptoService.encrypt(privateKeyPem),
                csrEncrypted: arcaCrypto_service_1.arcaCryptoService.encrypt(csrPem),
                csrGeneratedAt: new Date(),
                certEncrypted: null,
                certExpiresAt: null,
                certAlias: data.certAlias || "COMARPOS",
                status: "INCOMPLETE",
                isActive: false,
                lastError: null,
                lastTokenAt: null,
                lastCheckAt: null,
                lastSuccessAt: null,
            },
            include: { pointsOfSale: true, tokens: true, remitoCais: true },
        });
    },
    async downloadCsr(configId) {
        const config = configId
            ? await prisma_1.default.arcaConfig.findUnique({ where: { id: configId } })
            : await prisma_1.default.arcaConfig.findFirst({ orderBy: { createdAt: "desc" } });
        if (!config)
            throw new Error("No hay configuración ARCA creada.");
        if (!config.csrEncrypted) {
            throw new Error("Todavía no se generó el pedido CSR.");
        }
        return {
            filename: `pedido-arca-${config.cuit || "sin-cuit"}.csr`,
            content: arcaCrypto_service_1.arcaCryptoService.decrypt(config.csrEncrypted),
        };
    },
    async uploadCertificate(params) {
        const config = await this.getConfig();
        if (!config)
            throw new Error("Primero tenés que crear la configuración ARCA.");
        if (!config.keyEncrypted) {
            throw new Error("Primero generá el pedido CSR desde el sistema.");
        }
        const certExpiresAt = params.certExpiresAt
            ? toNullableDate(params.certExpiresAt)
            : getCertExpiration(params.certPem);
        await prisma_1.default.afipToken.deleteMany({ where: { arcaConfigId: config.id } });
        return prisma_1.default.arcaConfig.update({
            where: { id: config.id },
            data: {
                certEncrypted: arcaCrypto_service_1.arcaCryptoService.encrypt(params.certPem),
                certExpiresAt,
                status: "INCOMPLETE",
                isActive: false,
                lastError: null,
                lastTokenAt: null,
            },
            include: { pointsOfSale: true, tokens: true, remitoCais: true },
        });
    },
    async uploadCertificates(params) {
        const config = await this.getConfig();
        if (!config)
            throw new Error("Primero tenés que crear la configuración ARCA.");
        const certExpiresAt = params.certExpiresAt
            ? toNullableDate(params.certExpiresAt)
            : getCertExpiration(params.certPem);
        const data = {
            certEncrypted: arcaCrypto_service_1.arcaCryptoService.encrypt(params.certPem),
            certExpiresAt,
            status: "INCOMPLETE",
            isActive: false,
            lastError: null,
            lastTokenAt: null,
        };
        if (params.keyPem) {
            validatePrivateKey(params.keyPem);
            data.keyEncrypted = arcaCrypto_service_1.arcaCryptoService.encrypt(params.keyPem);
        }
        else if (!config.keyEncrypted) {
            throw new Error("Falta la private key. Usá primero 'Generar CSR' o subí la .key.");
        }
        await prisma_1.default.afipToken.deleteMany({ where: { arcaConfigId: config.id } });
        return prisma_1.default.arcaConfig.update({
            where: { id: config.id },
            data,
            include: { pointsOfSale: true, tokens: true, remitoCais: true },
        });
    },
    async deleteCertificates() {
        const config = await this.getConfig();
        if (!config)
            throw new Error("No hay configuración ARCA creada.");
        await prisma_1.default.afipToken.deleteMany({ where: { arcaConfigId: config.id } });
        return prisma_1.default.arcaConfig.update({
            where: { id: config.id },
            data: {
                certEncrypted: null,
                keyEncrypted: null,
                csrEncrypted: null,
                csrGeneratedAt: null,
                certExpiresAt: null,
                lastTokenAt: null,
                status: "INCOMPLETE",
                isActive: false,
            },
            include: { pointsOfSale: true, tokens: true, remitoCais: true },
        });
    },
    async activate(configId) {
        const config = configId
            ? await prisma_1.default.arcaConfig.findUnique({ where: { id: configId } })
            : await prisma_1.default.arcaConfig.findFirst({ orderBy: { createdAt: "desc" } });
        if (!config)
            throw new Error("No hay configuración ARCA para activar.");
        if (!config.cuit)
            throw new Error("Falta configurar el CUIT.");
        if (!config.certEncrypted)
            throw new Error("Falta cargar el certificado .crt que devuelve ARCA.");
        if (!config.keyEncrypted)
            throw new Error("Falta la private key. Generá el CSR desde el sistema.");
        const pointsCount = await prisma_1.default.arcaPointOfSale.count({
            where: { arcaConfigId: config.id, enabled: true },
        });
        if (pointsCount === 0)
            throw new Error("Falta configurar al menos un punto de venta.");
        await prisma_1.default.arcaConfig.updateMany({ data: { isActive: false } });
        return prisma_1.default.arcaConfig.update({
            where: { id: config.id },
            data: { isActive: true, status: "ACTIVE", lastError: null },
            include: { pointsOfSale: true, tokens: true, remitoCais: true },
        });
    },
    async remove(id) {
        const config = await prisma_1.default.arcaConfig.findUnique({ where: { id } });
        if (!config)
            throw new Error("Configuración ARCA no encontrada.");
        await prisma_1.default.afipToken.deleteMany({ where: { arcaConfigId: id } });
        await prisma_1.default.arcaPointOfSale.deleteMany({ where: { arcaConfigId: id } });
        await prisma_1.default.remitoCaiConfig.deleteMany({ where: { arcaConfigId: id } });
        await prisma_1.default.arcaAuditLog.deleteMany({ where: { arcaConfigId: id } });
        await prisma_1.default.arcaConfig.delete({ where: { id } });
        return { ok: true };
    },
    async listPointsOfSale() {
        const config = await this.getConfig();
        if (!config)
            return [];
        return prisma_1.default.arcaPointOfSale.findMany({
            where: { arcaConfigId: config.id },
            orderBy: [{ isDefault: "desc" }, { number: "asc" }],
        });
    },
    async upsertPointOfSale(data) {
        const config = await this.getConfig();
        if (!config)
            throw new Error("Primero tenés que crear la configuración ARCA.");
        const number = toNullableNumber(data.number ?? data.pointOfSale);
        if (!number || number <= 0)
            throw new Error("El punto de venta debe ser un número válido.");
        const isDefault = data.isDefault ?? true;
        if (isDefault) {
            await prisma_1.default.arcaPointOfSale.updateMany({
                where: { arcaConfigId: config.id },
                data: { isDefault: false },
            });
            await prisma_1.default.arcaConfig.update({
                where: { id: config.id },
                data: { defaultPointOfSale: number },
            });
        }
        return prisma_1.default.arcaPointOfSale.upsert({
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
                enabledCbteTypes: data.enabledCbteTypes !== undefined
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
    async deletePointOfSale(id) {
        return prisma_1.default.arcaPointOfSale.delete({ where: { id } });
    },
    async listRemitoCais() {
        const config = await this.getConfig();
        if (!config)
            return [];
        return prisma_1.default.remitoCaiConfig.findMany({
            where: { arcaConfigId: config.id },
            orderBy: [{ enabled: "desc" }, { expiresAt: "asc" }],
        });
    },
    async upsertRemitoCai(data) {
        const config = await this.getConfig();
        if (!config)
            throw new Error("Primero tenés que crear la configuración ARCA.");
        const pointOfSale = toNullableNumber(data.pointOfSale);
        if (!pointOfSale)
            throw new Error("El punto de venta de remito es obligatorio.");
        if (!data.cai)
            throw new Error("El CAI es obligatorio.");
        if (!data.expiresAt)
            throw new Error("El vencimiento del CAI es obligatorio.");
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
            return prisma_1.default.remitoCaiConfig.update({
                where: { id: data.id },
                data: payload,
            });
        }
        return prisma_1.default.remitoCaiConfig.create({ data: payload });
    },
    async deleteRemitoCai(id) {
        return prisma_1.default.remitoCaiConfig.delete({ where: { id } });
    },
    async listAuditLogs() {
        const config = await this.getConfig();
        return prisma_1.default.arcaAuditLog.findMany({
            where: config ? { arcaConfigId: config.id } : undefined,
            orderBy: { createdAt: "desc" },
            take: 100,
        });
    },
    async audit(action, configId, userId, detail, ip) {
        return prisma_1.default.arcaAuditLog.create({
            data: {
                action,
                arcaConfigId: configId || null,
                userId: userId || null,
                detail: detail || null,
                ip: ip || null,
            },
        });
    },
    async markError(configId, message) {
        return prisma_1.default.arcaConfig.update({
            where: { id: configId },
            data: { status: "ERROR", lastError: message, lastCheckAt: new Date() },
        });
    },
    async markChecked(configId) {
        return prisma_1.default.arcaConfig.update({
            where: { id: configId },
            data: { lastCheckAt: new Date(), lastSuccessAt: new Date(), lastError: null },
        });
    },
};
//# sourceMappingURL=arcaConfig.service.js.map