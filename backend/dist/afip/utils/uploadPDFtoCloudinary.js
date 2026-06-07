"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadPDFtoCloudinary = uploadPDFtoCloudinary;
const cloudinary_1 = __importDefault(require("cloudinary"));
const fs_1 = __importDefault(require("fs"));
// 🔧 Configuración de Cloudinary
cloudinary_1.default.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
/**
 * 📤 Sube un PDF generado localmente a Cloudinary y devuelve un link descargable
 * @param filePath Ruta local del archivo (ej: ./factura-0001.pdf)
 * @returns URL segura y directa para abrir o descargar el PDF
 */
async function uploadPDFtoCloudinary(filePath) {
    try {
        const res = await cloudinary_1.default.v2.uploader.upload(filePath, {
            folder: "afip_pdfs",
            resource_type: "auto", // ✅ público y autodetectado
            use_filename: true,
            unique_filename: false,
            access_mode: "public",
        });
        fs_1.default.unlinkSync(filePath);
        console.log("✅ PDF subido y link listo:", res.secure_url);
        return res.secure_url; // 👈 se puede abrir directo
    }
    catch (err) {
        console.error("❌ Error al subir PDF a Cloudinary:", err);
        throw err;
    }
}
//# sourceMappingURL=uploadPDFtoCloudinary.js.map