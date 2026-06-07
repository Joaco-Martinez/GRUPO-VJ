"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.regenerarFacturaPDFService = regenerarFacturaPDFService;
exports.obtenerTodasLasFacturasService = obtenerTodasLasFacturasService;
exports.obtenerFacturaPDFPathService = obtenerFacturaPDFPathService;
const prisma_1 = __importDefault(require("../prisma"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const facturaPdfGenerator_service_1 = require("./facturaPdfGenerator.service");
async function regenerarFacturaPDFService(saleId, uploadToCloudinary = false) {
    const sale = await prisma_1.default.sale.findUnique({
        where: { id: saleId },
        include: {
            client: true,
            invoiceAfip: true,
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
    if (!sale.invoiceAfip) {
        throw new Error("La venta no tiene factura AFIP asociada");
    }
    const invoice = sale.invoiceAfip;
    const pdfData = {
        factura: {
            cuit: invoice.cuit,
            puntoVenta: invoice.puntoVenta,
            tipoComprobante: invoice.tipoComprobante,
            tipoDoc: invoice.tipoDoc,
            nroDoc: Number(invoice.nroDoc),
            numero: invoice.numero,
            fechaEmision: new Date(invoice.fechaEmision),
            resultado: invoice.resultado,
            cae: invoice.cae || "",
            caeVto: invoice.caeVto ? new Date(invoice.caeVto) : new Date(),
            total: Number(invoice.total),
            neto: Number(invoice.neto),
            iva: Number(invoice.iva),
            condicionIVAReceptor: invoice.condicionIVAReceptor,
            moneda: invoice.moneda,
            urlQR: invoice.urlQR || undefined,
            saleId: sale.id,
        },
        empresa: {
            name: process.env.BUSINESS_NAME || "GRUPO VJ",
            subtitle: process.env.BUSINESS_SUBTITLE || "SANTILLAN JULIO CESAR",
            cuit: process.env.BUSINESS_CUIT || invoice.cuit,
            address: process.env.BUSINESS_ADDRESS ||
                "PASO DE LOS ANDES 893, BARRIO OBSERVATORIO, 5000-CORDOBA",
            phone: process.env.BUSINESS_PHONE || "+54 9 3513 79-0057",
            ivaCondition: process.env.BUSINESS_IVA_CONDITION ||
                undefined,
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
                name: item.product?.name ||
                    item.productNameSnapshot ||
                    "Producto",
                quantity,
                quantityKg,
                price,
                subtotal,
            };
        }),
    };
    const result = await (0, facturaPdfGenerator_service_1.generarFacturaPDF)(pdfData, uploadToCloudinary);
    if (uploadToCloudinary && "cloudinaryUrl" in result && result.cloudinaryUrl) {
        await prisma_1.default.sale.update({
            where: { id: saleId },
            data: {
                pdfUrl: result.cloudinaryUrl,
            },
        });
        await prisma_1.default.invoice.updateMany({
            where: { saleId },
            data: {
                pdfUrl: result.cloudinaryUrl,
            },
        });
    }
    return result;
}
async function obtenerTodasLasFacturasService() {
    const facturas = await prisma_1.default.invoiceAfip.findMany({
        orderBy: {
            fechaEmision: "desc",
        },
        include: {
            sale: {
                include: {
                    client: true,
                },
            },
        },
    });
    return facturas.map((factura) => ({
        id: factura.id,
        saleId: factura.saleId,
        cuit: factura.cuit,
        puntoVenta: factura.puntoVenta,
        tipoComprobante: factura.tipoComprobante,
        tipoDoc: factura.tipoDoc,
        nroDoc: Number(factura.nroDoc),
        numero: factura.numero,
        fechaEmision: factura.fechaEmision,
        resultado: factura.resultado,
        cae: factura.cae,
        caeVto: factura.caeVto,
        total: factura.total,
        neto: factura.neto,
        iva: factura.iva,
        condicionIVAReceptor: factura.condicionIVAReceptor,
        moneda: factura.moneda,
        urlQR: factura.urlQR,
        qrBase64: factura.qrBase64,
        createdAt: factura.createdAt,
        updatedAt: factura.updatedAt,
        relatedInvoiceId: factura.relatedInvoiceId,
        pdfUrl: factura.sale?.pdfUrl || null,
        client: factura.sale?.client
            ? {
                id: factura.sale.client.id,
                nombre: factura.sale.client.nombre,
                apellido: factura.sale.client.apellido,
                dni: factura.sale.client.dni,
                telefono: factura.sale.client.telefono,
                gmail: factura.sale.client.gmail,
                category: factura.sale.client.category,
            }
            : null,
    }));
}
async function obtenerFacturaPDFPathService(saleId) {
    const result = await regenerarFacturaPDFService(saleId, false);
    if (!result.filePath || !fs_1.default.existsSync(result.filePath)) {
        throw new Error("No se pudo generar el archivo PDF");
    }
    return {
        filePath: result.filePath,
        fileName: path_1.default.basename(result.filePath),
    };
}
//# sourceMappingURL=factura-pdf.service.js.map