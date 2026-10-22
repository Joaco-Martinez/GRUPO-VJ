"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nowUTC = nowUTC;
exports.parseDateInputAR = parseDateInputAR;
exports.startOfDayAR = startOfDayAR;
exports.endOfDayAR = endOfDayAR;
exports.dayRangeAR = dayRangeAR;
exports.rangeAR = rangeAR;
exports.optionalRangeAR = optionalRangeAR;
exports.monthRangeAR = monthRangeAR;
exports.yearRangeAR = yearRangeAR;
exports.weekRangeAR = weekRangeAR;
exports.formatDateAR = formatDateAR;
exports.formatTimeAR = formatTimeAR;
exports.formatDateTimeAR = formatDateTimeAR;
exports.afipDateAR = afipDateAR;
const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function assertValidDate(date, label = "Fecha") {
    if (Number.isNaN(date.getTime())) {
        throw new Error(`${label} inválida`);
    }
}
function assertIsoDate(dateStr, label = "Fecha") {
    if (!ISO_DATE_RE.test(dateStr)) {
        throw new Error(`${label} inválida. Usá formato YYYY-MM-DD`);
    }
}
function getArgentinaDateParts(date) {
    const value = new Date(date);
    assertValidDate(value);
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: ARGENTINA_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(value);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (!year || !month || !day) {
        throw new Error("No se pudo resolver la fecha argentina");
    }
    return { year, month, day };
}
function nowUTC() {
    return new Date();
}
function parseDateInputAR(value) {
    if (!value)
        return undefined;
    if (value instanceof Date) {
        assertValidDate(value);
        return value;
    }
    const raw = String(value).trim();
    if (!raw)
        return undefined;
    const date = ISO_DATE_RE.test(raw)
        ? new Date(`${raw}T12:00:00.000-03:00`)
        : new Date(raw);
    assertValidDate(date);
    return date;
}
function startOfDayAR(date) {
    const { year, month, day } = getArgentinaDateParts(date);
    return new Date(`${year}-${month}-${day}T00:00:00.000-03:00`);
}
function endOfDayAR(date) {
    const { year, month, day } = getArgentinaDateParts(date);
    return new Date(`${year}-${month}-${day}T23:59:59.999-03:00`);
}
function dayRangeAR(dateStr) {
    const raw = String(dateStr).slice(0, 10);
    assertIsoDate(raw);
    return {
        start: new Date(`${raw}T00:00:00.000-03:00`),
        end: new Date(`${raw}T23:59:59.999-03:00`),
    };
}
function rangeAR(from, to) {
    const fromRaw = String(from).slice(0, 10);
    const toRaw = String(to).slice(0, 10);
    assertIsoDate(fromRaw, "Fecha desde");
    assertIsoDate(toRaw, "Fecha hasta");
    return {
        start: new Date(`${fromRaw}T00:00:00.000-03:00`),
        end: new Date(`${toRaw}T23:59:59.999-03:00`),
    };
}
function optionalRangeAR(from, to) {
    const result = {};
    if (from) {
        const raw = String(from).slice(0, 10);
        assertIsoDate(raw, "Fecha desde");
        result.start = new Date(`${raw}T00:00:00.000-03:00`);
    }
    if (to) {
        const raw = String(to).slice(0, 10);
        assertIsoDate(raw, "Fecha hasta");
        result.end = new Date(`${raw}T23:59:59.999-03:00`);
    }
    return result;
}
function monthRangeAR(year, month) {
    const y = Number(year);
    const m = Number(month);
    if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
        throw new Error("Mes o año inválido");
    }
    const mm = String(m).padStart(2, "0");
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const dd = String(lastDay).padStart(2, "0");
    return rangeAR(`${y}-${mm}-01`, `${y}-${mm}-${dd}`);
}
function yearRangeAR(year) {
    const y = Number(year);
    if (!Number.isInteger(y)) {
        throw new Error("Año inválido");
    }
    return rangeAR(`${y}-01-01`, `${y}-12-31`);
}
function weekRangeAR(year, month, day) {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
        throw new Error("Fecha semanal inválida");
    }
    const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
    assertValidDate(base, "Fecha semanal");
    const jsDay = base.getUTCDay();
    const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
    const monday = new Date(base);
    monday.setUTCDate(base.getUTCDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const from = monday.toISOString().slice(0, 10);
    const to = sunday.toISOString().slice(0, 10);
    return rangeAR(from, to);
}
function formatDateAR(date) {
    if (!date)
        return "";
    return new Intl.DateTimeFormat("es-AR", {
        timeZone: ARGENTINA_TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(date));
}
function formatTimeAR(date) {
    if (!date)
        return "";
    return new Intl.DateTimeFormat("es-AR", {
        timeZone: ARGENTINA_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(new Date(date));
}
function formatDateTimeAR(date) {
    if (!date)
        return "";
    return new Intl.DateTimeFormat("es-AR", {
        timeZone: ARGENTINA_TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(new Date(date));
}
function afipDateAR(date = new Date()) {
    const { year, month, day } = getArgentinaDateParts(date);
    return `${year}${month}${day}`;
}
//# sourceMappingURL=dateAR.js.map