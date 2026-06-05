import api from "@/lib/api";

export type ArcaEnvironment = "HOMOLOGACION" | "PRODUCCION";
export type ArcaConfigStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "ERROR"
  | "INCOMPLETE"
  | "CERT_EXPIRED";

export type ArcaPointOfSale = {
  id: string;
  number: number;
  description?: string | null;
  enabled: boolean;
  isDefault: boolean;
  enabledCbteTypes: number[];
};

export type ArcaConfig = {
  id: string;
  businessName: string;
  cuit: string;
  ivaCondition?: string | null;
  fiscalAddress?: string | null;
  iibb?: string | null;
  activityStart?: string | null;
  environment: ArcaEnvironment;
  status: ArcaConfigStatus;
  defaultPointOfSale?: number | null;
  defaultCurrencyId: string;
  defaultConcept: number;
  certAlias?: string | null;
  certExpiresAt?: string | null;
  csrGeneratedAt?: string | null;
  lastTokenAt?: string | null;
  lastCheckAt?: string | null;
  lastError?: string | null;
  lastSuccessAt?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  pointsOfSale?: ArcaPointOfSale[];
};

export type GenerateCsrPayload = {
  businessName: string;
  cuit: string;
  ivaCondition?: string;
  fiscalAddress?: string;
  iibb?: string;
  activityStart?: string;
  environment: ArcaEnvironment;
  defaultPointOfSale: string | number;
  certAlias?: string;
};

export const arcaConfigApi = {
  async get() {
    const { data } = await api.get("/arca-config");
    return data.content as ArcaConfig | null;
  },

  async generateCsr(payload: GenerateCsrPayload) {
    const { data } = await api.post("/arca-config/generate-csr", payload);
    return data.content as ArcaConfig;
  },

  async downloadCsr(id: string) {
    const response = await api.get(`/arca-config/${id}/download-csr`, {
      responseType: "blob",
    });

    const blob = new Blob([response.data], {
      type: "application/pkcs10",
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `pedido-arca-${id}.csr`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async uploadCertificate(id: string, cert: File) {
    const formData = new FormData();
    formData.append("cert", cert);

    const { data } = await api.post(`/arca-config/${id}/upload-cert`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return data.content as ArcaConfig;
  },

  async activate(id: string) {
    const { data } = await api.patch(`/arca-config/${id}/activate`);
    return data.content as ArcaConfig;
  },

  async test(id: string) {
    const { data } = await api.post(`/arca-config/${id}/test`);
    return data;
  },

  async remove(id: string) {
    const { data } = await api.delete(`/arca-config/${id}`);
    return data;
  },
};
