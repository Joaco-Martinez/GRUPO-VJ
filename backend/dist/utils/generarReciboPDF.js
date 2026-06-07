"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generarTicketPedidoPDF = generarTicketPedidoPDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const POS_LOCAL_URL = process.env.POS_LOCAL_URL;
async function generarTicketPedidoPDF({ saleId, products, total, metodoPago = "EFECTIVO", nombreCliente = "A CONSUMIDOR FINAL", razonSocial = "VON KÖNIG", direccion = "Av. Julio Argentino Roca 288, X5194 Villa Gral. Belgrano, Córdoba", cuit = "20-00000000-0", mensaje = "RECIBO / NOTA DE PEDIDO", }) {
    return new Promise((resolve, reject) => {
        try {
            const basePath = path_1.default.resolve("./");
            const filePath = path_1.default.join(basePath, `ticket-${saleId}.pdf`);
            const logoPath = path_1.default.join(basePath, "assets/logo-von-konig-png-1.png");
            const doc = new pdfkit_1.default({
                size: [226, 650], // altura más real para ticket 58mm
                margin: 6, // márgenes más chicos como en la foto
            });
            const stream = fs_1.default.createWriteStream(filePath);
            doc.pipe(stream);
            // ----------------------------
            // TÍTULO
            // ----------------------------
            doc.font("Helvetica-Bold")
                .fontSize(11)
                .text(mensaje, { align: "center" });
            doc.moveDown(1.2);
            // ----------------------------
            // DATOS COMERCIO
            // ----------------------------
            doc.font("Helvetica-Bold").fontSize(9).text(razonSocial, { align: "center" });
            doc.font("Helvetica").fontSize(8)
                .text(direccion, { align: "center" })
                .text(`CUIT: ${cuit}`, { align: "center" });
            doc.moveDown(1.2);
            // ----------------------------
            // FECHA
            // ----------------------------
            const now = new Date();
            doc.font("Helvetica").fontSize(8)
                .text(`${now.toLocaleDateString("es-AR")} ${now.toLocaleTimeString("es-AR").slice(0, 5)}`, { align: "center" });
            doc.moveDown(1.2);
            // ----------------------------
            // CLIENTE
            // ----------------------------
            doc.font("Helvetica-Bold").fontSize(9).text("CLIENTE", { align: "center" });
            doc.font("Helvetica").fontSize(8).text(nombreCliente, { align: "center" });
            doc.moveDown(1.5);
            // ----------------------------
            // DETALLE
            // ----------------------------
            doc.font("Helvetica-Bold").fontSize(10).text("DETALLE", { align: "center" });
            doc.moveDown(1.2);
            doc.font("Helvetica").fontSize(8);
            const colQty = 8;
            const colName = 28;
            const colPrice = 165;
            products.forEach((prod) => {
                const importe = prod.quantity * prod.price;
                doc.text(`${prod.quantity}x`, colQty, doc.y);
                doc.text(prod.name.length > 18 ? prod.name.slice(0, 18) + "…" : prod.name, colName, doc.y);
                doc.text(`$${importe.toFixed(2)}`, colPrice, doc.y, { width: 60, align: "right" });
                doc.moveDown(0.75);
            });
            doc.moveDown(1.2);
            // ----------------------------
            // TOTAL
            // ----------------------------
            const y = doc.y;
            doc.rect(4, y, 218, 28).stroke();
            doc.font("Helvetica-Bold")
                .fontSize(14)
                .text(`TOTAL $${total.toFixed(2)}`, 0, y + 6, {
                align: "center",
                width: 226,
            });
            doc.moveDown(3);
            // ----------------------------
            // MÉTODO DE PAGO
            // ----------------------------
            doc.font("Helvetica")
                .fontSize(9)
                .text(`Método de pago: ${metodoPago}`, { align: "center" });
            doc.moveDown(1);
            // ----------------------------
            // PIE
            // ----------------------------
            doc.font("Helvetica").fontSize(7)
                .text("Este ticket no es un comprobante fiscal.", { align: "center" })
                .text("Gracias por su compra.", { align: "center" });
            doc.end();
            stream.on("finish", async () => {
                try {
                    if (POS_LOCAL_URL) {
                        const pdfBuffer = await fs_1.default.promises.readFile(filePath);
                        await axios_1.default.post(`${POS_LOCAL_URL}/print`, {
                            pdfBase64: pdfBuffer.toString("base64"),
                            ticket: { saleId, total, metodoPago },
                        }, { headers: { "Content-Type": "application/json" }, timeout: 30000 });
                    }
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
                finally {
                    if (fs_1.default.existsSync(filePath))
                        fs_1.default.unlinkSync(filePath);
                }
            });
        }
        catch (err) {
            reject(err);
        }
    });
}
//# sourceMappingURL=generarReciboPDF.js.map