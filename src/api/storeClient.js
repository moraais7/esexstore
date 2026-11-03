// All application requests use the HttpOnly session cookie on this origin.
/**
 * @param {string} path
 * @param {{ method?: string, body?: unknown }} [options]
 */
async function request(path, { method = 'GET', body } = {}) {
  const form = body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    ...(body !== undefined && !form ? { headers: { 'Content-Type': 'application/json' } } : {}),
    ...(body !== undefined ? { body: form ? body : JSON.stringify(body) } : {}),
  });
  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); }
    catch { data = { error: 'O servidor retornou uma resposta inválida.' }; }
  }
  if (!response.ok) {
    const error = Object.assign(new Error(data?.error || data?.message || 'Não foi possível concluir a solicitação.'), {
      status: response.status,
      response: { status: response.status, data },
      data,
    });
    throw error;
  }
  return data;
}

const post = (path, body) => request(path, { method: 'POST', body });
/** @param {string} name */
const entity = name => {
  const path = `/entities/${encodeURIComponent(name)}`;
  return {
    filter: (query = {}, options = {}) => post(`${path}/query`, { query, options }),
    list: (options = {}) => post(`${path}/query`, { query: {}, options }),
    count: (query = {}) => post(`${path}/count`, { query }),
    aggregate: (spec = {}) => post(`${path}/aggregate`, spec),
    get: id => request(`${path}/${encodeURIComponent(id)}`),
    create: data => post(path, data),
    update: (id, data) => request(`${path}/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
    delete: id => request(`${path}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    deleteMany: (query = {}) => post(`${path}/delete-many`, { query }),
  };
};

export const store = {
  entities: new Proxy(/** @type {Record<string, ReturnType<typeof entity>>} */ ({}), { get: (_, name) => entity(/** @type {string} */ (name)) }),
  functions: { invoke: async (name, body = {}) => ({ data: await post(`/functions/${encodeURIComponent(name)}`, body) }) },
  integrations: { Core: { UploadPublicFile: ({ file }) => {
    const body = new FormData();
    body.append('file', file);
    return post('/uploads', body);
  } } },
  auth: {
    me: () => request('/auth/me'),
    loginViaEmailPassword: (email, password) => post('/auth/login', { email, password }),
    register: data => post('/auth/register', data),
    verifyOtp: data => post('/auth/verify', data),
    resendOtp: email => post('/auth/resend', { email }),
    resetPasswordRequest: email => post('/auth/forgot-password', { email }),
    resetPassword: data => post('/auth/reset-password', data),
    /** @param {string} [redirect] */
    logout: async (redirect) => {
      const result = await post('/auth/logout', {});
      if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.includes('\\')) window.location.assign(redirect);
      return result;
    },
    redirectToLogin: (returnTo = window.location.pathname + window.location.search) => {
      const url = new URL(returnTo, window.location.origin);
      const path = url.origin === window.location.origin ? url.pathname + url.search : '/';
      window.location.assign(`/login?returnTo=${encodeURIComponent(path)}`);
    },
  },
};
