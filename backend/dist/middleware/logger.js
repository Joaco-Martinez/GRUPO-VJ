"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = requestLogger;
exports.errorLogger = errorLogger;
function requestLogger(req, res, next) {
    const start = Date.now();
    res.on("finish", () => {
        const now = new Date().toISOString();
        const duration = Date.now() - start;
        console.log(`[${now}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`);
    });
    next();
}
function errorLogger(err, req, res, next) {
    const now = new Date().toISOString();
    const statusCode = err.status || 500;
    console.error(`[${now}] ❌ Error en ${req.method} ${req.originalUrl}`);
    console.error(`Código: ${statusCode}`);
    console.error("Detalles:", err);
    res.status(statusCode).json({
        ok: false,
        status: statusCode,
        message: err.message || "Error interno del servidor",
    });
}
//# sourceMappingURL=logger.js.map