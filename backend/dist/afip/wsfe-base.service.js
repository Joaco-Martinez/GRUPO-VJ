"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerUltimoComprobanteAFIPBase = obtenerUltimoComprobanteAFIPBase;
exports.emitirFacturaAFIPBase = emitirFacturaAFIPBase;
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
const crypto_1 = __importDefault(require("crypto"));
const xml2js_1 = __importDefault(require("xml2js"));
const prisma_1 = __importDefault(require("../prisma"));
const wsaa_service_1 = require("./wsaa.service");
const cbteCounter_service_1 = require("./cbteCounter.service");
const qrAfip_service_1 = require("./qrAfip.service");
const fecha_1 = require("./utils/fecha");
const arcaConfig_service_1 = require("../services/arcaConfig.service");
function getWsfeUrl(environment) {
    return environment === "HOMOLOGACION"
        ? process.env.ARCA_WSFE_HOMO_URL ||
            "https://wswhomo.afip.gov.ar/wsfev1/service.asmx"
        : process.env.ARCA_WSFE_PROD_URL ||
            "https://servicios1.afip.gov.ar/wsfev1/service.asmx";
}
/**
 * AFIP / ARCA usa servicios SOAP viejos.
 * En algunas versiones modernas de Node/OpenSSL puede fallar con:
 * "dh key too small".
 *
 * Este agent baja el security level SOLO para la conexión contra WSFE.
 */
