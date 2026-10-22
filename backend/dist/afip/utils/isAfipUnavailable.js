"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAfipUnavailable = isAfipUnavailable;
function isAfipUnavailable(err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const htmlUnavailable = typeof data === "string" && data.toLowerCase().includes("service unavailable");
    return (status === 503 ||
        status === 502 ||
        status === 504 ||
        htmlUnavailable ||
        err?.code === "ETIMEDOUT" ||
        err?.code === "ECONNRESET" ||
        err?.code === "ECONNABORTED");
}
//# sourceMappingURL=isAfipUnavailable.js.map