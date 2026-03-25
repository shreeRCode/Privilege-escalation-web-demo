import axios from "axios";

const BASE_URL = "http://localhost:5000/api";

const api = axios.create({ baseURL: BASE_URL });

// Inject token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("blue_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
export { BASE_URL };
