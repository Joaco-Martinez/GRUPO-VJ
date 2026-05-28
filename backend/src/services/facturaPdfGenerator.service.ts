import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import cloudinary from "cloudinary";
import QRCode from "qrcode";

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export type Product = {
  name: string;
  quantity: number;
  price: number;
};

export type TipoCliente = "Consumidor Final" | "Cliente" | "Mayorista";

export type FacturaPDFData = {
  factura: {
    cuit: string;
    puntoVenta: number;
    tipoComprobante: number;
    tipoDoc: number;
    nroDoc: number;
    numero: number;
    fechaEmision: Date;
    resultado: string;
    cae: string;
    caeVto: Date;
    total: number;
    neto: number;
    iva: number;
    condicionIVAReceptor: number;
    moneda: string;
    urlQR?: string;
    saleId: string;
  };
  cliente: {
    nombre: string;
    apellido?: string;
    dni: string;
    telefono?: string;
    gmail?: string;
    category?: TipoCliente;
  };
  products: Product[];
  logoPath?: string;
};

const COLORS = {
  black: "#111111",
  gray900: "#222222",
  gray700: "#4b5563",
  gray500: "#6b7280",
  gray300: "#d1d5db",
  gray200: "#e5e7eb",
  gray100: "#f3f4f6",
  white: "#ffffff",
};

function getLetraComprobante(tipoComprobante: number): string {
  switch (tipoComprobante) {
    case 1:
    case 3:
      return "A";
    case 6:
    case 8:
      return "B";
    case 11:
    case 13:
      return "C";
    default:
      return "?";
  }
}

function getCondicionIVAEmisor(tipoComprobante: number): string {
  if ([1, 3, 6, 8].includes(tipoComprobante)) {
    return "IVA RESPONSABLE INSCRIPTO";
  }
  return "IVA RESPONSABLE MONOTRIBUTO";
}

function getClienteLabel(tipoCliente?: TipoCliente): string {
  switch (tipoCliente) {
    case "Mayorista":
      return "CLIENTE MAYORISTA";
    case "Cliente":
      return "CLIENTE";
    default:
      return "CONSUMIDOR FINAL";
  }
}

