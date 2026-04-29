import { useApi } from "./useApi";
import { api } from "../api/client";

export function useSetupStatus() {
  return useApi(() => api<{ setupRequired: boolean; company?: { id: string; name: string; emergency_stopped: number; autopilot_level: number } }>("/api/setup/status"), []);
}
