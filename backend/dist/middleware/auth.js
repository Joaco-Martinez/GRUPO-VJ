"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.optionalAuthMiddleware = optionalAuthMiddleware;
exports.requireRole = requireRole;
exports.requireAnyRole = requireAnyRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
function readToken(req) {
    const cookieToken = req.cookies?.token;
    const authorization = req.headers.authorization;
    if (cookieToken)
        return cookieToken;
    if (authorization?.startsWith("Bearer ")) {
        return authorization.replace("Bearer ", "").trim();
    }
    return null;
}
function authMiddleware(req, res, next) {
    const token = readToken(req);
    if (!token) {
        return res.status(401).json({ message: "Token requerido" });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = { id: decoded.userId, role: decoded.role };
        next();
    }
    catch (_err) {
        return res.status(401).json({ message: "Token inválido" });
    }
}
function optionalAuthMiddleware(req, _res, next) {
    const token = readToken(req);
    if (!token) {
        return next();
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = { id: decoded.userId, role: decoded.role };
    }
    catch (_err) {
        // En rutas públicas no bloqueamos por token vencido/incorrecto.
        // Simplemente se responde como visitante y el frontend puede pedir login al checkout.
        req.user = undefined;
    }
    next();
}
function requireRole(role) {
    return (req, res, next) => {
        const user = req.user;
        if (!user || user.role !== role) {
            return res.status(403).json({ message: "No autorizado" });
        }
        next();
    };
}
function requireAnyRole(roles) {
    return (req, res, next) => {
        const user = req.user;
        if (!user || !roles.includes(user.role)) {
            return res.status(403).json({ message: "No autorizado" });
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map