const rawBase = import.meta.env.VITE_API_BASE || "https://insurance.bizskilledu.com/api";

export const API_BASE = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
