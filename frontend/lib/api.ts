import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (!(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.includes('/login')
      ) {
        // Si el token quedó inválido (no solo vencido), el cookie sigue presente
        // y el middleware, al leerlo, nos manda de vuelta al POS en vez de dejarnos
        // ver el login. Hay que limpiar la cookie en el server antes de redirigir.
        try {
          await axios.post(`${API_URL}/auth/logout`, {}, { withCredentials: true });
        } catch {
          // Si esto falla, igual redirigimos: es mejor esfuerzo.
        }

        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;