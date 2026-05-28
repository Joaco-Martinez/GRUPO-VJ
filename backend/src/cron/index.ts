import { iniciarRenovacionAutomatica } from "./afipRenovador";

(async () => {
  console.log("🟡 Servicio de cron AFIP iniciado...");
  await iniciarRenovacionAutomatica();
})();
