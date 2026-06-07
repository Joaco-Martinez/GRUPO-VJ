"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.printCashClose = printCashClose;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = __importDefault(require("../prisma"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const buffer_1 = require("buffer");
function isRangeBody(body) {
    return typeof body?.from === "string" && typeof body?.to === "string";
}
function isDateBody(body) {
    return typeof body?.date === "string";
}
async function textToPdfBase64(text) {
    const doc = new pdfkit_1.default({ size: [226, 1000], margin: 10 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    const done = new Promise((resolve) => doc.on("end", () => resolve(buffer_1.Buffer.concat(chunks))));
    doc.font("Courier").fontSize(9).text(text);
    doc.end();
    const pdfBuffer = await done;
    return pdfBuffer.toString("base64");
}
// ===== Fechas AR (-03:00) =====
function dayRangeAR(dateStr) {
    const start = new Date(`${dateStr}T00:00:00-03:00`);
    const end = new Date(`${dateStr}T23:59:59.999-03:00`);
    return { start, end };
}
function rangeAR(from, to) {
    const start = new Date(`${from}T00:00:00-03:00`);
    const end = new Date(`${to}T23:59:59.999-03:00`);
    return { start, end };
}
function formatMoneyARS(n) {
    return n.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
function normalizeMethodCode(pm) {
    const v = String(pm ?? "UNKNOWN");
    // nuevos
    if (v === "QR_NACION")
        return "QR_NACION";
    if (v === "QR_MERCADOPAGO")
        return "QR_MP";
    if (v === "TARJETA_DEBITO")
        return "CARD_DEBIT";
    if (v === "TARJETA_CREDITO")
        return "CARD_CREDIT";
    // viejos / genéricos
    if (v === "EFECTIVO")
        return "CASH";
    if (v === "TRANSFERENCIA")
        return "TRANSFER";
    if (v === "DEBITO")
        return "CARD_DEBIT";
    if (v === "CREDITO")
        return "CARD_CREDIT";
    if (v === "TARJETA")
        return "CARD";
    if (v === "QR")
        return "QR";
    return "UNKNOWN";
}
function labelMethod(code) {
    const map = {
        CASH: "Efectivo",
        CARD_CREDIT: "Tarj. Crédito",
        CARD_DEBIT: "Tarj. Débito",
        CARD: "Tarjeta (gen)",
        QR_MP: "QR MercadoPago",
        QR_NACION: "QR Nación",
        QR: "QR (gen)",
        TRANSFER: "Transferencia",
        UNKNOWN: "Sin definir",
    };
    return map[code] ?? code;
}
// ===== Helpers ticket =====
const WIDTH = 30;
function line(char = "-") {
    return char.repeat(WIDTH);
}
function center(text) {
    const t = text.slice(0, WIDTH);
    const left = Math.floor((WIDTH - t.length) / 2);
    return " ".repeat(Math.max(0, left)) + t;
}
function cut(text, n) {
    return text.length > n ? text.slice(0, n) : text;
}
function right(text) {
    return text.padStart(WIDTH, " ");
}
function buildTicket(params) {
    const { from, to, totalAmount, totalCount, byMethod } = params;
    const fromStr = from.toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
    });
    const toStr = to.toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
    });
    const header = [
        center("VON KONIG"),
        center("CIERRE DE CAJA"),
        line(),
        cut(`Desde: ${fromStr}`, WIDTH),
        cut(`Hasta: ${toStr}`, WIDTH),
        line(),
    ];
    const methods = byMethod
        .sort((a, b) => b.amount - a.amount)
        .map((m) => {
        const name = cut(labelMethod(m.methodCode), 16).padEnd(16, " ");
        const cnt = String(m.count).padStart(3, " ");
        const amt = formatMoneyARS(m.amount).padStart(10, " ");
        return `${name} x${cnt} ${amt}`;
    });
    const footer = [
        line(),
        cut(`Ventas: ${totalCount}`, WIDTH),
        right(`TOTAL: $ ${formatMoneyARS(totalAmount)}`),
        line(),
        center("Gracias"),
        "",
        "",
    ];
    return [...header, ...methods, ...footer].join("\n");
}
async function sendToLocalPrinter(payload) {
    const localPOS = process.env.POS_LOCAL_URL;
    if (!localPOS)
        throw new Error("POS_LOCAL_URL no configurado. No se puede imprimir.");
    const pdfBase64 = await textToPdfBase64(payload.text);
    await axios_1.default.post(`${localPOS}/print`, {
        pdfBase64,
        factura: {
            tipo: "CASH_CLOSE",
            ...payload.meta,
        },
    }, {
        headers: { "Content-Type": "application/json" },
        timeout: 60000,
    });
}
async function printCashClose(body) {
    let start;
    let end;
    if (isRangeBody(body)) {
        ({ start, end } = rangeAR(body.from, body.to));
    }
    else if (isDateBody(body)) {
        ({ start, end } = dayRangeAR(body.date));
    }
    else {
        throw new Error("Body inválido");
    }
    // ✅ MISMA FUENTE QUE LA UI: FINANCE
    const records = await prisma_1.default.finance.findMany({
        where: {
            date: { gte: start, lte: end },
            type: "INGRESO",
        },
        select: {
            amount: true,
            category: true,
            paymentMethod: true,
        },
        orderBy: { date: "asc" },
    });
    // ✅ Solo ventas (tolerante a mayúsculas / espacios)
    const ventas = records.filter((r) => {
        const cat = String(r.category ?? "").trim().toLowerCase();
        return cat === "venta";
    });
    const map = new Map();
    for (const v of ventas) {
        const methodCode = normalizeMethodCode(v.paymentMethod);
        const amt = Number(v.amount ?? 0);
        const prev = map.get(methodCode) ?? { amount: 0, count: 0 };
        prev.amount = Number((prev.amount + (Number.isFinite(amt) ? amt : 0)).toFixed(2));
        prev.count += 1;
        map.set(methodCode, prev);
    }
    const byMethod = Array.from(map.entries()).map(([methodCode, v]) => ({
        methodCode,
        amount: v.amount,
        count: v.count,
    }));
    const totalAmount = Number(byMethod.reduce((acc, m) => acc + m.amount, 0).toFixed(2));
    const totalCount = ventas.length;
    const ticket = buildTicket({ from: start, to: end, totalAmount, totalCount, byMethod });
    // ✅ imprimir (descomentá)
    await sendToLocalPrinter({
        text: ticket,
        meta: {
            start: start.toISOString(),
            end: end.toISOString(),
            totalAmount,
            totalCount,
            byMethod,
        },
    });
    // console.log("=== TICKET DE CIERRE DE CAJA (DESDE FINANCE) ===");
    // console.log(ticket);
    return { ok: true, start, end, totalAmount, totalCount, byMethod };
}
//# sourceMappingURL=cashClosePrint.service.js.map