"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptText = encryptText;
exports.decryptText = decryptText;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = "aes-256-gcm";
function getKey() {
    const secret = process.env.ARCA_CONFIG_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error("ARCA_CONFIG_SECRET debe tener al menos 32 caracteres.");
    }
    return crypto_1.default.createHash("sha256").update(secret).digest();
}
function encryptText(value) {
    const iv = crypto_1.default.randomBytes(12);
    const key = getKey();
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [
        iv.toString("base64"),
        authTag.toString("base64"),
        encrypted.toString("base64"),
    ].join(".");
}
function decryptText(value) {
    const [ivBase64, authTagBase64, encryptedBase64] = value.split(".");
    if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
        throw new Error("Formato de texto encriptado inválido.");
    }
    const key = getKey();
    const iv = Buffer.from(ivBase64, "base64");
    const authTag = Buffer.from(authTagBase64, "base64");
    const encrypted = Buffer.from(encryptedBase64, "base64");
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
}
//# sourceMappingURL=crypto.js.map