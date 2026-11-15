const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const getToken = () => { try { return localStorage.getItem('svc-token') || ''; } catch { return ''; } };
export const getUser = () => { try { return JSON.parse(localStorage.getItem('svc-user') || 'null'); } catch { return null; } };
export const saveSession = ({ token, user }) => { localStorage.setItem('svc-token', token); localStorage.setItem('svc-user', JSON.stringify(user)); };
export const clearSession = () => { localStorage.removeItem('svc-token'); localStorage.removeItem('svc-user'); };
export async function api(path, options = {}) {
  if (!API_URL) throw new Error('Backend URL is not configured. Set VITE_API_URL in your frontend environment.');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken(); if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try { response = await fetch(`${API_URL}${path}`, { ...options, headers }); }
  catch { throw new Error('Could not connect to the server. Please try again later.'); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Request failed. Please try again.');
  return body;
}
