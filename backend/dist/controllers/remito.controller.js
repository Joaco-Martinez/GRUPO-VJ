"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remitoController = void 0;
const remito_service_1 = require("../services/remito.service");
const params_1 = require("../utils/params");
function getAuthUserId(req) {
    const anyReq = req;
    return anyReq.user?.id || anyReq.userId || undefined;
}
exports.remitoController = {
    async createFromSale(req, res) {
        try {
            const saleId = (0, params_1.getParamAsString)(req.params.saleId, "saleId");
            const remito = await remito_service_1.remitoService.createFromSale({
                saleId,
                userId: getAuthUserId(req),
                placeOfIssue: req.body?.placeOfIssue,
                saleCondition: req.body?.saleCondition,
                transportName: req.body?.transportName,
                transportCuit: req.body?.transportCuit,
                packagesCount: req.body?.packagesCount !== undefined &&
                    req.body?.packagesCount !== null &&
                    req.body?.packagesCount !== ""
                    ? Number(req.body.packagesCount)
                    : undefined,
                declaredValue: req.body?.declaredValue !== undefined &&
                    req.body?.declaredValue !== null &&
                    req.body?.declaredValue !== ""
                    ? Number(req.body.declaredValue)
                    : undefined,
                observations: req.body?.observations,
            });
            return res.status(201).json({
                ok: true,
                message: "Remito generado correctamente",
                content: remito,
            });
        }
        catch (error) {
            console.error("Error createFromSale remito:", error);
            return res.status(400).json({
                ok: false,
                message: error.message || "Error al generar remito",
            });
        }
    },
    async getAll(req, res) {
        try {
            const { status, clientId, saleId, from, to } = req.query;
            const remitos = await remito_service_1.remitoService.getAll({
                status: status ? String(status) : undefined,
                clientId: clientId ? String(clientId) : undefined,
                saleId: saleId ? String(saleId) : undefined,
                from: from ? String(from) : undefined,
                to: to ? String(to) : undefined,
            });
            return res.json({
                ok: true,
                content: remitos,
            });
        }
        catch (error) {
            console.error("Error getAll remitos:", error);
            return res.status(500).json({
                ok: false,
                message: error.message || "Error al obtener remitos",
            });
        }
    },
    async getById(req, res) {
        try {
            const id = (0, params_1.getParamAsString)(req.params.id, "id");
            const remito = await remito_service_1.remitoService.getById(id);
            return res.json({
                ok: true,
                content: remito,
            });
        }
        catch (error) {
            console.error("Error getById remito:", error);
            return res.status(404).json({
                ok: false,
                message: error.message || "Remito no encontrado",
            });
        }
    },
    async regeneratePdf(req, res) {
        try {
            const id = (0, params_1.getParamAsString)(req.params.id, "id");
            const remito = await remito_service_1.remitoService.regeneratePdf(id);
            return res.json({
                ok: true,
                message: "PDF del remito regenerado correctamente",
                content: remito,
            });
        }
        catch (error) {
            console.error("Error regeneratePdf remito:", error);
            return res.status(400).json({
                ok: false,
                message: error.message || "Error al regenerar PDF del remito",
            });
        }
    },
    async markAsDelivered(req, res) {
        try {
            const id = (0, params_1.getParamAsString)(req.params.id, "id");
            const remito = await remito_service_1.remitoService.markAsDelivered(id);
            return res.json({
                ok: true,
                message: "Remito marcado como entregado",
                content: remito,
            });
        }
        catch (error) {
            console.error("Error markAsDelivered remito:", error);
            return res.status(400).json({
                ok: false,
                message: error.message || "Error al marcar remito como entregado",
            });
        }
    },
    async downloadPdf(req, res) {
        try {
            const id = (0, params_1.getParamAsString)(req.params.id, "id");
            const { buffer, filename } = await remito_service_1.remitoService.getPdfBuffer(id);
            res.setHeader("Content-Type", "application/pdf");
            // attachment = descarga
            // inline = abre en navegador
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            res.setHeader("Content-Length", buffer.length);
            return res.send(buffer);
        }
        catch (error) {
            console.error("Error downloadPdf remito:", error);
            return res.status(400).json({
                ok: false,
                message: error.message || "Error al descargar PDF del remito",
            });
        }
    },
    async cancel(req, res) {
        try {
            const id = (0, params_1.getParamAsString)(req.params.id, "id");
            const remito = await remito_service_1.remitoService.cancel(id);
            return res.json({
                ok: true,
                message: "Remito cancelado correctamente",
                content: remito,
            });
        }
        catch (error) {
            console.error("Error cancel remito:", error);
            return res.status(400).json({
                ok: false,
                message: error.message || "Error al cancelar remito",
            });
        }
    },
};
//# sourceMappingURL=remito.controller.js.map