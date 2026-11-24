/**
 * Small fetch-based client for the MarketPAQ backend (/api/v1).
 *
 *   api.auth.me() / updateMe(data) / isAuthenticated() / logout() / redirectToLogin()
 *   api.entities.<Entity>.list(sort, limit, skip) / filter(query, sort, limit, skip)
 *                        .get(id) / create(data) / update(id, data) / delete(id)
 *   api.functions.invoke(name, body) → { data, status }
 *
 * Entity and auth calls resolve to the response body. Failed requests reject
 * with an ApiError exposing `status`, `code`, `data` and `response.{status,data}`.
 */

export const API_BASE = '/api/v1';

const TOKEN_KEY = 'marketpaq_access_token';
// Key used by the previous frontend client. Read once and migrated so that
// sessions created before the switch stay logged in.
const LEGACY_TOKEN_KEY = 'base44_access_token';
const LEGACY_TOKEN_KEYS = [LEGACY_TOKEN_KEY, 'token'];

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function getToken() {
  const s = storage();
  if (!s) return null;
  const token = s.getItem(TOKEN_KEY);
  if (token) return token;
  const legacy = s.getItem(LEGACY_TOKEN_KEY);
  if (legacy) {
    s.setItem(TOKEN_KEY, legacy);
    LEGACY_TOKEN_KEYS.forEach(k => s.removeItem(k));
    return legacy;
  }
  return null;
}

export function setToken(token) {
  const s = storage();
  if (!s || !token) return;
  s.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  const s = storage();
  if (!s) return;
  s.removeItem(TOKEN_KEY);
  LEGACY_TOKEN_KEYS.forEach(k => s.removeItem(k));
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = data && typeof data === 'object' ? data.code : undefined;
    this.data = data;
    this.response = { status, data };
  }
}

function buildUrl(path, query) {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
    });
  }
  const qs = params.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

async function send(method, path, { body, query } = {}) {
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(buildUrl(path, query), { method, headers, body: payload });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const message = (data && typeof data === 'object' && (data.message || data.detail))
      || `Request failed with status code ${res.status}`;
    throw new ApiError(message, res.status, data);
  }
  return { data, status: res.status };
}

async function request(method, path, options) {
  const { data } = await send(method, path, options);
  return data;
}

function createEntity(name) {
  const base = `/entities/${name}`;
  return {
    list: (sort, limit, skip) => request('GET', base, { query: { sort, limit, skip } }),
    filter: (query, sort, limit, skip) =>
      request('GET', base, { query: { q: JSON.stringify(query), sort, limit, skip } }),
    get: (id) => request('GET', `${base}/${id}`),
    create: (data) => request('POST', base, { body: data }),
    update: (id, data) => request('PUT', `${base}/${id}`, { body: data }),
    delete: (id) => request('DELETE', `${base}/${id}`),
  };
}

const auth = {
  me: () => request('GET', '/entities/User/me'),
  updateMe: (data) => request('PUT', '/entities/User/me', { body: data }),
  async isAuthenticated() {
    if (!getToken()) return false;
    try {
      await auth.me();
      return true;
    } catch {
      return false;
    }
  },
  logout(redirectUrl = '/Login') {
    clearToken();
    if (redirectUrl && typeof window !== 'undefined') window.location.href = redirectUrl;
  },
  redirectToLogin(nextUrl) {
    if (typeof window === 'undefined') return;
    const from = nextUrl
      ? new URL(nextUrl, window.location.origin).toString()
      : window.location.href;
    window.location.href = `/Login?from_url=${encodeURIComponent(from)}`;
  },
};

export const api = {
  auth,
  entities: {
    Addons: createEntity('Addons'),
    DeveloperProfiles: createEntity('DeveloperProfiles'),
    User: createEntity('User'),
  },
  functions: {
    invoke: (name, body) => send('POST', `/functions/${name}`, { body }),
  },
};
