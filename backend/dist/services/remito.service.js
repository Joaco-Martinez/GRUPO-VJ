"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.remitoService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const remitoPdf_service_1 = require("./remitoPdf.service");
function buildFullNumber(pointOfSale, number) {
    return `${String(pointOfSale).padStart(4, "0")}-${String(number).padStart(8, "0")}`;
}
function buildAddress(parts) {
    return parts.filter(Boolean).join(" ").trim() || null;
}
function buildClientFullName(client) {
    if (!client)
        return "CONSUMIDOR FINAL";
    const fullName = [client.nombre, client.apellido].filter(Boolean).join(" ");
    return fullName || "CONSUMIDOR FINAL";
}
function getClientAddress(client) {
    if (!client)
        return null;
    return buildAddress([
        client.addressStreet,
        client.addressNumber,
        client.addressFloor ? `Piso ${client.addressFloor}` : null,
        client.addressApartment ? `Dpto ${client.addressApartment}` : null,
    ]);
}
function getClientLocality(client) {
    if (!client)
        return null;
    return [client.addressCity, client.addressProvince]
        .filter(Boolean)
        .join(" - ");
}
function getBusinessLocationAddress(location) {
    if (!location)
        return null;
    return buildAddress([
        location.addressStreet,
        location.addressNumber,
        location.addressCity,
        location.addressProvince,
    ]);
}
function getClientIvaCondition(client) {
    if (!client)
        return "CONSUMIDOR FINAL";
    if (client.category === "Mayorista")
        return "IVA RESPONSABLE INSCRIPTO";
    if (client.category === "Cliente")
        return "CONSUMIDOR FINAL";
    return "CONSUMIDOR FINAL";
}
function normalizeOptionalString(value) {
    const clean = String(value ?? "").trim();
    return clean.length ? clean : null;
}
function assertCanCreateRemito(sale) {
    const isAccepted = sale.status === client_1.SaleStatus.COMPLETED;
    const isInvoiced = sale.isInvoiced === true;
    if (!isAccepted && !isInvoiced) {
        throw new Error("No se puede emitir remito: la venta debe estar facturada o aceptada.");
    }
}
function mapRemitoToPdfData(remito) {
    return {
        remito: {
            pointOfSale: remito.pointOfSale,
            number: remito.number,
            issueDate: remito.issueDate,
            placeOfIssue: remito.placeOfIssue,
            cai: remito.cai,
            caiExpiresAt: remito.caiExpiresAt,
            sellerName: remito.sellerName,
            saleCondition: remito.saleCondition,
            transportName: remito.transportName,
            packages: remito.packagesCount,
            declaredValue: remito.declaredValue,
            copyLabel: "ORIGINAL",
        },
        business: {
            businessName: remito.businessName || "GRUPO VJ",
            fantasyName: "Grupo VJ",
            cuit: remito.businessCuit || "",
            ivaCondition: remito.businessIvaCondition || "IVA RESPONSABLE INSCRIPTO",
            grossIncomeNumber: remito.businessIibb || "",
            activityStartDate: remito.businessActivityStart || null,
            fiscalAddress: remito.businessFiscalAddress || "",
            businessAddress: remito.businessAddress || "",
            locality: remito.placeOfIssue || "",
            province: "",
            phone: remito.businessPhone || "",
            email: remito.businessEmail || "",
            logoPath: null,
        },
        client: {
            name: remito.clientName || "CONSUMIDOR FINAL",
            address: remito.clientAddress || "",
            locality: remito.clientLocality || "",
            ivaCondition: remito.clientIvaCondition || "CONSUMIDOR FINAL",
            cuitOrDni: remito.clientCuit || remito.clientDni || "",
        },
        items: remito.items.map((item) => ({
            code: item.code || "",
            quantity: Number(item.quantity ?? 0),
            quantityKg: item.quantityKg,
            description: item.description,
        })),
    };
}
exports.remitoService = {
    async createFromSale(input) {
        const sale = await prisma_1.default.sale.findUnique({
            where: { id: input.saleId },
            include: {
                client: true,
                user: true,
                businessLocation: true,
                invoiceAfip: true,
                remitos: {
                    where: {
                        status: {
                            not: client_1.RemitoStatus.CANCELLED,
                        },
                    },
                    select: {
                        id: true,
                        fullNumber: true,
                        status: true,
                    },
                },
                items: {
                    include: {
                        product: true,
                    },
                },
            },
        });
        if (!sale) {
            throw new Error("Venta no encontrada");
        }
        assertCanCreateRemito(sale);
        if (sale.remitos.length > 0) {
            throw new Error(`Esta venta ya tiene un remito emitido: ${sale.remitos[0].fullNumber}`);
        }
        if (!sale.items.length) {
            throw new Error("La venta no tiene productos para remitir");
        }
        const now = new Date();
        const createdRemito = await prisma_1.default.$transaction(async (tx) => {
            const arcaConfig = await tx.arcaConfig.findFirst({
                where: {
                    isActive: true,
                },
                include: {
                    remitoCais: {
                        where: {
                            enabled: true,
                            expiresAt: {
                                gte: now,
                            },
                        },
                        orderBy: {
                            expiresAt: "asc",
                        },
                    },
                },
                orderBy: {
                    updatedAt: "desc",
                },
            });
            if (!arcaConfig) {
                throw new Error("No hay configuración ARCA activa. Cargá primero los datos fiscales de Grupo VJ.");
            }
            const remitoCai = arcaConfig.remitoCais[0];
            if (!remitoCai) {
                throw new Error("No hay CAI activo para remitos. Cargá CAI, vencimiento y numeración en configuración ARCA.");
            }
            const pointOfSale = remitoCai.pointOfSale || arcaConfig.defaultPointOfSale || 1;
            const nextNumber = remitoCai.nextNumber || remitoCai.rangeFrom || 1;
            if (remitoCai.rangeTo && nextNumber > remitoCai.rangeTo) {
                throw new Error(`El CAI de remitos agotó la numeración permitida. Último permitido: ${remitoCai.rangeTo}`);
            }
            const fullNumber = buildFullNumber(pointOfSale, nextNumber);
            const businessAddress = getBusinessLocationAddress(sale.businessLocation) ||
                arcaConfig.fiscalAddress ||
                null;
            const clientName = buildClientFullName(sale.client);
            const clientAddress = sale.deliveryAddressSnapshot || getClientAddress(sale.client);
            const remito = await tx.remito.create({
                data: {
                    saleId: sale.id,
                    clientId: sale.clientId,
                    userId: input.userId || sale.userId || null,
                    businessLocationId: sale.businessLocationId,
                    arcaConfigId: arcaConfig.id,
                    remitoCaiConfigId: remitoCai.id,
                    status: client_1.RemitoStatus.ISSUED,
                    mode: remitoCai.mode || client_1.RemitoMode.DIGITAL_FULL,
                    pointOfSale,
                    number: nextNumber,
                    fullNumber,
                    code: "91",
                    issueDate: now,
                    placeOfIssue: normalizeOptionalString(input.placeOfIssue) ||
                        sale.businessLocation?.addressCity ||
                        "VILLA GENERAL BELGRANO",
                    cai: remitoCai.cai,
                    caiExpiresAt: remitoCai.expiresAt,
                    caiRangeFrom: remitoCai.rangeFrom,
                    caiRangeTo: remitoCai.rangeTo,
                    businessName: arcaConfig.businessName || "GRUPO VJ",
                    businessCuit: arcaConfig.cuit,
                    businessIvaCondition: arcaConfig.ivaCondition || "IVA RESPONSABLE INSCRIPTO",
                    businessIibb: arcaConfig.iibb,
                    businessActivityStart: arcaConfig.activityStart,
                    businessFiscalAddress: arcaConfig.fiscalAddress,
                    businessAddress,
                    businessEmail: process.env.BUSINESS_EMAIL || null,
                    businessPhone: process.env.BUSINESS_PHONE || null,
                    clientName,
                    clientDni: sale.client?.dni || null,
                    clientCuit: null,
                    clientIvaCondition: getClientIvaCondition(sale.client),
                    clientAddress,
                    clientLocality: getClientLocality(sale.client),
                    sellerName: sale.user?.name || null,
                    saleCondition: normalizeOptionalString(input.saleCondition) ||
                        String(sale.paymentMethod || ""),
                    transportName: normalizeOptionalString(input.transportName) ||
                        sale.transportName ||
                        null,
                    transportCuit: normalizeOptionalString(input.transportCuit) ||
                        sale.transportCuit ||
                        null,
                    packagesCount: input.packagesCount !== undefined
                        ? input.packagesCount
                        : sale.packagesCount,
                    declaredValue: input.declaredValue !== undefined
                        ? input.declaredValue
                        : sale.declaredValue || sale.total,
                    observations: normalizeOptionalString(input.observations),
                    items: {
                        create: sale.items.map((item) => {
                            const product = item.product;
                            return {
                                productId: item.productId,
                                code: item.productSkuSnapshot || product?.sku || null,
                                description: item.productNameSnapshot || product?.name || "Producto",
                                quantity: product?.saleUnit === client_1.SaleUnit.KG ? null : item.quantity,
                                quantityKg: product?.saleUnit === client_1.SaleUnit.KG ? item.quantityKg : null,
                                saleUnit: product?.saleUnit || client_1.SaleUnit.UNIT,
                            };
                        }),
                    },
                },
                include: {
                    items: true,
                },
            });
            await tx.remitoCaiConfig.update({
                where: { id: remitoCai.id },
                data: {
                    nextNumber: nextNumber + 1,
                },
            });
            return remito;
        });
        const remitoFinal = await prisma_1.default.remito.findUnique({
            where: { id: createdRemito.id },
            include: {
                sale: true,
                client: true,
                user: true,
                businessLocation: true,
                items: {
                    include: {
                        product: true,
                    },
                },
            },
        });
        return remitoFinal;
    },
    async getPdfBuffer(id) {
        const remito = await prisma_1.default.remito.findUnique({
            where: { id },
            include: {
                items: true,
            },
        });
        if (!remito) {
            throw new Error("Remito no encontrado");
        }
        if (remito.status === client_1.RemitoStatus.CANCELLED) {
            throw new Error("No se puede descargar un remito cancelado");
        }
        const buffer = await (0, remitoPdf_service_1.generateRemitoPDFBuffer)(mapRemitoToPdfData(remito));
        return {
            buffer,
            filename: `remito_${remito.fullNumber.replace("-", "_")}.pdf`,
        };
    },
    async getAll(params) {
        const where = {};
        if (params?.status)
            where.status = params.status;
        if (params?.clientId)
            where.clientId = params.clientId;
        if (params?.saleId)
            where.saleId = params.saleId;
        if (params?.from || params?.to) {
            where.issueDate = {};
            if (params.from) {
                where.issueDate.gte = new Date(params.from);
            }
            if (params.to) {
                where.issueDate.lte = new Date(params.to);
            }
        }
        return prisma_1.default.remito.findMany({
            where,
            orderBy: {
                issueDate: "desc",
            },
            include: {
                sale: true,
                client: true,
                user: true,
                businessLocation: true,
                items: true,
            },
        });
    },
    async getById(id) {
        const remito = await prisma_1.default.remito.findUnique({
            where: { id },
            include: {
                sale: true,
                client: true,
                user: true,
                businessLocation: true,
                arcaConfig: true,
                remitoCaiConfig: true,
                items: {
                    include: {
                        product: true,
                    },
                },
            },
        });
        if (!remito) {
            throw new Error("Remito no encontrado");
        }
        return remito;
    },
    async regeneratePdf(id) {
        const remito = await prisma_1.default.remito.findUnique({
            where: { id },
            include: {
                sale: true,
                client: true,
                user: true,
                businessLocation: true,
                items: true,
            },
        });
        if (!remito) {
            throw new Error("Remito no encontrado");
        }
        if (remito.status === client_1.RemitoStatus.CANCELLED) {
            throw new Error("No se puede regenerar el PDF de un remito cancelado");
        }
        return remito;
    },
    async markAsDelivered(id) {
        const remito = await prisma_1.default.remito.findUnique({
            where: { id },
        });
        if (!remito) {
            throw new Error("Remito no encontrado");
        }
        if (remito.status === client_1.RemitoStatus.CANCELLED) {
            throw new Error("No se puede entregar un remito cancelado");
        }
        return prisma_1.default.remito.update({
            where: { id },
            data: {
                status: client_1.RemitoStatus.DELIVERED,
            },
            include: {
                sale: true,
                client: true,
                user: true,
                businessLocation: true,
                items: true,
            },
        });
    },
    async cancel(id) {
        const remito = await prisma_1.default.remito.findUnique({
            where: { id },
        });
        if (!remito) {
            throw new Error("Remito no encontrado");
        }
        if (remito.status === client_1.RemitoStatus.CANCELLED) {
            throw new Error("El remito ya está cancelado");
        }
        return prisma_1.default.remito.update({
            where: { id },
            data: {
                status: client_1.RemitoStatus.CANCELLED,
            },
            include: {
                sale: true,
                client: true,
                user: true,
                businessLocation: true,
                items: true,
            },
        });
    },
};
//# sourceMappingURL=remito.service.js.map