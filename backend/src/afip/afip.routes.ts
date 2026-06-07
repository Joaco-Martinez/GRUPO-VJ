import express from "express";
import { generarTokenAFIP } from "../afip/wsaa.service";
import { emitirNotaCreditoAFIP } from "../afip/wsfe.service";
import { emitirFacturaA } from "../afip/wsfe-A.service";
import { emitirFacturaB } from "../afip/wsfe-B.service";
import {
  emitirFacturaCConsumidorFinal,
  emitirFacturaCACliente,
} from "../afip/wsfe-C.service";
import { generarFacturaAfipPDF } from "./utils/generarFacturaAfipPDF";
import { financeService } from "../services/finance.service";
import { generarNotaCreditoAfipPDF } from "./utils/generarNotaCreditoAfipPDF";
import { isAfipUnavailable } from "./utils/isAfipUnavailable";
import prisma from "../prisma";

const router = express.Router();

function normalizarDocumento(valor: unknown): string {
  if (valor == null) return "";
  return String(valor).replace(/\D/g, "").trim();
}

function detectarTipoDocumento(valor: unknown): {
  tipoDoc: number;
  nroDoc: number;
  label: "DNI" | "CUIT" | "CUIL";
} | null {
  const limpio = normalizarDocumento(valor);

  if (!limpio) return null;

  if (limpio.length === 7 || limpio.length === 8) {
    return {
      tipoDoc: 96,
      nroDoc: Number(limpio),
      label: "DNI",
    };
  }

  if (limpio.length === 11) {
    const prefijo = limpio.slice(0, 2);

    if (["20", "23", "24", "27"].includes(prefijo)) {
      return {
        tipoDoc: 86,
        nroDoc: Number(limpio),
        label: "CUIL",
      };
    }

    if (["30", "33", "34"].includes(prefijo)) {
      return {
        tipoDoc: 80,
        nroDoc: Number(limpio),
        label: "CUIT",
      };
    }

    return {
      tipoDoc: 80,
      nroDoc: Number(limpio),
      label: "CUIT",
    };
  }

  return null;
}

function mapTipoCliente(clientCategory?: string): "Consumidor Final" | "Cliente" | "Mayorista" {
  if (clientCategory === "Mayorista") return "Mayorista";
  if (clientCategory === "Cliente") return "Cliente";
  return "Consumidor Final";
}

function getNombreCliente(
  client?: {
    nombre?: string | null;
    apellido?: string | null;
  } | null
) {
  const nombre = client?.nombre?.trim() ?? "";
  const apellido = client?.apellido?.trim() ?? "";
  const fullName = `${nombre} ${apellido}`.trim();

  return fullName || "A CONSUMIDOR FINAL ***********";
}

function getDocumentoCliente(client: any, facturaData: any) {
  if (client?.dni) return String(client.dni);
  if (facturaData?.nroDoc) return String(facturaData.nroDoc);
  return undefined;
}

function getDomicilioCliente(client: any) {
  return [client?.address, client?.locality, client?.province]
    .filter(Boolean)
    .join(", ");
}

