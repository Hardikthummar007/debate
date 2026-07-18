import axios from "axios";

// Read backend URL from environment or default to local backend port 8082
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8082";
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

// Attach JWT token to every request if present in localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("debait_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

import avatarKnight from "@/assets/avatar-knight.jpg";
import avatarAssassin from "@/assets/avatar-assassin.jpg";
import avatarQueen from "@/assets/avatar-queen.jpg";
import avatarStrategist from "@/assets/avatar-strategist.jpg";
import avatarDragonlord from "@/assets/avatar-dragonlord.jpg";

export const CHARACTER_IMAGES = {
  knight: avatarKnight,
  assassin: avatarAssassin,
  queen: avatarQueen,
  strategist: avatarStrategist,
  dragonlord: avatarDragonlord,
};

export const THEMES = [
  { id: "royal", name: "King's Landing", desc: "Gold & bronze — the throne beckons.", icon: "Crown" },
  { id: "fire",  name: "Fire & Dragons", desc: "Ember, flame, and dragonfire.", icon: "Flame" },
  { id: "snow",  name: "The North", desc: "Ice, mist, and winter's breath.", icon: "Snowflake" },
  { id: "night", name: "The Long Night", desc: "Shadows and the old gods.", icon: "Moon" },
];

export const wagerApi = {
  getActiveMatches: async () => {
    const res = await api.get("/wager");
    return res.data;
  },
  getActiveWagers: async () => {
    const res = await api.get("/wager/active");
    return res.data;
  },
  placeBet: async (matchId, side, amount) => {
    const res = await api.post("/wager/bet", { matchId, side, amount });
    return res.data;
  },
  getHistory: async () => {
    const res = await api.get("/wager/history");
    return res.data;
  },
  getStats: async () => {
    const res = await api.get("/wager/stats");
    return res.data;
  },
  getNotifications: async () => {
    const res = await api.get("/wager/notifications");
    return res.data;
  },
  markNotificationsAsRead: async () => {
    const res = await api.post("/wager/notifications/read");
    return res.data;
  },
  getSettings: async () => {
    const res = await api.get("/wager/settings");
    return res.data;
  },
  updateSettings: async (settings) => {
    const res = await api.put("/wager/settings", settings);
    return res.data;
  }
};
