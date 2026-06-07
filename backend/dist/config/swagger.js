"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerDocs = swaggerDocs;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_ui_express_1 = require("swagger-ui-express");
const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Grupo VJ API",
            version: "1.0.0",
            description: "Documentación de la API para el sistema Von König",
        },
        servers: [
            {
                url: "/",
                description: "Mismo host donde corre Swagger",
            },
        ],
    },
    apis: ["./src/docs/*.yaml"],
};
const swaggerSpec = (0, swagger_jsdoc_1.default)(options);
function swaggerDocs(app) {
    app.use("/api", swagger_ui_express_1.serve, (0, swagger_ui_express_1.setup)(swaggerSpec));
    console.log("📖 Swagger docs disponible en http://localhost:4000/api");
}
//# sourceMappingURL=swagger.js.map