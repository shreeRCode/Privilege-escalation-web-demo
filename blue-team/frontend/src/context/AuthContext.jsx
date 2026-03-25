import { createContext, useContext, useState, useEffect } from "react";
import api from "../utils/api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("blue_token"));

  useEffect(() => {
    if (token) {
      // FIX: Fetch real user data from server instead of trusting token payload
      api.get("/auth/me")
        .then((res) => setUser(res.data.user))
        .catch(() => {
          // Token invalid — clear it
          localStorage.removeItem("blue_token");
          setToken(null);
          setUser(null);
        });
    }
  }, [token]);

  const login = async (username, password) => {
    const res = await api.post("/auth/login", { username, password });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem("blue_token", newToken);
    setToken(newToken);
    setUser(userData);
    return res.data;
  };

  const register = async (data) => {
    const res = await api.post("/auth/register", data);
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem("blue_token", newToken);
    setToken(newToken);
    setUser(userData);
    return res.data;
  };

  // FIX: No useForgedToken method — JWT tampering not supported

  const logout = () => {
    localStorage.removeItem("blue_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
