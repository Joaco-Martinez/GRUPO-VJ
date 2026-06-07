"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerUltimoComprobanteAFIP = obtenerUltimoComprobanteAFIP;
exports.emitirFacturaAFIP = emitirFacturaAFIP;
exports.emitirNotaCreditoAFIP = emitirNotaCreditoAFIP;
const axios_1 = __importDefault(require("axios"));
const xml2js_1 = __importDefault(require("xml2js"));
const fs_1 = __importDefault(require("fs"));
const prisma_1 = __importDefault(require("../prisma"));
const wsaa_service_1 = require("./wsaa.service");
const cbteCounter_service_1 = require("./cbteCounter.service");
const qrAfip_service_1 = require("./qrAfip.service");
const fecha_1 = require("./utils/fecha");
const WSFE_URL = "https://servicios1.afip.gov.ar/wsfev1/service.asmx";
const PTO_VTA_REAL = 7;
// ===================== HELPERS =====================
function pickCbteResult(result) {
    const det = result?.FeDetResp?.FECAEDetResponse;
    const cab = result?.FeCabResp;
    return {
        det,
        cae: det?.CAE ?? null,
        vto: det?.CAEFchVto ?? null,
        resultado: det?.Resultado ?? cab?.Resultado ?? null,
    };
}
const toArray = (x) => (x ? (Array.isArray(x) ? x : [x]) : []);
function printAfipList(title, list) {
    if (!list?.length)
        return;
    console.log(`\n================ ${title} (${list.length}) ================`);
    list.forEach((e, i) => {
        const code = e?.Code ?? "N/A";
        const msg = e?.Msg ?? JSON.stringify(e);
        console.log(`${i + 1}. [${code}] ${msg}`);
    });
}
function logAfipFull(result) {
    console.log("🧾 AFIP RESULT RAW:", JSON.stringify(result, null, 2));
    const generalErrors = toArray(result?.Errors?.Err);
    const events = toArray(result?.Events?.Evt);
    const detResp = result?.FeDetResp?.FECAEDetResponse;
    const detErrors = toArray(detResp?.Errors?.Err);
    const detObs = toArray(detResp?.Observaciones?.Obs);
    printAfipList("AFIP ERRORES GENERALES", generalErrors);
    printAfipList("AFIP EVENTS", events);
    printAfipList("AFIP ERRORES POR DETALLE", detErrors);
    printAfipList("AFIP OBSERVACIONES", detObs);
    console.log("\n📌 AFIP CAB:", result?.FeCabResp);
    console.log("📌 AFIP DET:", detResp);
    // Si querés que “explote” y te devuelva todos los mensajes juntos:
    const allMsgs = [
        ...generalErrors.map((e) => `[${e.Code}] ${e.Msg}`),
        ...events.map((e) => `[${e.Code}] ${e.Msg}`),
        ...detErrors.map((e) => `[${e.Code}] ${e.Msg}`),
        ...detObs.map((e) => `[${e.Code}] ${e.Msg}`),
    ];
    return allMsgs;
}
async function enviarAImpresion(pdfPath, facturaData) {
    const localPOS = process.env.POS_LOCAL_URL; // Ej: http://192.168.0.50:3002 o https://pos-local.ngrok-free.app
    if (!localPOS) {
        console.warn("⚠️ POS_LOCAL_URL no configurado. No se enviará a impresión.");
        return;
    }
    try {
        const pdfBuffer = await fs_1.default.promises.readFile(pdfPath);
        console.log("📦 Enviando PDF directamente al POS local...");
        await axios_1.default.post(`${localPOS}/print`, {
            pdfBase64: pdfBuffer.toString("base64"),
            factura: facturaData,
        });
        console.log("🖨️ Enviada orden de impresión con PDF embebido.");
    }
    catch (err) {
        console.error("❌ Error al enviar a impresión:", err?.message || err);
    }
}
// ===================== AFIP: ULTIMO COMPROBANTE =====================
async function obtenerUltimoComprobanteAFIP({ cuit, puntoVenta, tipoComprobante, }) {
    const { token, sign } = await (0, wsaa_service_1.getValidToken)();
    const soapEnvelope = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
    <soapenv:Header/>
    <soapenv:Body>
      <ar:FECompUltimoAutorizado>
        <ar:Auth>
          <ar:Token>${token}</ar:Token>
          <ar:Sign>${sign}</ar:Sign>
          <ar:Cuit>${cuit}</ar:Cuit>
        </ar:Auth>
        <ar:PtoVta>${puntoVenta}</ar:PtoVta>
        <ar:CbteTipo>${tipoComprobante}</ar:CbteTipo>
      </ar:FECompUltimoAutorizado>
    </soapenv:Body>
  </soapenv:Envelope>`;
    const { data } = await axios_1.default.post(WSFE_URL, soapEnvelope, {
        headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado",
        },
        timeout: 15000,
    });
    const parsed = await xml2js_1.default.parseStringPromise(data, { explicitArray: false });
    const body = parsed?.["soap:Envelope"]?.["soap:Body"];
    if (!body)
        throw new Error("Respuesta SOAP inválida (sin Body)");
    if (body["soap:Fault"]) {
        throw new Error(`SOAP Fault: ${body["soap:Fault"]?.faultstring || "sin faultstring"}`);
    }
    const result = body["FECompUltimoAutorizadoResponse"]?.["FECompUltimoAutorizadoResult"];
    if (!result)
        throw new Error("No se encontró FECompUltimoAutorizadoResult");
    console.log("🧾 AFIP FECompUltimoAutorizado RAW:", JSON.stringify(result, null, 2));
    const errs = toArray(result?.Errors?.Err);
    if (errs.length) {
        console.error("🧨 AFIP ERRORS (FECompUltimoAutorizado):");
        errs.forEach((e) => console.error(`  ❌ [${e.Code}] ${e.Msg}`));
        throw new Error(errs.map((e) => `[${e.Code}] ${e.Msg}`).join(" | "));
    }
    const cbteNro = Number(result?.CbteNro ?? 0);
    console.log(`📄 Último comprobante autorizado (AFIP): ${cbteNro}`);
    return cbteNro;
}
// ===================== FACTURA AFIP =====================
async function emitirFacturaAFIP({ saleId, cuit, 
// lo dejamos para no romper llamadas existentes, pero NO lo usamos
puntoVenta: _puntoVenta, tipoComprobante, tipoDoc, nroDoc, importe, condicionIVAReceptor = 5, }) {
    const puntoVenta = PTO_VTA_REAL;
    console.log("🧾 Enviando solicitud de factura a AFIP (producción)...", {
        saleId,
        puntoVenta,
        tipoComprobante,
        tipoDoc,
        nroDoc,
        importe,
    });
    // 🚫 Verifica si la venta ya fue facturada
    const existing = await prisma_1.default.sale.findUnique({
        where: { id: saleId },
        select: { isInvoiced: true },
    });
    if (!existing)
        throw new Error("Venta no encontrada");
    if (existing.isInvoiced)
        throw new Error("⚠️ Esta venta ya fue facturada y no puede repetirse");
    // ✅ 1) SIEMPRE tomar el número desde AFIP para evitar 10016
    const ultimoAfip = await obtenerUltimoComprobanteAFIP({
        cuit,
        puntoVenta,
        tipoComprobante,
    });
    const siguiente = ultimoAfip + 1;
    // ✅ 1b) Sync contador local si quedó atrás (evita que tu cbteCounter te vuelva a dar números viejos)
    try {
        // Si tu servicio no tiene esto, no rompe nada (por eso el try)
        await cbteCounter_service_1.cbteCounterService.commitUsed(puntoVenta, tipoComprobante, ultimoAfip);
    }
    catch (e) {
        console.warn("⚠️ No pude sincronizar cbteCounterService con AFIP (no es crítico):", e?.message || e);
    }
    // 2) Token/sign
    const { token, sign } = await (0, wsaa_service_1.getValidToken)();
    // 3) Importes
    let neto = importe;
    let iva21 = 0;
    if (tipoComprobante !== 11) {
        neto = +(importe / 1.21).toFixed(2);
        iva21 = +(importe - neto).toFixed(2);
    }
    const fecha = (0, fecha_1.afipFechaAR)();
    // 4) XML
    const soapEnvelope = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
    <soapenv:Header/>
    <soapenv:Body>
      <ar:FECAESolicitar>
        <ar:Auth>
          <ar:Token>${token}</ar:Token>
          <ar:Sign>${sign}</ar:Sign>
          <ar:Cuit>${cuit}</ar:Cuit>
        </ar:Auth>
        <ar:FeCAEReq>
          <ar:FeCabReq>
            <ar:CantReg>1</ar:CantReg>
            <ar:PtoVta>${puntoVenta}</ar:PtoVta>
            <ar:CbteTipo>${tipoComprobante}</ar:CbteTipo>
          </ar:FeCabReq>
          <ar:FeDetReq>
            <ar:FECAEDetRequest>
              <ar:Concepto>1</ar:Concepto>
              <ar:DocTipo>${tipoDoc}</ar:DocTipo>
              <ar:DocNro>${nroDoc}</ar:DocNro>
              <ar:CbteDesde>${siguiente}</ar:CbteDesde>
              <ar:CbteHasta>${siguiente}</ar:CbteHasta>
              <ar:CbteFch>${fecha}</ar:CbteFch>
              <ar:ImpTotal>${importe.toFixed(2)}</ar:ImpTotal>
              <ar:ImpTotConc>0.00</ar:ImpTotConc>
              <ar:ImpNeto>${neto.toFixed(2)}</ar:ImpNeto>
              <ar:ImpOpEx>0.00</ar:ImpOpEx>
              <ar:ImpTrib>0.00</ar:ImpTrib>
              <ar:ImpIVA>${iva21.toFixed(2)}</ar:ImpIVA>
              <ar:MonId>PES</ar:MonId>
              <ar:MonCotiz>1.00</ar:MonCotiz>
              ${tipoComprobante !== 11
        ? `
              <ar:Iva>
                <ar:AlicIva>
                  <ar:Id>5</ar:Id>
                  <ar:BaseImp>${neto.toFixed(2)}</ar:BaseImp>
                  <ar:Importe>${iva21.toFixed(2)}</ar:Importe>
                </ar:AlicIva>
              </ar:Iva>`
        : ""}
            </ar:FECAEDetRequest>
          </ar:FeDetReq>
        </ar:FeCAEReq>
      </ar:FECAESolicitar>
    </soapenv:Body>
  </soapenv:Envelope>`;
    // 5) Enviar
    const { data } = await axios_1.default.post(WSFE_URL, soapEnvelope, {
        headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: "http://ar.gov.afip.dif.FEV1/FECAESolicitar",
        },
        timeout: 15000,
    });
    // 6) Parse
    const parsed = await xml2js_1.default.parseStringPromise(data, { explicitArray: false });
    const soapBody = parsed?.["soap:Envelope"]?.["soap:Body"];
    if (!soapBody)
        throw new Error("Respuesta SOAP inválida (sin Body)");
    if (soapBody["soap:Fault"]) {
        throw new Error(`Error SOAP: ${soapBody["soap:Fault"]?.faultstring || "sin faultstring"}`);
    }
    const result = soapBody["FECAESolicitarResponse"]?.["FECAESolicitarResult"];
    if (!result)
        throw new Error("No se encontró FECAESolicitarResult");
    // ✅ LOG FULL AFIP (TODOS los errores/obs/eventos)
    const allAfipMessages = logAfipFull(result);
    const { cae, vto, resultado } = pickCbteResult(result);
    console.log(`✅ Resultado AFIP: ${resultado ?? "?"} ${cae ? `- CAE ${cae}` : ""}`);
    // Si vino rechazado y AFIP mandó mensajes, los dejamos en sale.afipLastError si querés
    if (resultado !== "A") {
        try {
            await prisma_1.default.sale.update({
                where: { id: saleId },
                data: {
                    invoiceStatus: "ERROR",
                    afipLastError: allAfipMessages?.slice(0, 1800)?.join(" | ") || "Rechazado por AFIP",
                },
            });
        }
        catch { }
    }
    // 7) QR (solo si hay CAE)
    const qr = cae
        ? await (0, qrAfip_service_1.generarQR)({
            fecha,
            cuit,
            puntoVenta,
            tipoComprobante,
            numero: siguiente,
            total: importe,
            tipoDoc,
            nroDoc,
            cae,
        })
        : { urlQR: null, qrDataURL: null };
    // 8) Guardar en DB (sin mover schema)
    console.log("🧾 Intento DB save:", {
        saleId,
        puntoVenta,
        tipoComprobante,
        numero: siguiente,
        resultado,
        cae,
    });
    // 8a) Si ya existe factura por esta venta => update
    const existingBySale = await prisma_1.default.invoiceAfip.findUnique({
        where: { saleId }, // saleId es @unique (nullable)
    });
    let factura;
    if (existingBySale) {
        factura = await prisma_1.default.invoiceAfip.update({
            where: { id: existingBySale.id },
            data: {
                cuit,
                puntoVenta,
                tipoComprobante,
                tipoDoc,
                nroDoc: BigInt(nroDoc),
                numero: siguiente,
                fechaEmision: new Date(),
                resultado: resultado ?? "R",
                cae,
                caeVto: vto
                    ? new Date(`${String(vto).slice(0, 4)}-${String(vto).slice(4, 6)}-${String(vto).slice(6, 8)}`)
                    : null,
                total: importe,
                neto,
                iva: iva21,
                condicionIVAReceptor,
                urlQR: qr.urlQR,
                qrBase64: qr.qrDataURL,
            },
        });
    }
    else {
        // 8b) Si no existe por saleId, puede existir por cbte (puntoVenta+tipoComprobante+numero)
        const existingByCbte = await prisma_1.default.invoiceAfip.findFirst({
            where: {
                puntoVenta,
                tipoComprobante,
                numero: siguiente,
            },
        });
        if (existingByCbte) {
            // Si ya está ligado a otra venta => conflicto real, no lo pises
            if (existingByCbte.saleId && existingByCbte.saleId !== saleId) {
                throw new Error(`⚠️ Conflicto: el comprobante ${puntoVenta}/${tipoComprobante}/${siguiente} ya está asociado a otra venta (${existingByCbte.saleId}).`);
            }
            // Si estaba suelto (saleId null) o es el mismo, actualizás y lo vinculás
            factura = await prisma_1.default.invoiceAfip.update({
                where: { id: existingByCbte.id },
                data: {
                    sale: { connect: { id: saleId } },
                    cuit,
                    tipoDoc,
                    nroDoc: BigInt(nroDoc),
                    fechaEmision: new Date(),
                    resultado: resultado ?? "R",
                    cae,
                    caeVto: vto
                        ? new Date(`${String(vto).slice(0, 4)}-${String(vto).slice(4, 6)}-${String(vto).slice(6, 8)}`)
                        : null,
                    total: importe,
                    neto,
                    iva: iva21,
                    condicionIVAReceptor,
                    urlQR: qr.urlQR,
                    qrBase64: qr.qrDataURL,
                },
            });
        }
        else {
            // 8c) No existe de ninguna forma => create normal
            factura = await prisma_1.default.invoiceAfip.create({
                data: {
                    sale: { connect: { id: saleId } },
                    cuit,
                    puntoVenta,
                    tipoComprobante,
                    tipoDoc,
                    nroDoc: BigInt(nroDoc),
                    numero: siguiente,
                    fechaEmision: new Date(),
                    resultado: resultado ?? "R",
                    cae,
                    caeVto: vto
                        ? new Date(`${String(vto).slice(0, 4)}-${String(vto).slice(4, 6)}-${String(vto).slice(6, 8)}`)
                        : null,
                    total: importe,
                    neto,
                    iva: iva21,
                    condicionIVAReceptor,
                    urlQR: qr.urlQR,
                    qrBase64: qr.qrDataURL,
                },
            });
        }
    }
    // 9) SOLO si aprobó: marcar facturada + confirmar contador
    if (resultado === "A" && cae) {
        await cbteCounter_service_1.cbteCounterService.commitUsed(puntoVenta, tipoComprobante, siguiente);
        await prisma_1.default.sale.update({
            where: { id: saleId },
            data: { isInvoiced: true, invoiceStatus: "INVOICED" },
        });
        console.log("💾 Factura APROBADA. Contador confirmado y venta facturada:", factura.id);
    }
    else {
        console.warn("⚠️ Factura NO aprobada. NO se actualiza contador ni isInvoiced.", {
            saleId,
            puntoVenta,
            tipoComprobante,
            numero: siguiente,
            resultado,
            mensajes: allAfipMessages,
        });
    }
    return factura;
}
async function emitirNotaCreditoAFIP({ saleId, facturaOriginalId, motivo = "Devolución o anulación", importe, }) {
    console.log("🧾 Enviando solicitud de Nota de Crédito a AFIP...");
    // 1) Buscar la factura original
    const facturaOriginal = await prisma_1.default.invoiceAfip.findUnique({
        where: { id: facturaOriginalId },
    });
    if (!facturaOriginal)
        throw new Error("Factura original no encontrada");
    // 2) Determinar tipo de comprobante de la NC
    let tipoComprobanteNC = 13; // NC C
    if (facturaOriginal.tipoComprobante === 1)
        tipoComprobanteNC = 3; // NC A
    if (facturaOriginal.tipoComprobante === 6)
        tipoComprobanteNC = 8; // NC B
    const cuit = facturaOriginal.cuit;
    const puntoVenta = facturaOriginal.puntoVenta; // 👈 importante
    const tipoDoc = facturaOriginal.tipoDoc;
    const nroDoc = Number(facturaOriginal.nroDoc);
    const condicionIVAReceptor = facturaOriginal.condicionIVAReceptor;
    // ✅ 3) Obtener número siguiente SIN incrementar contador
    const siguiente = await cbteCounter_service_1.cbteCounterService.peekNext(puntoVenta, tipoComprobanteNC);
    // 4) Token/sign
    const { token, sign } = await (0, wsaa_service_1.getValidToken)();
    // 5) Calcular neto e IVA
    let neto = importe;
    let iva21 = 0;
    if (tipoComprobanteNC !== 13) {
        neto = +(importe / 1.21).toFixed(2);
        iva21 = +(importe - neto).toFixed(2);
    }
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    // 6) XML (PtoVta dinámico, no hardcode 7)
    const soapEnvelope = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
    <soapenv:Header/>
    <soapenv:Body>
      <ar:FECAESolicitar>
        <ar:Auth>
          <ar:Token>${token}</ar:Token>
          <ar:Sign>${sign}</ar:Sign>
          <ar:Cuit>${cuit}</ar:Cuit>
        </ar:Auth>
        <ar:FeCAEReq>
          <ar:FeCabReq>
            <ar:CantReg>1</ar:CantReg>
            <ar:PtoVta>${puntoVenta}</ar:PtoVta>
            <ar:CbteTipo>${tipoComprobanteNC}</ar:CbteTipo>
          </ar:FeCabReq>
          <ar:FeDetReq>
            <ar:FECAEDetRequest>
              <ar:Concepto>1</ar:Concepto>
              <ar:DocTipo>${tipoDoc}</ar:DocTipo>
              <ar:DocNro>${nroDoc}</ar:DocNro>
              <ar:CbteDesde>${siguiente}</ar:CbteDesde>
              <ar:CbteHasta>${siguiente}</ar:CbteHasta>
              <ar:CbteFch>${fecha}</ar:CbteFch>

              <ar:CbtesAsoc>
                <ar:CbteAsoc>
                  <ar:Tipo>${facturaOriginal.tipoComprobante}</ar:Tipo>
                  <ar:PtoVta>${facturaOriginal.puntoVenta}</ar:PtoVta>
                  <ar:Nro>${facturaOriginal.numero}</ar:Nro>
                </ar:CbteAsoc>
              </ar:CbtesAsoc>

              <ar:ImpTotal>${importe.toFixed(2)}</ar:ImpTotal>
              <ar:ImpTotConc>0.00</ar:ImpTotConc>
              <ar:ImpNeto>${neto.toFixed(2)}</ar:ImpNeto>
              <ar:ImpOpEx>0.00</ar:ImpOpEx>
              <ar:ImpTrib>0.00</ar:ImpTrib>
              <ar:ImpIVA>${iva21.toFixed(2)}</ar:ImpIVA>
              <ar:MonId>PES</ar:MonId>
              <ar:MonCotiz>1.00</ar:MonCotiz>
              ${tipoComprobanteNC !== 13
        ? `
              <ar:Iva>
                <ar:AlicIva>
                  <ar:Id>5</ar:Id>
                  <ar:BaseImp>${neto.toFixed(2)}</ar:BaseImp>
                  <ar:Importe>${iva21.toFixed(2)}</ar:Importe>
                </ar:AlicIva>
              </ar:Iva>`
        : ""}
            </ar:FECAEDetRequest>
          </ar:FeDetReq>
        </ar:FeCAEReq>
      </ar:FECAESolicitar>
    </soapenv:Body>
  </soapenv:Envelope>`;
    // 7) Enviar a AFIP
    const { data } = await axios_1.default.post(WSFE_URL, soapEnvelope, {
        headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: "http://ar.gov.afip.dif.FEV1/FECAESolicitar",
        },
        timeout: 15000,
    });
    // 8) Parse
    const parsed = await xml2js_1.default.parseStringPromise(data, { explicitArray: false });
    const body = parsed?.["soap:Envelope"]?.["soap:Body"];
    if (!body)
        throw new Error("Respuesta SOAP inválida (sin Body)");
    if (body["soap:Fault"])
        throw new Error(`Error SOAP: ${body["soap:Fault"].faultstring}`);
    const result = body["FECAESolicitarResponse"]?.["FECAESolicitarResult"];
    // ================== DEBUG AFIP ==================
    console.log("🧾 AFIP RESULT RAW:", JSON.stringify(result, null, 2));
    // ❌ Errores generales
    const afipErrorsRaw = result?.Errors?.Err;
    const afipErrors = afipErrorsRaw
        ? Array.isArray(afipErrorsRaw)
            ? afipErrorsRaw
            : [afipErrorsRaw]
        : [];
    if (afipErrors.length > 0) {
        console.error("🧨 AFIP ERRORS:");
        afipErrors.forEach((e) => {
            console.error(`  ❌ Code ${e.Code}: ${e.Msg}`);
        });
    }
    // ⚠️ Observaciones por comprobante
    const obsRaw = result?.FeDetResp?.FECAEDetResponse?.Observaciones?.Obs;
    const observaciones = obsRaw
        ? Array.isArray(obsRaw)
            ? obsRaw
            : [obsRaw]
        : [];
    if (observaciones.length > 0) {
        console.warn("👀 AFIP OBSERVACIONES:");
        observaciones.forEach((o) => {
            console.warn(`  ⚠️ Code ${o.Code}: ${o.Msg}`);
        });
    }
    // Resultado final
    const det = result?.FeDetResp?.FECAEDetResponse;
    console.log("📄 AFIP DET RESPONSE:", det);
    // =================================================
    if (!result)
        throw new Error("No se encontró FECAESolicitarResult");
    const { cae, vto, resultado } = pickCbteResult(result);
    console.log(`✅ Nota de Crédito AFIP (${resultado ?? "?"}) - CAE: ${cae || "N/A"}`);
    // 9) QR (solo con CAE)
    const qr = cae
        ? await (0, qrAfip_service_1.generarQR)({
            fecha,
            cuit,
            puntoVenta,
            tipoComprobante: tipoComprobanteNC,
            numero: siguiente,
            total: importe,
            tipoDoc,
            nroDoc,
            cae,
        })
        : { urlQR: null, qrDataURL: null };
    // 10) Guardar nota de crédito (aunque esté rechazada, para auditoría)
    const notaCredito = await prisma_1.default.invoiceAfip.create({
        data: {
            sale: { connect: { id: saleId } },
            relatedInvoice: { connect: { id: facturaOriginalId } },
            cuit,
            puntoVenta,
            tipoComprobante: tipoComprobanteNC,
            tipoDoc,
            nroDoc: BigInt(nroDoc),
            numero: siguiente,
            fechaEmision: new Date(),
            resultado: resultado ?? "R",
            cae,
            caeVto: vto
                ? new Date(`${String(vto).slice(0, 4)}-${String(vto).slice(4, 6)}-${String(vto).slice(6, 8)}`)
                : null,
            total: importe,
            neto,
            iva: iva21,
            condicionIVAReceptor,
            urlQR: qr.urlQR,
            qrBase64: qr.qrDataURL,
        },
    });
    // ✅ 11) SOLO si AFIP aprobó: confirmar contador y marcar NC emitida
    if (resultado === "A" && cae) {
        await cbteCounter_service_1.cbteCounterService.commitUsed(puntoVenta, tipoComprobanteNC, siguiente);
        await prisma_1.default.sale.update({
            where: { id: saleId },
            data: { isNoteCredit: true },
        });
        console.log("💾 Nota de crédito APROBADA. Contador confirmado y sale actualizada:", notaCredito.id);
    }
    else {
        console.warn("⚠️ Nota de crédito NO aprobada. NO se actualiza contador ni isNoteCredit.", {
            saleId,
            puntoVenta,
            tipoComprobanteNC,
            numero: siguiente,
            resultado,
        });
    }
    return notaCredito;
}
/**
 * ✅ Obtiene el último comprobante autorizado desde AFIP (opcional)
 */
//# sourceMappingURL=wsfe.service.js.map