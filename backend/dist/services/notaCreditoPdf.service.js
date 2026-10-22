"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.regenerarNotaCreditoPDFService = regenerarNotaCreditoPDFService;
exports.obtenerNotaCreditoPDFPathService = obtenerNotaCreditoPDFPathService;
const prisma_1 = __importDefault(require("../prisma"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const facturaPdfGenerator_service_1 = require("./facturaPdfGenerator.service");
function isNotaCreditoTipo(tipoComprobante) {
    return [3, 8, 13].includes(Number(tipoComprobante));
}
function isNotaCreditoAprobada(invoice) {
    return Boolean(invoice &&
        isNotaCreditoTipo(invoice.tipoComprobante) &&
        invoice.resultado === "A" &&
        invoice.cae);
}
async function regenerarNotaCreditoPDFService(saleId, uploadToCloudinary = false) {
    /**
     * Caso A:
     * El saleId recibido pertenece directamente a una venta que ya es nota de crédito.
     */
    const saleDirecta = await prisma_1.default.sale.findUnique({
        where: { id: saleId },
        include: {
            client: true,
            invoiceAfip: {
                include: {
                    relatedInvoice: true,
                },
            },
            items: {
                include: {
                    product: true,
                },
            },
        },
    });
    let sale = saleDirecta;
    let notaCredito = saleDirecta?.invoiceAfip ?? null;
    const notaDirectaValida = isNotaCreditoAprobada(notaCredito);
    /**
     * Caso B:
     * El saleId recibido pertenece a la venta/factura original.
     * Entonces buscamos su factura y luego buscamos una nota de crédito aprobada
     * vinculada a esa factura por relatedInvoiceId.
     */
    if (!notaDirectaValida) {
        const facturaOriginal = await prisma_1.default.invoiceAfip.findUnique({
            where: { saleId },
            include: {
                sale: {
                    include: {
                        client: true,
                        items: {
                            include: {
                                product: true,
                            },
                        },
                    },
                },
            },
        });
        if (!facturaOriginal) {
            throw new Error("Factura original no encontrada para buscar la nota de crédito");
        }
        const notaRelacionada = await prisma_1.default.invoiceAfip.findFirst({
            where: {
                relatedInvoiceId: facturaOriginal.id,
                tipoComprobante: {
                    in: [3, 8, 13],
                },
                resultado: "A",
                cae: {
                    not: null,
                },
            },
            include: {
                relatedInvoice: true,
                sale: {
                    include: {
                        client: true,
                        items: {
                            include: {
                                product: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        if (!notaRelacionada) {
            throw new Error("Nota de crédito aprobada no encontrada");
        }
        notaCredito = notaRelacionada;
        /**
         * Para datos de cliente/productos:
         * - usamos la venta de la NC si existe
         * - si no, usamos la venta original
         */
        sale = notaRelacionada.sale ?? facturaOriginal.sale;
    }
    if (!sale) {
        throw new Error("Venta asociada a la nota de crédito no encontrada");
    }
    if (!notaCredito) {
        throw new Error("Nota de crédito no encontrada");
    }
    const esNotaCredito = isNotaCreditoTipo(notaCredito.tipoComprobante) ||
        Boolean(notaCredito.relatedInvoiceId);
    if (!esNotaCredito) {
        throw new Error("El comprobante encontrado no es una nota de crédito");
    }
    if (notaCredito.resultado !== "A" || !notaCredito.cae) {
        throw new Error("La nota de crédito no está aprobada por AFIP");
    }
    const pdfData = {
        factura: {
            cuit: notaCredito.cuit,
            puntoVenta: notaCredito.puntoVenta,
            tipoComprobante: notaCredito.tipoComprobante,
            tipoDoc: notaCredito.tipoDoc,
            nroDoc: Number(notaCredito.nroDoc),
            numero: notaCredito.numero,
            fechaEmision: new Date(notaCredito.fechaEmision),
            resultado: notaCredito.resultado,
            cae: notaCredito.cae || "",
            caeVto: notaCredito.caeVto ? new Date(notaCredito.caeVto) : new Date(),
            total: Number(notaCredito.total),
            neto: Number(notaCredito.neto),
            iva: Number(notaCredito.iva),
            condicionIVAReceptor: notaCredito.condicionIVAReceptor,
            moneda: notaCredito.moneda,
            urlQR: notaCredito.urlQR || undefined,
            saleId: sale.id,
        },
        empresa: {
            name: process.env.BUSINESS_NAME || "GRUPO VJ",
            subtitle: process.env.BUSINESS_SUBTITLE || "SANTILLAN JULIO CESAR",
            cuit: process.env.BUSINESS_CUIT || notaCredito.cuit,
            address: process.env.BUSINESS_ADDRESS ||
                "PASO DE LOS ANDES 893, BARRIO OBSERVATORIO, 5000-CORDOBA",
            phone: process.env.BUSINESS_PHONE || "+54 9 3513 79-0057",
            ivaCondition: process.env.BUSINESS_IVA_CONDITION || undefined,
        },
        cliente: {
            nombre: sale.client?.nombre || "Consumidor Final",
            apellido: sale.client?.apellido || "",
            dni: sale.client?.dni || "",
            telefono: sale.client?.telefono || "",
            gmail: sale.client?.gmail || sale.gmailSend || "",
            category: sale.client?.category || "Consumidor Final",
        },
        products: sale.items.map((item) => {
            const quantity = Number(item.quantity || 0);
            const quantityKg = item.quantityKg !== null && item.quantityKg !== undefined
                ? Number(item.quantityKg)
                : undefined;
            const price = Number(item.price || 0);
            const subtotal = item.subtotal !== null && item.subtotal !== undefined
                ? Number(item.subtotal)
                : quantityKg !== undefined && quantityKg > 0
                    ? quantityKg * price
                    : quantity * price;
            return {
                name: item.product?.name || item.productNameSnapshot || "Producto",
                quantity,
                quantityKg,
                price,
                subtotal,
            };
        }),
        logoPath: path_1.default.resolve("./assets/logo-vj.png"),
    };
    const result = await (0, facturaPdfGenerator_service_1.generarFacturaPDF)(pdfData, uploadToCloudinary);
    if ("cloudinaryUrl" in result && result.cloudinaryUrl) {
        await prisma_1.default.sale.update({
            where: { id: sale.id },
            data: {
                pdfUrl: result.cloudinaryUrl,
            },
        });
    }
    return result;
}
async function obtenerNotaCreditoPDFPathService(saleId) {
    const result = await regenerarNotaCreditoPDFService(saleId, false);
    if (!result.filePath || !fs_1.default.existsSync(result.filePath)) {
        throw new Error("No se pudo generar el archivo PDF de la nota de crédito");
    }
    return {
        filePath: result.filePath,
        fileName: path_1.default.basename(result.filePath),
    };
}
//# sourceMappingURL=notaCreditoPdf.service.js.map