"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const morgan_1 = __importDefault(require("morgan"));
const prisma_1 = __importDefault(require("./prisma"));
const factura_pdf_routes_1 = __importDefault(require("./routes/factura-pdf.routes"));
const logger_1 = require("./middleware/logger");
const swagger_1 = require("./config/swagger");
const auth_1 = require("./middleware/auth");
const afip_routes_1 = __importDefault(require("./afip/afip.routes"));
const notaCreditoPdf_routes_1 = __importDefault(require("./routes/notaCreditoPdf.routes"));
const alert_routes_1 = __importDefault(require("./routes/alert.routes"));
const cashClosePrint_routes_1 = __importDefault(require("./routes/cashClosePrint.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const product_routes_1 = __importDefault(require("./routes/product.routes"));
const remito_routes_1 = __importDefault(require("./routes/remito.routes"));
const account_routes_1 = __importDefault(require("./routes/account.routes"));
const businessLocation_routes_1 = __importDefault(require("./routes/businessLocation.routes"));
const sale_routes_1 = __importDefault(require("./routes/sale.routes"));
const category_routes_1 = __importDefault(require("./routes/category.routes"));
const client_routes_1 = __importDefault(require("./routes/client.routes"));
const finance_routes_1 = __importDefault(require("./routes/finance.routes"));
const productStats_routes_1 = __importDefault(require("./routes/productStats.routes"));
const delivery_routes_1 = __importDefault(require("./routes/delivery.routes"));
const catalog_routes_1 = __importDefault(require("./routes/catalog.routes"));
const arcaConfig_routes_1 = __importDefault(require("./routes/arcaConfig.routes"));
const ticket_routes_1 = __importDefault(require("./routes/ticket.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((req, res, next) => {
    const url = req.url.toLowerCase();
    const forbiddenPatterns = [
        "/.env",
        "/.git",
        "/.aws",
        "/storage",
        "/logs",
        "/debug.log",
        "/error.log",
        "/phpinfo",
        "/info.php",
        "/database.yml",
        "/settings.py",
    ];
    const isForbidden = forbiddenPatterns.some((item) => {
        return url === item || url.startsWith(`${item}/`);
    });
    if (isForbidden) {
        console.warn(`🚨 Bloqueado intento de acceso indebido a: ${req.url}`);
        return res.status(404).send("Not found");
    }
    next();
});
// 🔹 Middlewares globales
app.use((0, cookie_parser_1.default)());
app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
});
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        const envOrigins = [
            process.env.FRONTEND_URL,
            process.env.STOREFRONT_URL,
            process.env.ADMIN_FRONTEND_URL,
            process.env.CORS_ORIGINS,
        ]
            .filter(Boolean)
            .flatMap((value) => String(value).split(","))
            .map((value) => value.trim())
            .filter(Boolean);
        const allowedOrigins = [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://localhost:4000",
            "https://von-konig.vercel.app",
            "https://www.vonkonigerp.com.ar",
            ...envOrigins,
        ];
        // Permitir requests sin Origin (Postman, mobile apps, bots internos)
        if (!origin) {
            return callback(null, true);
        }
        // Validar correctamente
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        console.warn("🚫 CORS bloqueado:", origin);
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, morgan_1.default)("dev"));
app.use(logger_1.requestLogger);
app.use((req, _res, next) => {
    console.log("➡️ Entró un request:", req.method, req.url);
    next();
});
// 🔹 Ruta de prueba de conexión
app.get("/", async (_req, res, next) => {
    try {
        const users = await prisma_1.default.user.findMany();
        res.json({ ok: true, users });
    }
    catch (err) {
        next(err);
    }
});
// 🔹 Rutas
app.use("/factura-pdf", factura_pdf_routes_1.default);
app.use("/auth", auth_routes_1.default);
app.use("/products", product_routes_1.default);
app.use("/catalog", catalog_routes_1.default);
app.use("/users", auth_1.authMiddleware, (0, auth_1.requireRole)("ADMIN"), user_routes_1.default);
app.use("/sales", sale_routes_1.default);
app.use("/accounts", account_routes_1.default);
app.use("/categories", category_routes_1.default);
app.use("/nota-credito-pdf", notaCreditoPdf_routes_1.default);
app.use("/finance", finance_routes_1.default);
app.use("/clients", client_routes_1.default);
app.use("/cash-close", cashClosePrint_routes_1.default);
app.use("/business-locations", businessLocation_routes_1.default);
app.use("/tickets", ticket_routes_1.default);
app.use("/remitos", remito_routes_1.default);
app.use("/delivery", delivery_routes_1.default);
app.use("/arca-config", arcaConfig_routes_1.default);
app.use("/afip/configuracion", arcaConfig_routes_1.default);
app.use("/alerts", alert_routes_1.default);
app.use("/product-stats", auth_1.authMiddleware, productStats_routes_1.default);
app.use("/afip", afip_routes_1.default);
// 🔹 Swagger
(0, swagger_1.swaggerDocs)(app);
// 🔹 Logger de errores
app.use(logger_1.errorLogger);
exports.default = app;
//# sourceMappingURL=app.js.map