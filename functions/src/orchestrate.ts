import { dueNotifications, type NotificationPayload } from "./sweep";
import type { Event } from "../../packages/core/src/domain/event";
import type { Task } from "../../packages/core/src/domain/task";

export interface OwnerWork {
  ownerId: string;
  tokens: string[];
  events: Event[];
  tasks: Task[];
  lastCheck: number;
}
export interface OwnerSend {
  ownerId: string;
  tokens: string[];
  payloads: NotificationPayload[];
}

export function planSends(owners: OwnerWork[], nowMs: number): OwnerSend[] {
  const sends: OwnerSend[] = [];
  for (const o of owners) {
    if (o.tokens.length === 0) continue;
    const payloads = dueNotifications(o.events, o.tasks, o.lastCheck, nowMs);
    if (payloads.length > 0) sends.push({ ownerId: o.ownerId, tokens: o.tokens, payloads });
  }
  return sends;
}
