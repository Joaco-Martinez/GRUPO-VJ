import axios from "axios";
import xml2js from "xml2js";
import prisma from "../prisma";
import { getValidToken } from "./wsaa.service";
import { cbteCounterService } from "./cbteCounter.service";
import { generarQR } from "./qrAfip.service";
import { afipFechaAR } from "./utils/fecha";

const WSFE_URL = "https://servicios1.afip.gov.ar/wsfev1/service.asmx";
const PTO_VTA_REAL = 7;

type EmitirFacturaBaseParams = {
  saleId: string;
  cuit: string;
  tipoComprobante: number;
  tipoDoc: number;
  nroDoc: number;
  importe: number;
  condicionIVAReceptor?: number;
  concepto?: 1 | 2 | 3;
  puntoVenta?: number;
};

const toArray = (x: any) => (x ? (Array.isArray(x) ? x : [x]) : []);

function pickCbteResult(result: any) {
  const det = result?.FeDetResp?.FECAEDetResponse;
  const cab = result?.FeCabResp;

  return {
    det,
    cae: det?.CAE ?? null,
    vto: det?.CAEFchVto ?? null,
    resultado: det?.Resultado ?? cab?.Resultado ?? null,
  };
}

function printAfipList(title: string, list: any[]) {
  if (!list?.length) return;
  console.log(`\n================ ${title} (${list.length}) ================`);
  list.forEach((e, i) => {
    const code = e?.Code ?? "N/A";
    const msg = e?.Msg ?? JSON.stringify(e);
    console.log(`${i + 1}. [${code}] ${msg}`);
  });
}

function logAfipFull(result: any) {
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
    ...generalErrors.map((e: any) => `[${e.Code}] ${e.Msg}`),
    ...events.map((e: any) => `[${e.Code}] ${e.Msg}`),
    ...detErrors.map((e: any) => `[${e.Code}] ${e.Msg}`),
    ...detObs.map((e: any) => `[${e.Code}] ${e.Msg}`),
  ];
}

function calcularImportes(tipoComprobante: number, importe: number) {
  // Factura C
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

  // Factura A / B
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

export async function obtenerUltimoComprobanteAFIPBase({
  cuit,
  puntoVenta,
  tipoComprobante,
}: {
  cuit: string;
  puntoVenta: number;
  tipoComprobante: number;
}): Promise<number> {
  const { token, sign } = await getValidToken();

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

  const { data } = await axios.post(WSFE_URL, soapEnvelope, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado",
    },
    timeout: 15000,
  });

  const parsed = await xml2js.parseStringPromise(data, { explicitArray: false });
  const body = parsed?.["soap:Envelope"]?.["soap:Body"];
  if (!body) throw new Error("Respuesta SOAP inválida (sin Body)");

  if (body["soap:Fault"]) {
    throw new Error(`SOAP Fault: ${body["soap:Fault"]?.faultstring || "sin faultstring"}`);
  }

  const result =
    body["FECompUltimoAutorizadoResponse"]?.["FECompUltimoAutorizadoResult"];

  if (!result) throw new Error("No se encontró FECompUltimoAutorizadoResult");

  const errs = toArray(result?.Errors?.Err);
  if (errs.length) {
    throw new Error(errs.map((e: any) => `[${e.Code}] ${e.Msg}`).join(" | "));
  }

  const cbteNro = Number(result?.CbteNro ?? 0);
  console.log(`📄 Último comprobante autorizado AFIP: ${cbteNro}`);

  return cbteNro;
}

export async function emitirFacturaAFIPBase({
  saleId,
  cuit,
  tipoComprobante,
  tipoDoc,
  nroDoc,
  importe,
  condicionIVAReceptor = 5,
  concepto = 1,
  puntoVenta = PTO_VTA_REAL,
}: EmitirFacturaBaseParams) {
  console.log("🧾 Emitiendo factura base AFIP...", {
    saleId,
    cuit,
    tipoComprobante,
    tipoDoc,
    nroDoc,
    importe,
    condicionIVAReceptor,
    puntoVenta,
  });

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: { isInvoiced: true },
  });

  if (!sale) throw new Error("Venta no encontrada");
  if (sale.isInvoiced) throw new Error("⚠️ Esta venta ya fue facturada y no puede repetirse");

  const ultimoAfip = await obtenerUltimoComprobanteAFIPBase({
    cuit,
    puntoVenta,
    tipoComprobante,
  });

  const siguiente = ultimoAfip + 1;

  try {
    await cbteCounterService.commitUsed(puntoVenta, tipoComprobante, ultimoAfip);
  } catch (e: any) {
    console.warn("⚠️ No pude sincronizar contador local:", e?.message || e);
  }

  const { token, sign } = await getValidToken();
  const fecha = afipFechaAR();

  const { neto, iva, impTotConc, impOpEx, impTrib, ivaXml } = calcularImportes(
    tipoComprobante,
    importe
  );

  const incluirCondicionIVA = `
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
              ${incluirCondicionIVA}
              ${ivaXml}
            </ar:FECAEDetRequest>
          </ar:FeDetReq>
        </ar:FeCAEReq>
      </ar:FECAESolicitar>
    </soapenv:Body>
  </soapenv:Envelope>`;

  const { data } = await axios.post(WSFE_URL, soapEnvelope, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "http://ar.gov.afip.dif.FEV1/FECAESolicitar",
    },
    timeout: 15000,
  });

  const parsed = await xml2js.parseStringPromise(data, { explicitArray: false });
  const soapBody = parsed?.["soap:Envelope"]?.["soap:Body"];
  if (!soapBody) throw new Error("Respuesta SOAP inválida (sin Body)");

  if (soapBody["soap:Fault"]) {
    throw new Error(`Error SOAP: ${soapBody["soap:Fault"]?.faultstring || "sin faultstring"}`);
  }

  const result = soapBody["FECAESolicitarResponse"]?.["FECAESolicitarResult"];
  if (!result) throw new Error("No se encontró FECAESolicitarResult");

  const allAfipMessages = logAfipFull(result);
  const { cae, vto, resultado } = pickCbteResult(result);

  const qr = cae
    ? await generarQR({
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

  const existingBySale = await prisma.invoiceAfip.findUnique({
    where: { saleId },
  });

  let factura;

  if (existingBySale) {
    factura = await prisma.invoiceAfip.update({
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
          ? new Date(
              `${String(vto).slice(0, 4)}-${String(vto).slice(4, 6)}-${String(vto).slice(6, 8)}`
            )
          : null,
        total: importe,
        neto,
        iva,
        condicionIVAReceptor,
        urlQR: qr.urlQR,
        qrBase64: qr.qrDataURL,
      },
    });
  } else {
    factura = await prisma.invoiceAfip.create({
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
          ? new Date(
              `${String(vto).slice(0, 4)}-${String(vto).slice(4, 6)}-${String(vto).slice(6, 8)}`
            )
          : null,
        total: importe,
        neto,
        iva,
        condicionIVAReceptor,
        urlQR: qr.urlQR,
        qrBase64: qr.qrDataURL,
      },
    });
  }

  if (resultado === "A" && cae) {
    await cbteCounterService.commitUsed(puntoVenta, tipoComprobante, siguiente);

    await prisma.sale.update({
      where: { id: saleId },
      data: {
        isInvoiced: true,
        invoiceStatus: "INVOICED",
      },
    });

    console.log("✅ Factura aprobada AFIP:", {
      saleId,
      tipoComprobante,
      numero: siguiente,
      cae,
    });
  } else {
    await prisma.sale.update({
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