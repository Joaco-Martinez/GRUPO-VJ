// src/cron/afipRenovador.ts
import cron from "node-cron";
import { generarTokenAFIP } from "../afip/wsaa.service";

export async function iniciarRenovacionAutomatica() {
  console.log("🚀 Iniciando servicio de renovación automática del token AFIP...");

  try {
    console.log("🔑 Generando token inicial de AFIP...");
    await generarTokenAFIP();
    console.log("✅ Token AFIP inicial generado correctamente.");
  } catch (err) {
    console.error("❌ Error al generar el token inicial:", err);
  }

  // Renovación cada 11 horas
  cron.schedule("0 */11 * * *", async () => {
    console.log("⏰ Renovación automática del token AFIP...");
    try {
      await generarTokenAFIP();
      console.log("✅ Token AFIP renovado correctamente.");
    } catch (err) {
      console.error("❌ Error en renovación automática:", err);
    }
  });
}
