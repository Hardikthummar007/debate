import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem("debait_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/users/profile");
      setUser(data);
    } catch (err) {
      localStorage.removeItem("debait_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (username, password) => {
    const { data } = await api.post("/auth/login", { username, password });
    localStorage.setItem("debait_token", data.token);
    // Fetch profile details immediately after successful login to populate ELO, XP, etc.
    const res = await api.get("/users/profile");
    setUser(res.data);
    return res.data;
  };

  const register = async (username, email, password) => {
    const { data } = await api.post("/auth/register", { username, email, password });
    // After registration, automatically login
    return login(username, password);
  };

  const logout = () => {
    localStorage.removeItem("debait_token");
    setUser(null);
  };

  const updateProfile = async (updates) => {
    const { data } = await api.put("/users/profile", updates);
    // Reload user profile details
    const res = await api.get("/users/profile");
    setUser(res.data);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, updateProfile, refresh: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
