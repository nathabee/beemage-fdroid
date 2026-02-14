// src/shared/messages/logs.ts 
import { MSG } from "./msg";

/* PING */
export type PingRequest = { type: typeof MSG.PING };
export type PingResponse = { ok: true };
 