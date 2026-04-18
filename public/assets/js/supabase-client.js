// =========================================
// HisaabPro — Supabase Lite Client
// =========================================

(function () {
  const CONFIG = window.__SUPABASE_CONFIG__ || window.SUPABASE_CONFIG || {};
  const BASE_URL = (CONFIG.url || '').replace(/\/$/, '');
  const ANON_KEY = CONFIG.anonKey || '';
  const SESSION_KEY = 'hisaabpro.supabase.session.v1';

  function parseJson(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function getSession() {
    return parseJson(localStorage.getItem(SESSION_KEY), null);
  }

  function setSession(session) {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getAccessToken() {
    const session = getSession();
    return session && session.access_token ? session.access_token : null;
  }

  function buildHeaders(extraHeaders = {}, useSession = true) {
    const accessToken = useSession ? getAccessToken() : null;
    return {
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken || ANON_KEY}`,
      ...extraHeaders,
    };
  }

  async function request(path, options = {}) {
    if (!BASE_URL || !ANON_KEY) {
      return { data: null, error: new Error('Supabase configuration is missing') };
    }

    try {
      const response = await fetch(`${BASE_URL}${path}`, options);
      const contentType = response.headers.get('content-type') || '';
      const body = contentType.includes('application/json') ? await response.json() : await response.text();

      if (!response.ok) {
        const message =
          (body && (body.msg || body.message || body.error_description || body.error)) ||
          (typeof body === 'string' ? body : '') ||
          'Supabase request failed';
        const error = new Error(message);
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
        error.status = response.status;
        error.code = body && (body.error_code || body.code || body.error)
          ? (body.error_code || body.code || body.error)
          : null;
        error.retryAfterSeconds = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds
          : null;
        error.details = body;
        return { data: null, error };
      }

      return { data: body, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  function createQueryBuilder(table) {
    const state = {
      table,
      columns: '*',
      filters: [],
      orderBy: null,
    };

    const builder = {
      select(columns = '*') {
        state.columns = columns;
        return builder;
      },
      eq(column, value) {
        state.filters.push({ column, value });
        return builder;
      },
      order(column, options = {}) {
        state.orderBy = { column, ascending: options.ascending !== false };
        return builder;
      },
      async insert(payload) {
        return request(`/rest/v1/${state.table}`, {
          method: 'POST',
          headers: buildHeaders({
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          }),
          body: JSON.stringify(payload),
        });
      },
      async upsert(payload, options = {}) {
        const params = new URLSearchParams();
        if (options.onConflict) {
          params.set('on_conflict', options.onConflict);
        }

        const query = params.toString() ? `?${params.toString()}` : '';

        return request(`/rest/v1/${state.table}${query}`, {
          method: 'POST',
          headers: buildHeaders({
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=representation',
          }),
          body: JSON.stringify(payload),
        });
      },
      async update(values) {
        const params = new URLSearchParams();
        state.filters.forEach(filter => {
          params.append(filter.column, `eq.${filter.value}`);
        });

        return request(`/rest/v1/${state.table}?${params.toString()}`, {
          method: 'PATCH',
          headers: buildHeaders({
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          }),
          body: JSON.stringify(values),
        });
      },
      async delete() {
        const params = new URLSearchParams();
        state.filters.forEach(filter => {
          params.append(filter.column, `eq.${filter.value}`);
        });

        return request(`/rest/v1/${state.table}?${params.toString()}`, {
          method: 'DELETE',
          headers: buildHeaders({
            Prefer: 'return=representation',
          }),
        });
      },
      async execute() {
        const params = new URLSearchParams();
        params.set('select', state.columns);
        state.filters.forEach(filter => {
          params.append(filter.column, `eq.${filter.value}`);
        });
        if (state.orderBy) {
          params.set('order', `${state.orderBy.column}.${state.orderBy.ascending ? 'asc' : 'desc'}`);
        }

        return request(`/rest/v1/${state.table}?${params.toString()}`, {
          method: 'GET',
          headers: buildHeaders(),
        });
      },
      then(resolve, reject) {
        return builder.execute().then(resolve, reject);
      },
    };

    return builder;
  }

  window.supabase = {
    from(table) {
      return createQueryBuilder(table);
    },
    _config: CONFIG,
  };
})();