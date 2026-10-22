"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arcaConfigController = void 0;
const arcaConfig_service_1 = require("../services/arcaConfig.service");
const wsaa_service_1 = require("../afip/wsaa.service");
const params_1 = require("../utils/params");
function getFiles(req) {
    return req.files;
}
function fileText(file) {
    return file?.buffer?.toString("utf8");
}
function pickCertificateFiles(req) {
    const files = getFiles(req);
    const certFile = files?.cert?.[0] || files?.certificate?.[0] || files?.certPem?.[0];
    const keyFile = files?.key?.[0] || files?.privateKey?.[0] || files?.keyPem?.[0];
    return {
        certPem: fileText(certFile) || req.body.certPem || req.body.certificate,
        keyPem: fileText(keyFile) || req.body.keyPem || req.body.privateKey,
    };
}
function pickOnlyCertificate(req) {
    const files = getFiles(req);
    const certFile = files?.cert?.[0] || files?.certificate?.[0] || files?.certPem?.[0];
    return fileText(certFile) || req.body.certPem || req.body.certificate;
}
exports.arcaConfigController = {
    async list(_req, res, next) {
        try {
            const configs = await arcaConfig_service_1.arcaConfigService.list();
            res.json({ ok: true, content: configs });
        }
        catch (error) {
            next(error);
        }
    },
    async get(_req, res, next) {
        try {
            const config = await arcaConfig_service_1.arcaConfigService.getConfig();
            res.json({ ok: true, content: config });
        }
        catch (error) {
            next(error);
        }
    },
    async upsert(req, res, next) {
        try {
            const config = await arcaConfig_service_1.arcaConfigService.upsertConfig(req.body);
            res.json({ ok: true, content: config });
        }
        catch (error) {
            next(error);
        }
    },
    async generateCsr(req, res, next) {
        try {
            const config = await arcaConfig_service_1.arcaConfigService.generateCsr(req.body);
            res.status(201).json({
                ok: true,
                content: config,
                message: "CSR generado correctamente. Descargalo y subilo en ARCA para obtener el certificado .crt.",
            });
        }
        catch (error) {
            next(error);
        }
    },
    async downloadCsr(req, res, next) {
        try {
            const id = req.params.id ? (0, params_1.getParamAsString)(req.params.id, "id") : undefined;
            const csr = await arcaConfig_service_1.arcaConfigService.downloadCsr(id);
            res.setHeader("Content-Type", "application/pkcs10");
            res.setHeader("Content-Disposition", `attachment; filename="${csr.filename}"`);
            res.send(csr.content);
        }
        catch (error) {
            next(error);
        }
    },
    async create(req, res, next) {
        try {
            const { certPem, keyPem } = pickCertificateFiles(req);
            const config = await arcaConfig_service_1.arcaConfigService.create({
                ...req.body,
                pointOfSale: req.body.pointOfSale,
                certPem,
                keyPem,
            });
            res.status(201).json({ ok: true, content: config });
        }
        catch (error) {
            next(error);
        }
    },
    async uploadCertificate(req, res, next) {
        try {
            const certPem = pickOnlyCertificate(req);
            if (!certPem) {
                return res.status(400).json({
                    ok: false,
                    error: "Tenés que subir el certificado .crt que devuelve ARCA.",
                });
            }
            const config = await arcaConfig_service_1.arcaConfigService.uploadCertificate({
                certPem,
                certExpiresAt: req.body.certExpiresAt,
            });
            res.json({ ok: true, content: config });
        }
        catch (error) {
            next(error);
        }
    },
    async uploadCertificates(req, res, next) {
        try {
            const { certPem, keyPem } = pickCertificateFiles(req);
            if (!certPem) {
                return res.status(400).json({
                    ok: false,
                    error: "Tenés que subir el certificado .crt.",
                });
            }
            const config = await arcaConfig_service_1.arcaConfigService.uploadCertificates({
                certPem,
                keyPem,
                certExpiresAt: req.body.certExpiresAt,
            });
            res.json({ ok: true, content: config });
        }
        catch (error) {
            next(error);
        }
    },
    async deleteCertificates(_req, res, next) {
        try {
            const config = await arcaConfig_service_1.arcaConfigService.deleteCertificates();
            res.json({ ok: true, content: config });
        }
        catch (error) {
            next(error);
        }
    },
    async activate(req, res, next) {
        try {
            const id = req.params.id ? (0, params_1.getParamAsString)(req.params.id, "id") : undefined;
            const result = await arcaConfig_service_1.arcaConfigService.activate(id);
            res.json({ ok: true, content: result });
        }
        catch (error) {
            next(error);
        }
    },
    async test(req, res) {
        try {
            const id = req.params.id
                ? (0, params_1.getParamAsString)(req.params.id, "id")
                : undefined;
            console.log("🧪 Probando conexión ARCA...");
            console.log("🆔 Config ID:", id);
            if (!id) {
                return res.status(400).json({
                    ok: false,
                    error: "Falta el ID de configuración ARCA.",
                });
            }
            const activatedConfig = await arcaConfig_service_1.arcaConfigService.activate(id);
            console.log("✅ Configuración activada antes del test:", {
                id,
                activatedConfig,
            });
            const token = await (0, wsaa_service_1.generarTokenAFIP)();
            console.log("✅ Token ARCA generado correctamente:", {
                expiration: token.expiration,
            });
            return res.json({
                ok: true,
                message: "Conexión con ARCA correcta. Token generado.",
                expiration: token.expiration,
            });
        }
        catch (error) {
            console.error("❌ Error probando conexión ARCA");
            console.error("MESSAGE:", error?.message);
            console.error("CODE:", error?.code);
            console.error("STATUS:", error?.response?.status);
            console.error("DATA:", error?.response?.data);
            console.error("STACK:", error?.stack);
            return res.status(500).json({
                ok: false,
                error: error?.message || "Error probando conexión con ARCA.",
                detail: error?.response?.data || null,
                code: error?.code || null,
                status: error?.response?.status || null,
            });
        }
    },
    async testWsaa(_req, res) {
        try {
            const token = await (0, wsaa_service_1.generarTokenAFIP)();
            res.json({
                ok: true,
                message: "WSAA correcto. Token/sign generados.",
                expiration: token.expiration,
            });
        }
        catch (error) {
            res.status(500).json({ ok: false, error: error.message });
        }
    },
    async testWsfeDummy(_req, res) {
        try {
            const token = await (0, wsaa_service_1.generarTokenAFIP)();
            res.json({
                ok: true,
                message: "Configuración activa y WSAA correctos. Listo para probar WSFE.",
                expiration: token.expiration,
            });
        }
        catch (error) {
            res.status(500).json({ ok: false, error: error.message });
        }
    },
    async remove(req, res, next) {
        try {
            await arcaConfig_service_1.arcaConfigService.remove((0, params_1.getParamAsString)(req.params.id, "id"));
            res.json({ ok: true, message: "Configuración ARCA eliminada." });
        }
        catch (error) {
            next(error);
        }
    },
    async listPointsOfSale(_req, res, next) {
        try {
            const points = await arcaConfig_service_1.arcaConfigService.listPointsOfSale();
            res.json({ ok: true, content: points });
        }
        catch (error) {
            next(error);
        }
    },
    async upsertPointOfSale(req, res, next) {
        try {
            const point = await arcaConfig_service_1.arcaConfigService.upsertPointOfSale(req.body);
            res.json({ ok: true, content: point });
        }
        catch (error) {
            next(error);
        }
    },
    async deletePointOfSale(req, res, next) {
        try {
            const point = await arcaConfig_service_1.arcaConfigService.deletePointOfSale((0, params_1.getParamAsString)(req.params.id, "id"));
            res.json({ ok: true, content: point });
        }
        catch (error) {
            next(error);
        }
    },
    async listRemitoCais(_req, res, next) {
        try {
            const remitos = await arcaConfig_service_1.arcaConfigService.listRemitoCais();
            res.json({ ok: true, content: remitos });
        }
        catch (error) {
            next(error);
        }
    },
    async upsertRemitoCai(req, res, next) {
        try {
            const remito = await arcaConfig_service_1.arcaConfigService.upsertRemitoCai(req.body);
            res.json({ ok: true, content: remito });
        }
        catch (error) {
            next(error);
        }
    },
    async deleteRemitoCai(req, res, next) {
        try {
            const remito = await arcaConfig_service_1.arcaConfigService.deleteRemitoCai((0, params_1.getParamAsString)(req.params.id, "id"));
            res.json({ ok: true, content: remito });
        }
        catch (error) {
            next(error);
        }
    },
    async listAuditLogs(_req, res, next) {
        try {
            const logs = await arcaConfig_service_1.arcaConfigService.listAuditLogs();
            res.json({ ok: true, content: logs });
        }
        catch (error) {
            next(error);
        }
    },
};
//# sourceMappingURL=arcaConfig.controller.js.map