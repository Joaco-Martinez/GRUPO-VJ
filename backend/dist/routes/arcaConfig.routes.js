"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const arcaConfig_controller_1 = require("../controllers/arcaConfig.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
});
const certificateUpload = upload.fields([
    { name: "cert", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
    { name: "certPem", maxCount: 1 },
    { name: "key", maxCount: 1 },
    { name: "privateKey", maxCount: 1 },
    { name: "keyPem", maxCount: 1 },
]);
router.use(auth_1.authMiddleware);
router.use((0, auth_1.requireAnyRole)(["ADMIN", "CONTADOR"]));
router.get("/", arcaConfig_controller_1.arcaConfigController.get);
router.get("/all", arcaConfig_controller_1.arcaConfigController.list);
router.get("/config", arcaConfig_controller_1.arcaConfigController.get);
router.put("/config", arcaConfig_controller_1.arcaConfigController.upsert);
/**
 * Flujo fácil:
 * 1) POST /arca-config/generate-csr
 * 2) GET  /arca-config/:id/download-csr
 * 3) POST /arca-config/:id/upload-cert
 */
router.post("/generate-csr", arcaConfig_controller_1.arcaConfigController.generateCsr);
router.get("/:id/download-csr", arcaConfig_controller_1.arcaConfigController.downloadCsr);
router.get("/download-csr", arcaConfig_controller_1.arcaConfigController.downloadCsr);
router.post("/:id/upload-cert", certificateUpload, arcaConfig_controller_1.arcaConfigController.uploadCertificate);
router.post("/upload-cert", certificateUpload, arcaConfig_controller_1.arcaConfigController.uploadCertificate);
// Flujo viejo compatible: subir .crt + .key manualmente.
router.post("/", certificateUpload, arcaConfig_controller_1.arcaConfigController.create);
router.post("/certificados", certificateUpload, arcaConfig_controller_1.arcaConfigController.uploadCertificates);
router.post("/certificates", certificateUpload, arcaConfig_controller_1.arcaConfigController.uploadCertificates);
router.delete("/certificados", arcaConfig_controller_1.arcaConfigController.deleteCertificates);
router.delete("/certificates", arcaConfig_controller_1.arcaConfigController.deleteCertificates);
router.patch("/:id/activate", arcaConfig_controller_1.arcaConfigController.activate);
router.patch("/activate", arcaConfig_controller_1.arcaConfigController.activate);
router.post("/:id/test", arcaConfig_controller_1.arcaConfigController.test);
router.post("/test/wsaa", arcaConfig_controller_1.arcaConfigController.testWsaa);
router.post("/test/wsfe-dummy", arcaConfig_controller_1.arcaConfigController.testWsfeDummy);
router.get("/puntos-venta", arcaConfig_controller_1.arcaConfigController.listPointsOfSale);
router.get("/points-of-sale", arcaConfig_controller_1.arcaConfigController.listPointsOfSale);
router.post("/puntos-venta", arcaConfig_controller_1.arcaConfigController.upsertPointOfSale);
router.post("/points-of-sale", arcaConfig_controller_1.arcaConfigController.upsertPointOfSale);
router.delete("/puntos-venta/:id", arcaConfig_controller_1.arcaConfigController.deletePointOfSale);
router.delete("/points-of-sale/:id", arcaConfig_controller_1.arcaConfigController.deletePointOfSale);
router.get("/remitos-cai", arcaConfig_controller_1.arcaConfigController.listRemitoCais);
router.post("/remitos-cai", arcaConfig_controller_1.arcaConfigController.upsertRemitoCai);
router.put("/remitos-cai/:id", arcaConfig_controller_1.arcaConfigController.upsertRemitoCai);
router.delete("/remitos-cai/:id", arcaConfig_controller_1.arcaConfigController.deleteRemitoCai);
router.get("/auditoria", arcaConfig_controller_1.arcaConfigController.listAuditLogs);
router.get("/audit", arcaConfig_controller_1.arcaConfigController.listAuditLogs);
router.delete("/:id", arcaConfig_controller_1.arcaConfigController.remove);
exports.default = router;
//# sourceMappingURL=arcaConfig.routes.js.map