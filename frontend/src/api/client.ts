import axios from "axios";

const client = axios.create({ withCredentials: true });

// Transparently retry once on 401 — attempt token refresh first
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url?.includes("/api/auth/")) {
      original._retry = true;
      try {
        await axios.post("/api/auth/refresh", {}, { withCredentials: true });
        return client(original);
      } catch (refreshErr: any) {
        // 401 on refresh with this detail = another browser took over the session.
        const taken = refreshErr?.response?.data?.detail === "Signed in on another device";
        window.location.href = taken ? "/login?taken=1" : "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default client;
