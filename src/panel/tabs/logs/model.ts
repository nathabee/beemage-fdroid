// src/panel/tabs/logs/model.ts
import type { ActionLogEntry } from "../../../shared/actionLog";

export function createLogsModel() {
  let items: ActionLogEntry[] = [];
  let total = 0;

  function set(next: { items: ActionLogEntry[]; total: number }) {
    items = next.items;
    total = next.total;
  }

  return {
    get items() {
      return items;
    },
    get total() {
      return total;
    },
    set,
  };
}