function numberOrZero(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function mapProductsFromSaleOrBody(reqBody: any, sale: any) {
  if (reqBody.products && Array.isArray(reqBody.products)) {
    return reqBody.products.map((item: any) => {
      const quantity = numberOrZero(item.quantity);
      const quantityKg =
        item.quantityKg !== null && item.quantityKg !== undefined
          ? numberOrZero(item.quantityKg)
          : undefined;

      const price = numberOrZero(item.price);

      const subtotal =
        item.subtotal !== undefined && item.subtotal !== null
          ? numberOrZero(item.subtotal)
          : quantityKg !== undefined && quantityKg > 0
          ? quantityKg * price
          : quantity * price;

      return {
        name: item.name ?? "Producto",
        quantity,
        ...(quantityKg !== undefined ? { quantityKg } : {}),
        price,
        subtotal,
      };
    });
  }

  return sale.items.map((item: any) => {
    const quantity = numberOrZero(item.quantity);
    const quantityKg =
      item.quantityKg !== null && item.quantityKg !== undefined
        ? numberOrZero(item.quantityKg)
        : undefined;

    const price = numberOrZero(item.price);

    const subtotal =
      item.subtotal !== undefined && item.subtotal !== null
        ? numberOrZero(item.subtotal)
        : quantityKg !== undefined && quantityKg > 0
        ? quantityKg * price
        : quantity * price;

    return {
      name: item.product?.name ?? "Producto",
      quantity,
      ...(quantityKg !== undefined ? { quantityKg } : {}),
      price,
      subtotal,
    };
  });
}

function getMetodoPago(reqBody: any, sale: any) {
  if (reqBody.metodoPago) return reqBody.metodoPago;
  if (reqBody.paymentMethod) return reqBody.paymentMethod;

  if (sale.payments && sale.payments.length > 0) {
    return sale.payments
      .map(
        (p: any) =>
          `${p.method}: ${Number(p.amount).toLocaleString("es-AR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
      )
      .join(" | ");
  }

  return sale.paymentMethod || "EFECTIVO";
}

function getFacturaQrUrl(factura: any): string | undefined {
  return factura?.urlQR ?? factura?.qrUrl ?? factura?.qrURL ?? undefined;
}

router.get("/token", async (_req, res) => {
  try {
    const data = await generarTokenAFIP();
    res.json({ ok: true, data });
  } catch (err: any) {
    console.error("❌ Error detallado en /afip/token:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

router.get("/prueba", async (_req, res) => {
  res.json({ ok: true, message: "La ruta de prueba funciona correctamente." });
});

router.post("/facturar", async (req, res) => {
  const { saleId, ...facturaData } = req.body;

  console.log("➡️ POST /afip/facturar");
  console.log("📦 Body recibido:", {
    saleId,
    tipoComprobante: facturaData.tipoComprobante,
    tipoDoc: facturaData.tipoDoc,
    nroDoc: facturaData.nroDoc,
  });

  try {
    if (!saleId) {
      return res.status(400).json({ ok: false, error: "saleId es requerido" });
    }

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        invoiceAfip: true,
        client: true,
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
      },
    });

    if (!sale) {
      return res.status(404).json({ ok: false, error: "Venta no encontrada" });
    }

    if (sale.isInvoiced || sale.invoiceAfip || sale.invoiceStatus === "INVOICED") {
      return res.status(400).json({
        ok: false,
        error: "Esta venta ya fue facturada.",
      });
    }

    if (sale.invoiceStatus === "PENDING_AFIP") {
      return res.status(202).json({
        ok: true,
        invoiceStatus: "PENDING_AFIP",
        message: "Esta venta ya tiene factura pendiente.",
        nextRetryAt: sale.nextRetryAt,
      });
    }

    await prisma.sale.update({
      where: { id: saleId },
      data: {
        afipPayloadJson: req.body,
        afipLastError: null,
      },
    });

    let factura;

    if (facturaData.tipoComprobante === 1) {
      const docDetectado =
        facturaData.nroDoc != null ? detectarTipoDocumento(facturaData.nroDoc) : null;

      if (!docDetectado) {
        return res.status(400).json({
          ok: false,
          error: "Para Factura A el documento del cliente es obligatorio y debe ser válido.",
        });
      }

      factura = await emitirFacturaA({
        saleId,
        cuit: facturaData.cuit,
        nroDoc: docDetectado.nroDoc,
        importe: facturaData.importe,
        condicionIVAReceptor: facturaData.condicionIVAReceptor,
      });
    } else if (facturaData.tipoComprobante === 6) {
  const docLimpio = normalizarDocumento(facturaData.nroDoc);

  const quiereConsumidorFinal =
    Number(facturaData.tipoDoc) === 99 ||
    docLimpio === "" ||
    Number(docLimpio) === 0;

  if (quiereConsumidorFinal) {
    factura = await emitirFacturaB({
      saleId,
      cuit: facturaData.cuit,
      tipoDoc: 99,
      nroDoc: 0,
      importe: facturaData.importe,
      condicionIVAReceptor: 5,
    });
  } else {
    const docDetectado = detectarTipoDocumento(facturaData.nroDoc);

    if (!docDetectado) {
      return res.status(400).json({
        ok: false,
        error:
          "Para Factura B con cliente, el documento debe ser válido. Puede ser DNI, CUIT o CUIL.",
      });
    }

    console.log("🪪 Documento detectado para Factura B:", docDetectado);

    factura = await emitirFacturaB({
      saleId,
      cuit: facturaData.cuit,
      tipoDoc: docDetectado.tipoDoc,
      nroDoc: docDetectado.nroDoc,
      importe: facturaData.importe,
      condicionIVAReceptor: facturaData.condicionIVAReceptor,
    });
  }
    } else if (facturaData.tipoComprobante === 11) {
      const docLimpio = normalizarDocumento(facturaData.nroDoc);

      const quiereConsumidorFinal =
        Number(facturaData.tipoDoc) === 99 ||
        docLimpio === "" ||
        Number(docLimpio) === 0;

      if (quiereConsumidorFinal) {
        factura = await emitirFacturaCConsumidorFinal({
          saleId,
          cuit: facturaData.cuit,
          importe: facturaData.importe,
        });
      } else {
        const docDetectado = detectarTipoDocumento(facturaData.nroDoc);

        if (!docDetectado) {
          return res.status(400).json({
            ok: false,
            error:
              "Para Factura C con cliente, el documento debe ser válido. Puede ser DNI, CUIT o CUIL.",
          });
        }

        console.log("🪪 Documento detectado para Factura C:", docDetectado);

        factura = await emitirFacturaCACliente({
          saleId,
          cuit: facturaData.cuit,
          tipoDoc: docDetectado.tipoDoc,
          nroDoc: docDetectado.nroDoc,
          importe: facturaData.importe,
          condicionIVAReceptor: facturaData.condicionIVAReceptor,
        });
      }
    } else {
      return res.status(400).json({
        ok: false,
        error: "Tipo de comprobante no soportado. Usá 1 (A), 6 (B) o 11 (C).",
      });
    }

    const safeFactura = JSON.parse(
      JSON.stringify(factura, (_, v) => (typeof v === "bigint" ? v.toString() : v))
    );

    if (factura.resultado === "A" && factura.cae) {
      let posDisconnected = false;
      let posErrorMessage: string | null = null;

      try {
        const client = sale.client;

        const tipoCliente = mapTipoCliente(client?.category);
        const nombreCliente = getNombreCliente(client);
        const documentoCliente = getDocumentoCliente(client, facturaData);
        const telefonoCliente = client?.telefono ?? undefined;
        const domicilioCliente = getDomicilioCliente(client);

        const products = mapProductsFromSaleOrBody(req.body, sale);
        const metodoPago = getMetodoPago(req.body, sale);

        const qrUrl = getFacturaQrUrl(factura);

        console.log("🧾 QR URL enviado al agente:", qrUrl ?? "SIN QR URL");

        await generarFacturaAfipPDF({
          tipoComprobante: Number(factura.tipoComprobante),
          puntoVenta: Number(factura.puntoVenta),
          saleId,
          numero: Number(factura.numero),
          fechaEmision: factura.fechaEmision
            ? new Date(factura.fechaEmision)
            : new Date(),
          total: Number(factura.total),
          products,
          metodoPago,
          cae: String(factura.cae),
          caeVto: factura.caeVto ? new Date(factura.caeVto) : new Date(),
          cuit: String(factura.cuit),

          qrBase64: factura.qrBase64 ?? null,
          qrUrl,

          tipoCliente,
          nombreCliente,
          documentoCliente,
          telefonoCliente,
          domicilioCliente,
        });

        console.log("✅ PDF generado, subido y ticket enviado correctamente");
      }  catch (err: any) {
    console.error("❌ ERROR EN /afip/facturar");
    console.error("📛 Message:", err?.message);
    console.error("📛 Name:", err?.name);
    console.error("📛 Stack:", err?.stack);

    if (err?.response) {
      console.error("🌐 Error response status:", err.response.status);
      console.error("🌐 Error response data:", err.response.data);
      console.error("🌐 Error response headers:", err.response.headers);
    }

    if (err?.cause) {
      console.error("🧨 Cause:", err.cause);
    }

    if (err?.code) {
      console.error("🔢 Error code:", err.code);
    }

    if (isAfipUnavailable(err)) {
      const nextRetryAt = new Date(Date.now() + 5 * 60 * 1000);

      try {
        await prisma.sale.update({
          where: { id: saleId },
          data: {
            invoiceStatus: "PENDING_AFIP",
            afipLastError: "AFIP_UNAVAILABLE",
            nextRetryAt,
            retryCount: { increment: 1 },
            afipPayloadJson: req.body,
          },
        });
      } catch (updateErr: any) {
        console.error("❌ No se pudo marcar PENDING_AFIP:", updateErr?.message);
      }

      return res.status(202).json({
        ok: true,
        invoiceStatus: "PENDING_AFIP",
        nextRetryAt: nextRetryAt.toISOString(),
      });
    }

    return res.status(500).json({
      ok: false,
      error: err?.message || "Error interno al facturar",
      detail: err?.response?.data ?? null,
      code: err?.code ?? null,
    });
  }

      return res.status(200).json({
        ok: true,
        invoiceStatus: "INVOICED",
        factura: safeFactura,
        ...(posDisconnected
          ? {
              warning: "AFIP aprobó y se facturó, pero el POS está desconectado.",
              posError: posErrorMessage,
            }
          : {}),
      });
    }

    await prisma.sale.update({
      where: { id: saleId },
      data: {
        invoiceStatus: "ERROR",
        afipLastError: "AFIP_REJECTED",
      },
    });

    return res.status(409).json({
      ok: false,
      invoiceStatus: "REJECTED",
      message: "AFIP rechazó la factura.",
      factura: safeFactura,
    });
  } catch (err: any) {
    console.error("❌ ERROR EN /afip/facturar");
    console.error("📛 Message:", err?.message);

    if (isAfipUnavailable(err)) {
      const nextRetryAt = new Date(Date.now() + 5 * 60 * 1000);

      await prisma.sale.update({
        where: { id: saleId },
        data: {
          invoiceStatus: "PENDING_AFIP",
          afipLastError: "AFIP_UNAVAILABLE",
          nextRetryAt,
          retryCount: { increment: 1 },
          afipPayloadJson: req.body,
        },
      });

      return res.status(202).json({
        ok: true,
        invoiceStatus: "PENDING_AFIP",
        nextRetryAt: nextRetryAt.toISOString(),
      });
    }

    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/nota-credito", async (req, res) => {
  try {
    const {
      saleId,
      facturaOriginalId,
      motivo = "Devolución de productos",
      importe,
    } = req.body;

    const userId = (req as any).user?.id || "unknown";

    const facturaOriginal = await prisma.invoiceAfip.findUnique({
      where: { id: facturaOriginalId },
      include: {
        sale: {
          include: {
            items: { include: { product: true } },
            client: true,
          },
        },
      },
    });

    if (!facturaOriginal) {
      return res.status(404).json({
        ok: false,
        error: "Factura original no encontrada",
      });
    }

    const notaCredito = await emitirNotaCreditoAFIP({
      saleId,
      facturaOriginalId,
      motivo,
      importe,
    });

    const safeNotaCredito = JSON.parse(
      JSON.stringify(notaCredito, (_, v) =>
        typeof v === "bigint" ? v.toString() : v
      )
    );

    let posDisconnected = false;
    let posErrorMessage: string | null = null;

    try {
      await generarNotaCreditoAfipPDF({
        saleId,
        tipoComprobante: notaCredito.tipoComprobante,
        puntoVenta: notaCredito.puntoVenta,
        numero: notaCredito.numero,
        fechaEmision: notaCredito.fechaEmision,
        nombreCliente: facturaOriginal.sale?.client
          ? `${facturaOriginal.sale.client.nombre} ${facturaOriginal.sale.client.apellido}`
          : "A CONSUMIDOR FINAL ***********",
        domicilioCliente: "",
        total: notaCredito.total,
        metodoPago: facturaOriginal.sale?.paymentMethod || "EFECTIVO",
        cae: notaCredito.cae || "—",
        caeVto: notaCredito.caeVto || new Date(),
        cuit: notaCredito.cuit,
        qrBase64: notaCredito.qrBase64 || null,
        products: facturaOriginal.sale?.items.map((i: any) => ({
          name: i.product.name,
          quantity: i.quantity,
          quantityKg: i.quantityKg ?? undefined,
          price: i.price,
          subtotal: i.subtotal,
        })),
      });
    } catch (printErr: any) {
      posDisconnected = true;

      const status = printErr?.response?.status;
      const ngrokCode = printErr?.response?.headers?.["ngrok-error-code"];
      const url = printErr?.config?.url;

      posErrorMessage =
        ngrokCode === "ERR_NGROK_3200" || status === 404
          ? `AFIP aprobó y se generó la nota de crédito, pero el POS está desconectado. Endpoint: ${
              url ?? "desconocido"
            }`
          : `AFIP aprobó y se generó la nota de crédito, pero falló la impresión en el POS. ${
              printErr?.message ?? ""
            }`;

      console.warn("⚠️", posErrorMessage);
    }

    await financeService.registerCreditNote(
      importe,
      `Nota de crédito: ${motivo}`,
      userId
    );

    return res.status(200).json({
      ok: true,
      message: posDisconnected
        ? "Nota de crédito generada en AFIP y registrada en finanzas, pero el POS está desconectado."
        : "Nota de crédito generada en AFIP, impresa y registrada en finanzas.",
      notaCredito: safeNotaCredito,
      ...(posDisconnected
        ? {
            warning: "AFIP aprobó, pero no se pudo imprimir la nota de crédito.",
            posError: posErrorMessage,
          }
        : {}),
    });
  } catch (err: any) {
    console.error("❌ Error en /afip/nota-credito:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/factura-by-sale/:saleId", async (req, res) => {
  try {
    const { saleId } = req.params;

    const factura = await prisma.invoiceAfip.findUnique({
      where: { saleId },
    });

    if (!factura) {
      return res.status(404).json({ ok: false, error: "Factura no encontrada" });
    }

    const safeFactura = JSON.parse(
      JSON.stringify(factura, (_, v) => (typeof v === "bigint" ? v.toString() : v))
    );

    res.status(200).json(safeFactura);
  } catch (err: any) {
    console.error("❌ Error en /factura-by-sale:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;