const arcaHttpsAgent = new https_1.default.Agent({
    keepAlive: true,
    rejectUnauthorized: true,
    ciphers: "DEFAULT@SECLEVEL=0",
    secureOptions: crypto_1.default.constants.SSL_OP_LEGACY_SERVER_CONNECT,
});
const toArray = (x) => {
    return x ? (Array.isArray(x) ? x : [x]) : [];
};
function resolvePuntoVenta(arcaConfig, puntoVenta) {
    if (puntoVenta && Number.isFinite(Number(puntoVenta))) {
        return Number(puntoVenta);
    }
    const enabledPoints = arcaConfig.pointsOfSale.filter((p) => p.enabled !== false);
    const defaultPoint = enabledPoints.find((p) => p.isDefault)?.number ||
        enabledPoints[0]?.number ||
        arcaConfig.pointsOfSale.find((p) => p.isDefault)?.number ||
        arcaConfig.pointsOfSale[0]?.number;
    if (!defaultPoint) {
        throw new Error("No hay punto de venta ARCA configurado.");
    }
    return defaultPoint;
}
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
    return [
        ...generalErrors.map((e) => `[${e.Code}] ${e.Msg}`),
        ...events.map((e) => `[${e.Code}] ${e.Msg}`),
        ...detErrors.map((e) => `[${e.Code}] ${e.Msg}`),
        ...detObs.map((e) => `[${e.Code}] ${e.Msg}`),
    ];
}
function parseSoapBody(parsed) {
    const envelope = parsed?.["soap:Envelope"] ||
        parsed?.["SOAP-ENV:Envelope"] ||
        parsed?.["soapenv:Envelope"] ||
        parsed?.["S:Envelope"];
    const body = envelope?.["soap:Body"] ||
        envelope?.["SOAP-ENV:Body"] ||
        envelope?.["soapenv:Body"] ||
        envelope?.["S:Body"];
    if (!body) {
        throw new Error("Respuesta SOAP inválida: no se encontró Body.");
    }
    const fault = body["soap:Fault"] ||
        body["SOAP-ENV:Fault"] ||
        body["soapenv:Fault"] ||
        body["S:Fault"];
    if (fault) {
        throw new Error(`SOAP Fault: ${fault?.faultstring || fault?.Reason?.Text || "sin faultstring"}`);
    }
    return body;
}
function calcularImportes(tipoComprobante, importe) {
    if (tipoComprobante === 11) {
        return {
            neto: +importe.toFixed(2),
            iva: 0,
            impTotConc: 0,
            impOpEx: 0,
            impTrib: 0,
            ivaXml: "",
        };
    }
    const neto = +(importe / 1.21).toFixed(2);
    const iva = +(importe - neto).toFixed(2);
    return {
        neto,
        iva,
        impTotConc: 0,
        impOpEx: 0,
        impTrib: 0,
        ivaXml: `
      <ar:Iva>
        <ar:AlicIva>
          <ar:Id>5</ar:Id>
          <ar:BaseImp>${neto.toFixed(2)}</ar:BaseImp>
          <ar:Importe>${iva.toFixed(2)}</ar:Importe>
        </ar:AlicIva>
      </ar:Iva>
    `,
    };
}
function parseCaeVto(vto) {
    if (!vto)
        return null;
    const value = String(vto);
    if (value.length !== 8)
        return null;
    return new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`);
}
async function obtenerUltimoComprobanteAFIPBase({ cuit, puntoVenta, tipoComprobante, }) {
    const arcaConfig = await arcaConfig_service_1.arcaConfigService.getActive();
    const cuitFinal = cuit || arcaConfig.cuit;
    const puntoVentaFinal = resolvePuntoVenta(arcaConfig, puntoVenta);
    const wsfeUrl = getWsfeUrl(arcaConfig.environment);
    const { token, sign } = await (0, wsaa_service_1.getValidToken)();
    const soapEnvelope = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
    <soapenv:Header/>
    <soapenv:Body>
      <ar:FECompUltimoAutorizado>
        <ar:Auth>
          <ar:Token>${token}</ar:Token>
          <ar:Sign>${sign}</ar:Sign>
          <ar:Cuit>${cuitFinal}</ar:Cuit>
        </ar:Auth>
        <ar:PtoVta>${puntoVentaFinal}</ar:PtoVta>
        <ar:CbteTipo>${tipoComprobante}</ar:CbteTipo>
      </ar:FECompUltimoAutorizado>
    </soapenv:Body>
  </soapenv:Envelope>`;
    const { data } = await axios_1.default.post(wsfeUrl, soapEnvelope, {
        httpsAgent: arcaHttpsAgent,
        headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado",
        },
        timeout: 30000,
    });
    const parsed = await xml2js_1.default.parseStringPromise(data, {
        explicitArray: false,
    });
    const body = parseSoapBody(parsed);
    const result = body["FECompUltimoAutorizadoResponse"]?.["FECompUltimoAutorizadoResult"] ||
        body["ns1:FECompUltimoAutorizadoResponse"]?.["FECompUltimoAutorizadoResult"];
    if (!result) {
        throw new Error("No se encontró FECompUltimoAutorizadoResult.");
    }
    const errs = toArray(result?.Errors?.Err);
    if (errs.length) {
        throw new Error(errs.map((e) => `[${e.Code}] ${e.Msg}`).join(" | "));
    }
    const cbteNro = Number(result?.CbteNro ?? 0);
    console.log(`📄 Último comprobante autorizado AFIP: ${cbteNro}`);
    return cbteNro;
}
async function emitirFacturaAFIPBase({ saleId, cuit, tipoComprobante, tipoDoc, nroDoc, importe, condicionIVAReceptor = 5, concepto = 1, puntoVenta, }) {
    const arcaConfig = await arcaConfig_service_1.arcaConfigService.getActive();
    const cuitFinal = cuit || arcaConfig.cuit;
    const puntoVentaFinal = resolvePuntoVenta(arcaConfig, puntoVenta);
    const wsfeUrl = getWsfeUrl(arcaConfig.environment);
    console.log("🧾 Emitiendo factura base ARCA...", {
        saleId,
        cuit: cuitFinal,
        tipoComprobante,
        tipoDoc,
        nroDoc,
        importe,
        condicionIVAReceptor,
        puntoVenta: puntoVentaFinal,
        environment: arcaConfig.environment,
    });
    const sale = await prisma_1.default.sale.findUnique({
        where: { id: saleId },
        select: { isInvoiced: true },
    });
    if (!sale) {
        throw new Error("Venta no encontrada.");
    }
    if (sale.isInvoiced) {
        throw new Error("Esta venta ya fue facturada y no puede repetirse.");
    }
    const ultimoAfip = await obtenerUltimoComprobanteAFIPBase({
        cuit: cuitFinal,
        puntoVenta: puntoVentaFinal,
        tipoComprobante,
    });
    const siguiente = ultimoAfip + 1;
    try {
        await cbteCounter_service_1.cbteCounterService.commitUsed(puntoVentaFinal, tipoComprobante, ultimoAfip);
    }
    catch (e) {
        console.warn("⚠️ No pude sincronizar contador local:", e?.message || e);
    }
    const { token, sign } = await (0, wsaa_service_1.getValidToken)();
    const fecha = (0, fecha_1.afipFechaAR)();
    const { neto, iva, impTotConc, impOpEx, impTrib, ivaXml } = calcularImportes(tipoComprobante, importe);
    const condicionIVAReceptorXml = `
    <ar:CondicionIVAReceptorId>${condicionIVAReceptor}</ar:CondicionIVAReceptorId>
  `;
    const soapEnvelope = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
    <soapenv:Header/>
    <soapenv:Body>
      <ar:FECAESolicitar>
        <ar:Auth>
          <ar:Token>${token}</ar:Token>
          <ar:Sign>${sign}</ar:Sign>
          <ar:Cuit>${cuitFinal}</ar:Cuit>
        </ar:Auth>
        <ar:FeCAEReq>
          <ar:FeCabReq>
            <ar:CantReg>1</ar:CantReg>
            <ar:PtoVta>${puntoVentaFinal}</ar:PtoVta>
            <ar:CbteTipo>${tipoComprobante}</ar:CbteTipo>
          </ar:FeCabReq>
          <ar:FeDetReq>
            <ar:FECAEDetRequest>
              <ar:Concepto>${concepto}</ar:Concepto>
              <ar:DocTipo>${tipoDoc}</ar:DocTipo>
              <ar:DocNro>${nroDoc}</ar:DocNro>
              <ar:CbteDesde>${siguiente}</ar:CbteDesde>
              <ar:CbteHasta>${siguiente}</ar:CbteHasta>
              <ar:CbteFch>${fecha}</ar:CbteFch>
              <ar:ImpTotal>${importe.toFixed(2)}</ar:ImpTotal>
              <ar:ImpTotConc>${impTotConc.toFixed(2)}</ar:ImpTotConc>
              <ar:ImpNeto>${neto.toFixed(2)}</ar:ImpNeto>
              <ar:ImpOpEx>${impOpEx.toFixed(2)}</ar:ImpOpEx>
              <ar:ImpTrib>${impTrib.toFixed(2)}</ar:ImpTrib>
              <ar:ImpIVA>${iva.toFixed(2)}</ar:ImpIVA>
              <ar:MonId>PES</ar:MonId>
              <ar:MonCotiz>1.00</ar:MonCotiz>
              ${condicionIVAReceptorXml}
              ${ivaXml}
            </ar:FECAEDetRequest>
          </ar:FeDetReq>
        </ar:FeCAEReq>
      </ar:FECAESolicitar>
    </soapenv:Body>
  </soapenv:Envelope>`;
    const { data } = await axios_1.default.post(wsfeUrl, soapEnvelope, {
        httpsAgent: arcaHttpsAgent,
        headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: "http://ar.gov.afip.dif.FEV1/FECAESolicitar",
        },
        timeout: 30000,
    });
    const parsed = await xml2js_1.default.parseStringPromise(data, {
        explicitArray: false,
    });
    const soapBody = parseSoapBody(parsed);
    const result = soapBody["FECAESolicitarResponse"]?.["FECAESolicitarResult"] ||
        soapBody["ns1:FECAESolicitarResponse"]?.["FECAESolicitarResult"];
    if (!result) {
        throw new Error("No se encontró FECAESolicitarResult.");
    }
    const allAfipMessages = logAfipFull(result);
    const { cae, vto, resultado } = pickCbteResult(result);
    const qr = cae
        ? await (0, qrAfip_service_1.generarQR)({
            fecha,
            cuit: cuitFinal,
            puntoVenta: puntoVentaFinal,
            tipoComprobante,
            numero: siguiente,
            total: importe,
            tipoDoc,
            nroDoc,
            cae,
        })
        : { urlQR: null, qrDataURL: null };
    const existingBySale = await prisma_1.default.invoiceAfip.findUnique({
        where: { saleId },
    });
    const invoiceData = {
        cuit: cuitFinal,
        puntoVenta: puntoVentaFinal,
        tipoComprobante,
        tipoDoc,
        nroDoc: BigInt(nroDoc),
        numero: siguiente,
        fechaEmision: new Date(),
        resultado: resultado ?? "R",
        cae,
        caeVto: parseCaeVto(vto),
        total: importe,
        neto,
        iva,
        condicionIVAReceptor,
        urlQR: qr.urlQR,
        qrBase64: qr.qrDataURL,
    };
    let factura;
    if (existingBySale) {
        factura = await prisma_1.default.invoiceAfip.update({
            where: { id: existingBySale.id },
            data: invoiceData,
        });
    }
    else {
        factura = await prisma_1.default.invoiceAfip.create({
            data: {
                sale: { connect: { id: saleId } },
                ...invoiceData,
            },
        });
    }
    if (resultado === "A" && cae) {
        await cbteCounter_service_1.cbteCounterService.commitUsed(puntoVentaFinal, tipoComprobante, siguiente);
        await prisma_1.default.sale.update({
            where: { id: saleId },
            data: {
                isInvoiced: true,
                invoiceStatus: "INVOICED",
                afipLastError: null,
            },
        });
        console.log("✅ Factura aprobada AFIP:", {
            saleId,
            tipoComprobante,
            numero: siguiente,
            cae,
        });
    }
    else {
        await prisma_1.default.sale.update({
            where: { id: saleId },
            data: {
                invoiceStatus: "ERROR",
                afipLastError: allAfipMessages.slice(0, 1800).join(" | ") || "Rechazado por AFIP",
            },
        });
        console.warn("⚠️ Factura no aprobada por AFIP:", {
            saleId,
            tipoComprobante,
            numero: siguiente,
            resultado,
        });
    }
    return factura;
}
//# sourceMappingURL=wsfe-base.service.js.map