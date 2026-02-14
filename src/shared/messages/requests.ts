// src/shared/messages/requests.ts 

import type { PingRequest } from "./logs";

/**
 * Union of all request messages that can be sent to background.
 * These request types already live in conversations/logs/projects.
 * This file only composes them.
 */
export type AnyRequest =
  | PingRequest;
