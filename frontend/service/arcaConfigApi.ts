import api from '@/lib/api';
import type {
  ArcaApiResponse,
  ArcaCertificatePayload,
  ArcaConfig,
  ArcaConfigPayload,
  ArcaPointOfSale,
  ArcaPointOfSalePayload,
} from '@/types/arca';

function unwrap<T>(res: { data: ArcaApiResponse<T> | T }): T {
  const data = res.data as ArcaApiResponse<T>;
  if (data && typeof data === 'object' && 'ok' in data) {
    return (data.content ?? data.data) as T;
  }
  return res.data as T;
}

// El backend corregido acepta alias. Si tu app usa /api adelante, api.ts ya debería tener baseURL con /api.
const BASE = '/afip/configuracion';

export const arcaConfigApi = {
  async getConfig() {
    const res = await api.get<ArcaApiResponse<ArcaConfig> | ArcaConfig>(BASE);
    return unwrap<ArcaConfig>(res);
  },

  async listConfigs() {
    const res = await api.get<ArcaApiResponse<ArcaConfig[]> | ArcaConfig[]>(`${BASE}/list`);
    return unwrap<ArcaConfig[]>(res);
  },

  async saveConfig(payload: ArcaConfigPayload) {
    const res = await api.put<ArcaApiResponse<ArcaConfig> | ArcaConfig>(BASE, payload);
    return unwrap<ArcaConfig>(res);
  },

  async createConfig(payload: ArcaConfigPayload) {
    const res = await api.post<ArcaApiResponse<ArcaConfig> | ArcaConfig>(BASE, payload);
    return unwrap<ArcaConfig>(res);
  },

  async uploadCertificates(payload: ArcaCertificatePayload) {
    const res = await api.post<ArcaApiResponse<ArcaConfig> | ArcaConfig>(`${BASE}/certificados`, payload);
    return unwrap<ArcaConfig>(res);
  },

  async deleteCertificates() {
    const res = await api.delete<ArcaApiResponse<ArcaConfig> | ArcaConfig>(`${BASE}/certificados`);
    return unwrap<ArcaConfig>(res);
  },

  async activate(configId?: string) {
    const res = await api.post<ArcaApiResponse<ArcaConfig> | ArcaConfig>(`${BASE}/activar`, { configId });
    return unwrap<ArcaConfig>(res);
  },

  async testWsaa() {
    const res = await api.post<ArcaApiResponse<any> | any>(`${BASE}/test/wsaa`);
    return unwrap<any>(res);
  },

  async testWsfeDummy() {
    const res = await api.post<ArcaApiResponse<any> | any>(`${BASE}/test/wsfe-dummy`);
    return unwrap<any>(res);
  },

  async getPointsOfSale() {
    const res = await api.get<ArcaApiResponse<ArcaPointOfSale[]> | ArcaPointOfSale[]>(`${BASE}/puntos-venta`);
    return unwrap<ArcaPointOfSale[]>(res);
  },

  async savePointOfSale(payload: ArcaPointOfSalePayload) {
    const res = await api.post<ArcaApiResponse<ArcaPointOfSale> | ArcaPointOfSale>(`${BASE}/puntos-venta`, payload);
    return unwrap<ArcaPointOfSale>(res);
  },

  async deletePointOfSale(id: string) {
    const res = await api.delete<ArcaApiResponse<{ ok: true }> | { ok: true }>(`${BASE}/puntos-venta/${id}`);
    return unwrap<{ ok: true }>(res);
  },
};
