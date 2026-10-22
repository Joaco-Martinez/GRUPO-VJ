"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saleController = void 0;
const sale_service_1 = require("../services/sale.service");
const client_1 = require("@prisma/client");
const params_1 = require("../utils/params");
const toNumber = (v) => v === undefined || v === null || v === "" ? undefined : Number(v);
const toIntOrNull = (v) => {
    const n = toNumber(v);
    if (n === undefined)
        return undefined;
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
};
function isDeliveryMethod(value) {
    return Object.values(client_1.DeliveryMethod).includes(value);
}
function isDeliveryStatus(value) {
    return Object.values(client_1.DeliveryStatus).includes(value);
}
function normalizeSaleBody(body) {
    const items = Array.isArray(body.items)
        ? body.items.map((item) => ({
            productId: item.productId,
            quantity: toNumber(item.quantity) ?? 0,
            quantityKg: toNumber(item.quantityKg),
            price: toNumber(item.price),
            priceType: item.priceType,
            boxContents: Array.isArray(item.boxContents)
                ? item.boxContents.map((box) => ({
                    productId: box.productId,
                    quantity: toNumber(box.quantity),
                    quantityKg: toNumber(box.quantityKg),
                }))
                : undefined,
        }))
        : [];
    const stockLocation = body.stockLocation ?? body.stockSource ?? "LOCAL";
    if (!["LOCAL", "DEPOSITO"].includes(stockLocation)) {
        return {
            error: {
                status: 400,
                body: {
                    message: "Depósito/origen de stock inválido. Usá LOCAL o DEPOSITO",
                },
            },
        };
    }
    const deliveryMethod = body.deliveryMethod ?? "PICKUP";
    if (!isDeliveryMethod(deliveryMethod)) {
        return {
            error: {
                status: 400,
                body: {
                    message: "Método de entrega inválido. Usá PICKUP, LOCAL_DELIVERY o TRANSPORT",
                },
            },
        };
    }
    const deliveryStatus = body.deliveryStatus ?? "NONE";
    if (!isDeliveryStatus(deliveryStatus)) {
        return {
            error: {
                status: 400,
                body: {
                    message: "Estado de entrega inválido. Usá NONE, PENDING, PREPARING, IN_TRANSIT, DELIVERED o CANCELLED",
                },
            },
        };
    }
    return {
        payload: {
            ...body,
            isWebSale: false,
            stockLocation,
            quotationHours: toNumber(body.quotationHours),
            discountValue: toNumber(body.discountValue),
            businessLocationId: body.businessLocationId ?? null,
            deliveryMethod,
            deliveryStatus,
            deliveryAddressSnapshot: body.deliveryAddressSnapshot ?? null,
            deliveryDistanceKm: toNumber(body.deliveryDistanceKm),
            deliveryPricePerKm: toNumber(body.deliveryPricePerKm),
            deliveryCost: toNumber(body.deliveryCost) ?? 0,
            transportName: body.transportName ?? null,
            transportCuit: body.transportCuit ?? null,
            packagesCount: toIntOrNull(body.packagesCount),
            declaredValue: toNumber(body.declaredValue),
            items,
            payments: Array.isArray(body.payments)
                ? body.payments.map((payment) => ({
                    method: payment.method,
                    amount: Number(payment.amount),
                    reference: payment.reference,
                    notes: payment.notes,
                }))
                : undefined,
        },
    };
}
function safeJson(data) {
    return JSON.parse(JSON.stringify(data, (_, value) => typeof value === "bigint" ? value.toString() : value));
}
function getAuthUserId(req) {
    const r = req;
    return (r.user?.id ??
        r.user?.userId ??
        r.auth?.id ??
        r.auth?.userId ??
        r.usuario?.id ??
        r.usuario?.userId ??
        r.userId ??
        r.idUsuario ??
        null);
}
exports.saleController = {
    async getAll(req, res, next) {
        try {
            const { page, limit, search, status } = req.query;
            const sales = await sale_service_1.saleService.getAll({
                page: page !== undefined ? Number(page) : undefined,
                limit: limit !== undefined ? Number(limit) : undefined,
                search: typeof search === "string" ? search : undefined,
                status: typeof status === "string" ? status : undefined,
            });
            res.json(safeJson(sales));
        }
        catch (err) {
            next(err);
        }
    },
    async getPending(req, res, next) {
        try {
            const { limit } = req.query;
            const sales = await sale_service_1.saleService.getPending({
                limit: limit !== undefined ? Number(limit) : undefined,
            });
            res.json(safeJson(sales));
        }
        catch (err) {
            next(err);
        }
    },
    async getById(req, res, next) {
        try {
            const sale = await sale_service_1.saleService.getById((0, params_1.getParamAsString)(req.params.id, "id"));
            if (!sale) {
                return res.status(404).json({ message: "Venta no encontrada" });
            }
            res.json(safeJson(sale));
        }
        catch (err) {
            next(err);
        }
    },
    async generarCotizacion(req, res, next) {
        try {
            const result = await sale_service_1.saleService.generarCotizacion((0, params_1.getParamAsString)(req.params.id, "id"));
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
            res.setHeader("Content-Length", result.buffer.length);
            return res.send(result.buffer);
        }
        catch (err) {
            next(err);
        }
    },
    async generarComprobante(req, res, next) {
        try {
            const result = await sale_service_1.saleService.generarComprobanteVenta((0, params_1.getParamAsString)(req.params.id, "id"));
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
            res.setHeader("Content-Length", result.buffer.length);
            return res.send(result.buffer);
        }
        catch (err) {
            next(err);
        }
    },
    async create(req, res, next) {
        try {
            const normalized = normalizeSaleBody(req.body);
            if (normalized.error) {
                return res.status(normalized.error.status).json(normalized.error.body);
            }
            const userId = getAuthUserId(req);
            if (!userId) {
                return res.status(401).json({
                    message: "No se pudo identificar el usuario autenticado para registrar la venta",
                });
            }
            const newSale = await sale_service_1.saleService.create({
                ...normalized.payload,
                userId,
            });
            res.status(201).json(safeJson(newSale));
        }
        catch (err) {
            next(err);
        }
    },
    async updateItems(req, res, next) {
        try {
            const normalized = normalizeSaleBody(req.body);
            if (normalized.error) {
                return res.status(normalized.error.status).json(normalized.error.body);
            }
            const updated = await sale_service_1.saleService.updateItems((0, params_1.getParamAsString)(req.params.id, "id"), {
                ...normalized.payload,
                userId: getAuthUserId(req) ?? undefined,
            });
            res.json(safeJson(updated));
        }
        catch (err) {
            next(err);
        }
    },
    async bulkUpdate(req, res, next) {
        try {
            const { action } = req.body;
            if (!["COMPLETE", "CANCEL"].includes(action)) {
                return res.status(400).json({ message: "Acción inválida. Usá COMPLETE o CANCEL" });
            }
            const mapped = action === "COMPLETE" ? "COMPLETED" : "CANCELLED";
            const updated = await sale_service_1.saleService.bulkUpdatePending(mapped);
            res.json(updated);
        }
        catch (err) {
            next(err);
        }
    },
    async updateStatus(req, res, next) {
        try {
            const { status } = req.body;
            if (!status || !Object.values(client_1.SaleStatus).includes(status)) {
                return res.status(400).json({ message: "Estado de venta inválido" });
            }
            const updated = await sale_service_1.saleService.updateStatus((0, params_1.getParamAsString)(req.params.id, "id"), status);
            res.json(updated);
        }
        catch (err) {
            next(err);
        }
    },
    async updatePaymentMethod(req, res, next) {
        try {
            const { paymentMethod } = req.body;
            if (!paymentMethod) {
                return res.status(400).json({ message: "paymentMethod es requerido" });
            }
            const updated = await sale_service_1.saleService.updatePaymentMethod((0, params_1.getParamAsString)(req.params.id, "id"), paymentMethod);
            res.json(updated);
        }
        catch (err) {
            next(err);
        }
    },
    async updatePayments(req, res, next) {
        try {
            const { payments, setAsPrimary } = req.body;
            if (!Array.isArray(payments) || payments.length === 0) {
                return res.status(400).json({
                    message: "payments debe ser un array con al menos 1 pago",
                });
            }
            const normalizedPayments = payments.map((payment) => ({
                method: payment.method,
                amount: Number(payment.amount),
                reference: payment.reference,
                notes: payment.notes,
            }));
            const updated = await sale_service_1.saleService.updatePayments((0, params_1.getParamAsString)(req.params.id, "id"), normalizedPayments, !!setAsPrimary);
            res.json(updated);
        }
        catch (err) {
            next(err);
        }
    },
    async generarNotaPedido(req, res, next) {
        try {
            const result = await sale_service_1.saleService.generarNotaPedido((0, params_1.getParamAsString)(req.params.id, "id"));
            res.json({
                ok: true,
                message: "Nota de pedido generada e impresa",
                result,
            });
        }
        catch (err) {
            next(err);
        }
    },
};
//# sourceMappingURL=sale.controller.js.map