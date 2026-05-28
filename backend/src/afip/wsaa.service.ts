import fs from "fs";
import path from "path";
import axios from "axios";
import forge from "node-forge";
import xml2js from "xml2js";
import prisma from "../prisma";

const WSAA_URL = "https://wsaa.afip.gov.ar/ws/services/LoginCms";
const SERVICE_ID = "wsfe";

const CERT_PATH = path.resolve("./certs/certificado.crt");
const KEY_PATH = path.resolve("./certs/MiClavePrivada.key");

export async function generarTokenAFIP() {
  console.log("🔐 Generando nuevo Token/Sign desde WSAA...");

  const cert = fs.readFileSync(CERT_PATH);
  const key = fs.readFileSync(KEY_PATH);

  const now = new Date();
  const genTime = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const expTime = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
  const uniqueId = Math.floor(Math.random() * 1000000000).toString();

  const xml = `
    <loginTicketRequest version="1.0">
      <header>
        <uniqueId>${uniqueId}</uniqueId>
        <generationTime>${genTime}</generationTime>
        <expirationTime>${expTime}</expirationTime>
      </header>
      <service>${SERVICE_ID}</service>
    </loginTicketRequest>
  `;

  // --- Firmar XML con clave privada ---
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(xml, "utf8");
  p7.addCertificate(forge.pki.certificateFromPem(cert.toString()));
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(key.toString()),
    certificate: forge.pki.certificateFromPem(cert.toString()),
    digestAlgorithm: forge.pki.oids.sha256,
  });
  p7.sign();

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  const cmsBase64 = Buffer.from(der, "binary").toString("base64");

  // --- Enviar al WSAA ---
  const soapEnvelope = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.loginCms/">
      <soapenv:Header/>
      <soapenv:Body>
        <ar:loginCms>
          <ar:in0>${cmsBase64}</ar:in0>
        </ar:loginCms>
      </soapenv:Body>
    </soapenv:Envelope>
  `;

  const { data } = await axios.post(WSAA_URL, soapEnvelope, {
  headers: {
    "Content-Type": "text/xml; charset=utf-8",
    "SOAPAction": "loginCms", // ← obligatorio
  },
});

  // --- Parsear XML (sin guardarlo a disco) ---
  const parsed = await xml2js.parseStringPromise(data, { explicitArray: false });

  const envelope =
    parsed["SOAP-ENV:Envelope"] ||
    parsed["soapenv:Envelope"] ||
    parsed["env:Envelope"];
  if (!envelope) throw new Error("No se encontró Envelope en la respuesta WSAA.");

  const body =
    envelope["SOAP-ENV:Body"] ||
    envelope["soapenv:Body"] ||
    envelope["env:Body"];
  if (!body) throw new Error("No se encontró Body en la respuesta WSAA.");

  const fault = body["SOAP-ENV:Fault"] || body["soapenv:Fault"];
  if (fault) {
    const msg = fault.faultstring || "Error desconocido en respuesta SOAP";
    throw new Error(`WSAA devolvió Fault: ${msg}`);
  }

  const loginCmsResponse =
    body["loginCmsResponse"]?.["loginCmsReturn"] ||
    body["ns1:loginCmsResponse"]?.["ns1:loginCmsReturn"];
  if (!loginCmsResponse)
    throw new Error("No se encontró loginCmsResponse en la respuesta WSAA.");

  // --- Parsear el login ticket interno ---
  const parsedToken = await xml2js.parseStringPromise(loginCmsResponse, {
    explicitArray: false,
  });

  const token = parsedToken.loginTicketResponse.credentials.token;
  const sign = parsedToken.loginTicketResponse.credentials.sign;
  const expiration = new Date(
    parsedToken.loginTicketResponse.header.expirationTime
  );

  // 💾 Guardar o actualizar token en base de datos
  const existing = await prisma.afipToken.findFirst();

  if (existing) {
    await prisma.afipToken.update({
      where: { id: existing.id },
      data: { token, sign, expiration },
    });
    console.log("🔄 Token AFIP actualizado en base de datos.");
  } else {
    await prisma.afipToken.create({
      data: { token, sign, expiration },
    });
    console.log("🆕 Token AFIP creado en base de datos.");
  }

  console.log("✅ Token AFIP válido hasta:", expiration);
  return { token, sign, expiration };
}


export async function getValidToken() {
  let token = await prisma.afipToken.findFirst();

  const now = new Date();
  if (!token || now >= token.expiration) {
    console.log("⚠️ Token vencido o inexistente. Generando nuevo...");
    const newToken = await generarTokenAFIP();
    token = await prisma.afipToken.findFirst(); // recargar
    console.log("✅ Token renovado correctamente.");
  }

  return {
    token: token!.token,
    sign: token!.sign,
    expiration: token!.expiration,
  };
}