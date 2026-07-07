import api from "./client";
import type { ConfigGroup, ConfigValueUpdate } from "@/types/user";

export const configApi = {
  listGroups: () =>
    api.get<string[]>("/config/groups").then((r) => r.data),
  getGroup: (group: string) =>
    api.get<ConfigGroup>("/config", { params: { group } }).then((r) => r.data),
  getValue: (key: string) =>
    api.get(`/config/${key}`).then((r) => r.data),
  updateValue: (key: string, value: ConfigValueUpdate) =>
    api.put(`/config/${key}`, value).then((r) => r.data),
  getHistory: (key: string) =>
    api.get("/config/history", { params: { key } }).then((r) => r.data),
};
