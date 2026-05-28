import PDFDocument from "pdfkit";
import axios from "axios";
import fs from "fs";
import path from "path";
import { uploadPDFtoCloudinary } from "../utils/uploadPDFtoCloudinary";
import prisma from "../../prisma";

type Product = {
  name: string;
  quantity: number;
  price: number;
};

type TipoCliente = "Consumidor Final" | "Cliente" | "Mayorista";

const POS_LOCAL_URL = process.env.POS_LOCAL_URL;
const PAGE_WIDTH = 226;

function getLetraComprobante(tipoComprobante: number): string {
  switch (tipoComprobante) {
    case 1:
      return "A";
    case 6:
      return "B";
    case 11:
      return "C";
    case 3:
      return "A";
    case 8:
      return "B";
    case 13:
      return "C";
    default:
      return "?";
  }
}

function getCondicionIVAEmisor(tipoComprobante: number): string {
  if (
    tipoComprobante === 1 ||
    tipoComprobante === 6 ||
    tipoComprobante === 3 ||
    tipoComprobante === 8
  ) {
    return "IVA: RESPONSABLE INSCRIPTO";
  }

  return "IVA: RESPONSABLE MONOTRIBUTO";
}

function getClienteLabel(tipoCliente?: TipoCliente): string {
  switch (tipoCliente) {
    case "Mayorista":
      return "CLIENTE MAYORISTA";
    case "Cliente":
      return "CLIENTE";
    case "Consumidor Final":
    default:
      return "CONSUMIDOR FINAL";
  }
}

function getCondicionIVAReceptorLabel(tipoComprobante: number, tipoCliente?: TipoCliente) {
  if (tipoComprobante === 11 || tipoComprobante === 13) {
    return "CONDICIÓN IVA RECEPTOR: CONSUMIDOR FINAL";
  }

  if (tipoCliente === "Mayorista" || tipoCliente === "Cliente") {
    return "CONDICIÓN IVA RECEPTOR: RESPONSABLE INSCRIPTO / SEGÚN PADRÓN";
  }

  return "CONDICIÓN IVA RECEPTOR: CONSUMIDOR FINAL";
}

