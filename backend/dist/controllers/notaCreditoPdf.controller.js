"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notaCreditoPdfController = void 0;
const fs_1 = __importDefault(require("fs"));
const notaCreditoPdf_service_1 = require("../services/notaCreditoPdf.service");
exports.notaCreditoPdfController = {
    async descargar(req, res, next) {
        try {
            const { saleId } = req.params;
            if (!saleId) {
                return res.status(400).json({
                    ok: false,
                    error: "saleId es requerido",
                });
            }
            if (Array.isArray(saleId)) {
                return res.status(400).json({
                    ok: false,
                    error: "saleId no puede ser un arreglo",
                });
            }
            const { filePath, fileName } = await (0, notaCreditoPdf_service_1.obtenerNotaCreditoPDFPathService)(saleId);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
            const stream = fs_1.default.createReadStream(filePath);
            stream.pipe(res);
            stream.on("close", () => {
                if (fs_1.default.existsSync(filePath)) {
                    fs_1.default.unlinkSync(filePath);
                }
            });
        }
        catch (err) {
            next(err);
        }
    },
};
//# sourceMappingURL=notaCreditoPdf.controller.js.map