import { createContext, useContext, useState, useEffect } from "react";
import api from "../utils/api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("red_token"));

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUser(payload);
      } catch {}
    }
  }, [token]);

  const login = async (username, password) => {
    const res = await api.post("/auth/login", { username, password });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem("red_token", newToken);
    setToken(newToken);
    setUser(userData);
    return res.data;
  };

  const register = async (data) => {
    const res = await api.post("/auth/register", data);
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem("red_token", newToken);
    setToken(newToken);
    setUser(userData);
    return res.data;
  };

  const useForgedToken = (forgedToken) => {
    localStorage.setItem("red_token", forgedToken);
    setToken(forgedToken);
    try {
      const payload = JSON.parse(atob(forgedToken.split(".")[1]));
      setUser(payload);
    } catch {}
  };

  const logout = () => {
    localStorage.removeItem("red_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, useForgedToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
