import axios from 'axios';

function computeBaseURL() {
  const explicit = import.meta.env.VITE_API_URL;
  if (explicit && typeof explicit === 'string' && explicit.trim().length > 0) {
    return explicit;
  }
  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  const host = window.location.hostname || 'localhost';
  const port = import.meta.env.VITE_API_PORT || '3001';
  return `${protocol}://${host}:${port}/api`;
}

export const api = axios.create({ baseURL: computeBaseURL() });

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}