function getCondicionIVAReceptorLabel(
  tipoComprobante: number,
  tipoCliente?: TipoCliente
) {
  if (tipoComprobante === 11 || tipoComprobante === 13) {
    return "CONSUMIDOR FINAL";
  }

  if (tipoCliente === "Mayorista" || tipoCliente === "Cliente") {
    return "RESPONSABLE INSCRIPTO / SEGÚN PADRÓN";
  }

  return "CONSUMIDOR FINAL";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDateAR(date: Date) {
  return new Intl.DateTimeFormat("es-AR").format(new Date(date));
}

function formatTimeAR(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function buildNumeroComprobante(pv: number, nro: number) {
  return `${String(pv).padStart(4, "0")}-${String(nro).padStart(8, "0")}`;
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

async function uploadPDFtoCloudinary(
  filePath: string,
  numero: number
): Promise<string> {
  const res = await cloudinary.v2.uploader.upload(filePath, {
    resource_type: "raw",
    folder: "facturas-afip",
    public_id: `factura-${numero}`,
    overwrite: true,
  });

  return res.secure_url;
}

async function generarQRPNGDesdeURL(url: string, outputPath: string) {
  await QRCode.toFile(outputPath, url, {
    type: "png",
    width: 220,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

function drawBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor?: string
) {
  if (fillColor) {
    doc.save();
    doc.fillColor(fillColor).rect(x, y, w, h).fill();
    doc.restore();
  }

  doc.save();
  doc.lineWidth(0.7).strokeColor(COLORS.gray300).rect(x, y, w, h).stroke();
  doc.restore();
}

function renderPageHeader(
  doc: PDFKit.PDFDocument,
  factura: FacturaPDFData["factura"],
  logoPath?: string
) {
  const pageWidth = doc.page.width;
  const left = 40;
  const right = pageWidth - 40;
  const width = right - left;
  const top = 28;

  // más alto para que no se corte la última línea
  const headerH = 126;
  const emisorW = width * 0.62;
  const letterW = width * 0.12;
  const metaW = width - emisorW - letterW;

  drawBox(doc, left, top, emisorW, headerH);
  drawBox(doc, left + emisorW, top, letterW, headerH);
  drawBox(doc, left + emisorW + letterW, top, metaW, headerH);

  // logo arriba a la izquierda, más contenido
  if (logoPath && fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, left + 14, top + 10, {
        fit: [78, 28],
      });
    } catch {}
  }

  // nombre empresa
  doc
    .font("Helvetica-Bold")
    .fillColor(COLORS.black)
    .fontSize(18.5)
    .text("VON KÖNIG", left + 14, top + 54, {
      width: emisorW - 28,
      align: "left",
      lineBreak: false,
    });

  // bloque emisor: todo posicionado a mano
  doc.font("Helvetica").fontSize(8.6).fillColor(COLORS.gray700);

  const infoX = left + 14;
  const infoW = emisorW - 28;
  let infoY = top + 80;
  const infoGap = 12;

  doc.text("Av. Julio Argentino Roca 288", infoX, infoY, {
    width: infoW,
    lineBreak: false,
  });

  infoY += infoGap;
  doc.text("X5194 Villa General Belgrano, Córdoba", infoX, infoY, {
    width: infoW,
    lineBreak: false,
  });

  infoY += infoGap;
  doc.text(`CUIT: ${factura.cuit}`, infoX, infoY, {
    width: infoW,
    lineBreak: false,
  });

  infoY += infoGap;
  doc.text(getCondicionIVAEmisor(factura.tipoComprobante), infoX, infoY, {
    width: infoW,
    lineBreak: false,
  });

  const letra = getLetraComprobante(factura.tipoComprobante);

  doc
    .font("Helvetica-Bold")
    .fontSize(34)
    .fillColor(COLORS.black)
    .text(letra, left + emisorW, top + 18, {
      width: letterW,
      align: "center",
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .fillColor(COLORS.black)
    .text(
      `COD. ${String(factura.tipoComprobante).padStart(3, "0")}`,
      left + emisorW,
      top + 80,
      {
        width: letterW,
        align: "center",
      }
    );

  // bloque derecho
  const metaX = left + emisorW + letterW + 12;
  const metaWInner = metaW - 24;

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(COLORS.black)
    .text(`FACTURA ${letra}`, metaX, top + 12, {
      width: metaWInner,
      align: "left",
      lineBreak: false,
    });

  doc.font("Helvetica").fontSize(9.3).fillColor(COLORS.gray700);

  let metaY = top + 38;
  const metaGap = 16;

  doc.text(
    `Punto de Venta: ${String(factura.puntoVenta).padStart(4, "0")}`,
    metaX,
    metaY,
    {
      width: metaWInner,
      lineBreak: false,
    }
  );

  metaY += metaGap;
  doc.text(`Comp. Nro: ${String(factura.numero).padStart(8, "0")}`, metaX, metaY, {
    width: metaWInner,
    lineBreak: false,
  });

  metaY += metaGap;
  doc.text(`Fecha de Emisión: ${formatDateAR(factura.fechaEmision)}`, metaX, metaY, {
    width: metaWInner,
    lineBreak: false,
  });

  metaY += metaGap;
  doc.text(`Hora: ${formatTimeAR(factura.fechaEmision)}`, metaX, metaY, {
    width: metaWInner,
    lineBreak: false,
  });

  doc.y = top + headerH + 14;
}

function renderClienteSection(
  doc: PDFKit.PDFDocument,
  factura: FacturaPDFData["factura"],
  cliente: FacturaPDFData["cliente"]
) {
  const left = 40;
  const right = doc.page.width - 40;
  const width = right - left;
  const top = doc.y;

  const sectionH = 78;
  drawBox(doc, left, top, width, sectionH, COLORS.white);

  doc
    .font("Helvetica-Bold")
    .fillColor(COLORS.black)
    .fontSize(10.5)
    .text("DATOS DEL RECEPTOR", left + 12, top + 8, {
      width: width - 24,
    });

  const col1X = left + 12;
  const col2X = left + width / 2 + 6;
  const line1Y = top + 26;
  const line2Y = top + 43;

  doc.font("Helvetica").fontSize(9.2).fillColor(COLORS.gray900);

  doc.text(`Razón social: ${cliente.nombre}`, col1X, line1Y, {
    width: width / 2 - 18,
  });

  doc.text(`CUIT / Doc: ${cliente.dni}`, col2X, line1Y, {
    width: width / 2 - 18,
  });

  doc.text(`Condición: ${getClienteLabel(cliente.category)}`, col1X, line2Y, {
    width: width / 2 - 18,
  });

  doc.text(
    `Condición IVA: ${getCondicionIVAReceptorLabel(
      factura.tipoComprobante,
      cliente.category
    )}`,
    col2X,
    line2Y,
    {
      width: width / 2 - 18,
    }
  );

  if (cliente.gmail) {
    doc.text(`Email: ${cliente.gmail}`, col1X, top + 60, {
      width: width - 24,
    });
  }

  doc.y = top + sectionH + 12;
}

function renderTableHeader(doc: PDFKit.PDFDocument) {
  const left = 40;
  const right = doc.page.width - 40;
  const width = right - left;
  const top = doc.y;

  const rowH = 22;
  drawBox(doc, left, top, width, rowH, COLORS.gray100);

  const cols = {
    qty: 48,
    desc: width - 48 - 92 - 102,
    unit: 92,
    total: 102,
  };

  let x = left;

  doc
    .font("Helvetica-Bold")
    .fontSize(9.2)
    .fillColor(COLORS.black)
    .text("Cant.", x + 6, top + 5, {
      width: cols.qty - 12,
      align: "left",
    });
  x += cols.qty;

  doc.text("Descripción", x + 6, top + 5, {
    width: cols.desc - 12,
    align: "left",
  });
  x += cols.desc;

  doc.text("P. Unitario", x + 6, top + 5, {
    width: cols.unit - 12,
    align: "right",
  });
  x += cols.unit;

  doc.text("Importe", x + 6, top + 5, {
    width: cols.total - 12,
    align: "right",
  });

  doc.y = top + rowH;
}

function ensureTableSpace(doc: PDFKit.PDFDocument, neededHeight: number) {
  const reservedBottomSpace = 215;
  const bottomLimit = doc.page.height - reservedBottomSpace;

  if (doc.y + neededHeight > bottomLimit) {
    throw new Error(
      "La factura excede el espacio disponible de una sola hoja A4. Ajustá el layout o reducí el contenido."
    );
  }
}

function renderProductsTable(doc: PDFKit.PDFDocument, products: Product[]) {
  renderTableHeader(doc);

  const left = 40;
  const right = doc.page.width - 40;
  const width = right - left;

  const cols = {
    qty: 48,
    desc: width - 48 - 92 - 102,
    unit: 92,
    total: 102,
  };

  for (const prod of products) {
    const importe = prod.quantity * prod.price;
    const baseRowMinHeight = 18;

    const descHeight = doc.heightOfString(prod.name, {
      width: cols.desc - 12,
      align: "left",
    });

    const rowH = Math.max(baseRowMinHeight, descHeight + 4);

    ensureTableSpace(doc, rowH);

    const y = doc.y;
    drawBox(doc, left, y, width, rowH);

    let x = left;
    doc.font("Helvetica").fontSize(8.8).fillColor(COLORS.gray900);

    doc.text(String(prod.quantity), x + 6, y + 4, {
      width: cols.qty - 12,
      align: "left",
    });
    x += cols.qty;

    doc.text(prod.name, x + 6, y + 4, {
      width: cols.desc - 12,
      align: "left",
    });
    x += cols.desc;

    doc.text(formatCurrency(prod.price), x + 6, y + 4, {
      width: cols.unit - 12,
      align: "right",
    });
    x += cols.unit;

    doc.text(formatCurrency(importe), x + 6, y + 4, {
      width: cols.total - 12,
      align: "right",
    });

    doc.y = y + rowH;
  }

  doc.moveDown(0.35);
}

function renderTotals(
  doc: PDFKit.PDFDocument,
  factura: FacturaPDFData["factura"]
) {
  const boxW = 220;
  const boxH = 60;
  const x = doc.page.width - 40 - boxW;
  const y = doc.y;

  drawBox(doc, x, y, boxW, boxH);

  const labelX = x + 12;
  const valueX = x + 110;

  doc
    .font("Helvetica")
    .fontSize(9.2)
    .fillColor(COLORS.gray900)
    .text("Subtotal:", labelX, y + 8, { width: 90 })
    .text(formatCurrency(factura.neto), valueX, y + 8, {
      width: 95,
      align: "right",
    });

  doc.text("IVA:", labelX, y + 24, { width: 90 }).text(
    formatCurrency(factura.iva),
    valueX,
    y + 24,
    {
      width: 95,
      align: "right",
    }
  );

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLORS.black)
    .text("TOTAL:", labelX, y + 40, { width: 90 })
    .text(formatCurrency(factura.total), valueX, y + 40, {
      width: 95,
      align: "right",
    });

  doc.y = y + boxH + 8;
}

function renderFiscalSection(
  doc: PDFKit.PDFDocument,
  factura: FacturaPDFData["factura"],
  qrPath?: string
) {
  const left = 40;
  const right = doc.page.width - 40;
  const width = right - left;
  const top = doc.y;

  const sectionH = 125;
  drawBox(doc, left, top, width, sectionH);

  const qrW = 84;
  const qrX = right - qrW - 14;
  const qrY = top + 14;

  const infoX = left + 14;
  const infoW = width - qrW - 36;

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(COLORS.black)
    .text("DATOS FISCALES", infoX, top + 10, { width: infoW });

  let textY = top + 30;

  doc
    .font("Helvetica")
    .fontSize(8.9)
    .fillColor(COLORS.gray900)
    .text("Comprobante autorizado electrónicamente.", infoX, textY, {
      width: infoW,
    });

  textY += 16;
  doc.text(`CAE: ${factura.cae}`, infoX, textY, { width: infoW });

  textY += 16;
  doc.text(`Vencimiento CAE: ${formatDateAR(factura.caeVto)}`, infoX, textY, {
    width: infoW,
  });

  textY += 16;
  doc.text(
    `Comprobante: ${buildNumeroComprobante(factura.puntoVenta, factura.numero)}`,
    infoX,
    textY,
    { width: infoW }
  );

  textY += 18;
  doc
    .fontSize(7.6)
    .fillColor(COLORS.gray700)
    .text("Verificación: comprobante.afip.gob.ar", infoX, textY, {
      width: infoW,
    });

  if (qrPath && fs.existsSync(qrPath)) {
    try {
      doc.image(qrPath, qrX, qrY, { fit: [qrW, qrW] });
    } catch {
      drawBox(doc, qrX, qrY, qrW, qrW, COLORS.gray100);
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.gray700)
        .text("QR no disponible", qrX, qrY + 36, {
          width: qrW,
          align: "center",
        });
    }
  }

  doc.y = top + sectionH + 6;
}

function renderFooter(doc: PDFKit.PDFDocument) {
  const left = 40;
  const y = doc.page.height - 40;

  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(COLORS.gray500)
    .text(
      "Este documento representa un comprobante electrónico autorizado por ARCA/AFIP.",
      left,
      y,
      { width: doc.page.width - 80, align: "center" }
    )
    .text("Verificación: comprobante.afip.gob.ar", left, y + 10, {
      width: doc.page.width - 80,
      align: "center",
    });
}

export async function generarFacturaPDF(
  data: FacturaPDFData,
  uploadToCloudinary = false
) {
  const basePath = path.resolve("./");
  const outputDir = path.join(basePath, "tmp");
  ensureDir(outputDir);

  const filePath = path.join(outputDir, `factura-${data.factura.numero}.pdf`);
  const qrPath = path.join(outputDir, `qr-${data.factura.numero}.png`);
  const logoPath =
    data.logoPath || path.join(basePath, "assets/logo-von-konig-png-1.png");

  try {
    let qrDisponible = false;

    if (data.factura.urlQR) {
      try {
        await generarQRPNGDesdeURL(data.factura.urlQR, qrPath);
        qrDisponible = true;
      } catch {
        qrDisponible = false;
      }
    }

    await new Promise<void>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margin: 0,
          bufferPages: true,
        });

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        renderPageHeader(doc, data.factura, logoPath);
        renderClienteSection(doc, data.factura, data.cliente);
        renderProductsTable(doc, data.products);
        renderTotals(doc, data.factura);
        renderFiscalSection(
          doc,
          data.factura,
          qrDisponible && fs.existsSync(qrPath) ? qrPath : undefined
        );
        renderFooter(doc);

        doc.end();

        stream.on("finish", () => resolve());
        stream.on("error", reject);
      } catch (error) {
        reject(error);
      }
    });

    if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);

    if (!uploadToCloudinary) {
      return { filePath };
    }

    const cloudinaryUrl = await uploadPDFtoCloudinary(
      filePath,
      data.factura.numero
    );
    return { filePath, cloudinaryUrl };
  } catch (error) {
    if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);
    throw error;
  }
}