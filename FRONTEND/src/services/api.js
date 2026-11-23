async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      result.error || result.message || `API returned ${response.status}`,
    );
  return result;
}

const api = {
  async getCollection(name) {
    return (await request(`/api/data/${name}`)).records;
  },
  async saveCollection(name, records) {
    await request(`/api/data/${name}`, {
      method: "PUT",
      body: JSON.stringify({ records }),
    });
  },
};

export const authApi = {
  me: () => request("/api/auth/me"),
  login: (email, password) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  requestSignupCode: (email) =>
    request("/api/auth/signup/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  register: (details) =>
    request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(details),
    }),
  changePassword: (currentPassword, newPassword) =>
    request("/api/auth/password/change", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  updateProfile: (details) =>
    request("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify(details),
    }),
  requestReset: (email) =>
    request("/api/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  confirmReset: (email, code, password) =>
    request("/api/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ email, code, password }),
    }),
};

export const userApi = {
  list: async () => (await request("/api/users")).users,
  eligibleColleges: async () =>
    (await request("/api/users/eligible-colleges")).colleges,
  create: (details) =>
    request("/api/users", {
      method: "POST",
      body: JSON.stringify(details),
    }),
  resendPassword: (email, password) =>
    request("/api/users/resend-password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  updateStatus: (id, status) =>
    request(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  remove: (id) => request(`/api/users/${id}`, { method: "DELETE" }),
};

function reportQuery(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    // Blank dates/selects stay out of the URL; false must still be sent.
    if (value === "" || value === null || value === undefined) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const reportApi = {
  overview: (filters) => request(`/api/reports/overview${reportQuery(filters)}`),
  colleges: (filters) => request(`/api/reports/colleges${reportQuery(filters)}`),
  college: (name, filters) =>
    request(
      `/api/reports/colleges/${encodeURIComponent(name)}${reportQuery(filters)}`,
    ),
};

export default api;
