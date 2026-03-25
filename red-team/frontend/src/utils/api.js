import axios from "axios";

const BASE_URL = "http://localhost:4000/api";

const api = axios.create({ baseURL: BASE_URL });

// Inject token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("red_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
export { BASE_URL };
