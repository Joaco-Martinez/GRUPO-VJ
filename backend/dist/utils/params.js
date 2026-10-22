"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getParamAsString = getParamAsString;
function getParamAsString(value, name = "param") {
    if (typeof value === "string" && value.trim()) {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
        return value[0];
    }
    throw new Error(`${name} inválido o faltante`);
}
//# sourceMappingURL=params.js.map