function formatCurrency(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDateAR(date: Date) {
  return new Date(date).toLocaleDateString("es-AR");
}

function formatTimeAR(date: Date) {
  return new Date(date).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function generarFacturaAfipPDF({
  tipoComprobante,
  puntoVenta,
  saleId,
  numero,
  fechaEmision,
  nombreCliente = "A CONSUMIDOR FINAL ***********",
  domicilioCliente = "",
  total,
  metodoPago = "EFECTIVO",
  cae,
  caeVto,
  products,
  cuit,
  razonSocial = "VON KÖNIG",
  direccion = "Av. Julio Argentino Roca 288, X5194 Villa Gral. Belgrano, Córdoba",
  qrBase64,

  // 👇 nuevos campos
  tipoCliente = "Consumidor Final",
  documentoCliente,
  telefonoCliente,
}: {
  tipoComprobante: number;
  puntoVenta: number;
  saleId: string;
  numero: number;
  fechaEmision: Date;
  nombreCliente?: string;
  domicilioCliente?: string;
  total: number;
  metodoPago?: string;
  cae: string;
  caeVto: Date;
  cuit: string;
  razonSocial?: string;
  direccion?: string;
  qrBase64?: string | null;
  products?: Product[];

  tipoCliente?: TipoCliente;
  documentoCliente?: string | number;
  telefonoCliente?: string;
}) {
  return new Promise<void>((resolve, reject) => {
    try {
      const basePath = path.resolve("./");
      const filePath = path.join(basePath, `factura-${numero}.pdf`);
      const logoPath = path.join(basePath, "assets/logo-von-konig-png-1.png");

      const letraComprobante = getLetraComprobante(tipoComprobante);
      const condicionIVAEmisor = getCondicionIVAEmisor(tipoComprobante);
      const clienteLabel = getClienteLabel(tipoCliente);
      const condicionIVAReceptor = getCondicionIVAReceptorLabel(
        tipoComprobante,
        tipoCliente
      );

      const doc = new PDFDocument({
        size: [PAGE_WIDTH, 1000],
        margin: 10,
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // --- LOGO ---
      if (fs.existsSync(logoPath)) {
        const imgWidth = 80;
        const x = (PAGE_WIDTH - imgWidth) / 2;
        doc.image(logoPath, x, 8, { width: imgWidth });
        doc.moveDown(4.8);
      }

      // --- ENCABEZADO ---
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(`FACTURA ${letraComprobante}`, { align: "center" });

      doc
        .font("Helvetica")
        .fontSize(9)
        .text(
          `NRO: ${String(puntoVenta).padStart(4, "0")}-${String(numero).padStart(8, "0")}`,
          { align: "center" }
        )
        .text(`${formatDateAR(fechaEmision)} ${formatTimeAR(fechaEmision)}`, {
          align: "center",
        })
        .moveDown(0.8);

      // --- DATOS DEL EMISOR ---
      doc.fontSize(9).text(razonSocial, { align: "center" });

      doc
        .fontSize(8)
        .text(direccion, { align: "center" })
        .text(`CUIT: ${cuit}`, { align: "center" })
        .text(condicionIVAEmisor, { align: "center" })
        .moveDown(0.8);

      // --- CLIENTE ---
      const yCliente = doc.y;
      doc.rect(5, yCliente, 216, 70).stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(clienteLabel, 0, yCliente + 6, {
          align: "center",
          width: PAGE_WIDTH,
        });

      doc
        .font("Helvetica")
        .fontSize(8)
        .text(nombreCliente || "-", {
          align: "center",
          width: PAGE_WIDTH,
        });

      if (documentoCliente) {
        doc.text(`DOC: ${documentoCliente}`, {
          align: "center",
          width: PAGE_WIDTH,
        });
      }

      if (telefonoCliente) {
        doc.text(`TEL: ${telefonoCliente}`, {
          align: "center",
          width: PAGE_WIDTH,
        });
      }

      if (domicilioCliente) {
        doc.text(domicilioCliente, {
          align: "center",
          width: PAGE_WIDTH,
        });
      }

      doc.text(condicionIVAReceptor, {
        align: "center",
        width: PAGE_WIDTH,
      });

      doc.moveDown(1.2);

      // --- DETALLE ---
      doc.font("Helvetica-Bold").fontSize(10).text("DETALLE", {
        align: "center",
      });
      doc.moveDown(0.5);

      if (products && products.length > 0) {
        doc.font("Helvetica").fontSize(8);

        const tableWidth = 195;
        const tableLeft = (PAGE_WIDTH - tableWidth) / 2;
        const tableTop = doc.y;

        products.forEach((prod, index) => {
          const importe = Number(prod.quantity) * Number(prod.price);
          const tableRowTop = tableTop + index * 10;

          doc.text(`${prod.quantity}`, tableLeft, tableRowTop, {
            width: 25,
            align: "left",
          });

          doc.text(
            prod.name.length > 18 ? `${prod.name.slice(0, 18)}…` : prod.name,
            tableLeft + 25,
            tableRowTop,
            {
              width: 100,
              align: "left",
            }
          );

          doc.text(formatCurrency(importe), tableLeft + 125, tableRowTop, {
            width: 60,
            align: "right",
          });
        });
      } else {
        doc.fontSize(8).text("(sin productos)", { align: "center" });
      }

      doc.moveDown(1);

      // --- TOTAL ---
      const yTotal = doc.y;
      doc.rect(5, yTotal, 216, 25).stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .text(`TOTAL ${formatCurrency(total)}`, 0, yTotal + 6, {
          align: "center",
          width: PAGE_WIDTH,
        });

      doc.moveDown(1.5);

      // --- DATOS FISCALES ---
      const yDatos = doc.y;
      doc.rect(5, yDatos, 216, 70).stroke();

      doc.font("Helvetica").fontSize(8);
      doc.text(`FORMA DE PAGO: ${metodoPago}`, 0, yDatos + 5, {
        align: "center",
        width: PAGE_WIDTH,
      });
      doc.text("FACTURA ELECTRÓNICA AUTORIZADA", {
        align: "center",
        width: PAGE_WIDTH,
      });
      doc.text(`CAE: ${cae}`, { align: "center", width: PAGE_WIDTH });
      doc.text(`FV: ${new Date(caeVto).toISOString().split("T")[0]}`, {
        align: "center",
        width: PAGE_WIDTH,
      });
      doc.text("CÓDIGO QR ARCA R.G. 4892/2020", {
        align: "center",
        width: PAGE_WIDTH,
      });

      doc.moveDown(1.5);

      // --- QR ---
      if (qrBase64) {
        const qrPath = path.join(basePath, `qr-${numero}.png`);
        const base64Data = qrBase64.replace(/^data:image\/png;base64,/, "");

        fs.writeFileSync(qrPath, base64Data, "base64");

        const xQR = (PAGE_WIDTH - 110) / 2;
        const yQR = doc.y;

        doc.rect(5, yQR - 3, 216, 125).stroke();
        doc.image(qrPath, xQR, yQR + 5, { width: 110 });

        fs.unlinkSync(qrPath);
        doc.moveDown(13);
      }

      // --- PIE ---
      const yPie = doc.y;
      doc.rect(5, yPie, 216, 60).stroke();

      doc
        .fontSize(7)
        .text("PARA ACCEDER A ESTE COMPROBANTE", 0, yPie + 5, {
          align: "center",
          width: PAGE_WIDTH,
        })
        .text("comprobante.afip.gob.ar", {
          align: "center",
          width: PAGE_WIDTH,
        })
        .moveDown(0.5)
        .text(
          "Este comprobante fue emitido conforme a las disposiciones de AFIP. Gracias por su compra.",
          {
            align: "center",
            width: 216,
            indent: 5,
          }
        );

      doc.end();

      // --- FINALIZAR PDF ---
      stream.on("finish", async () => {
        try {
          console.log("🧾 PDF generado correctamente:", filePath);

          // 📨 Enviar al POS local
          if (POS_LOCAL_URL) {
            const pdfBuffer = await fs.promises.readFile(filePath);

            await axios.post(
              `${POS_LOCAL_URL}/print`,
              {
                pdfBase64: pdfBuffer.toString("base64"),
                factura: {
                  numero,
                  total,
                  metodoPago,
                  fechaEmision,
                  cae,
                  tipoComprobante,
                  letraComprobante,
                  tipoCliente,
                  nombreCliente,
                  documentoCliente,
                },
              },
              {
                headers: {
                  "Content-Type": "application/json",
                },
                timeout: 60000,
              }
            );

            console.log("🖨️ Factura enviada al POS local para impresión");
          } else {
            console.warn("⚠️ POS_LOCAL_URL no configurado, no se imprimió localmente");
          }

          // ☁️ Subir a Cloudinary
          const pdfUrl = await uploadPDFtoCloudinary(filePath);

          // 💾 Guardar URL en la venta
          await prisma.sale.update({
            where: { id: saleId },
            data: { pdfUrl },
          });

          console.log("✅ Factura subida y asociada correctamente");
          resolve();
        } catch (err: any) {
          console.error("⚠️ Error al procesar factura:", err.message);
          reject(err);
        } finally {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log("🧹 Archivo temporal eliminado:", filePath);
          }
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}