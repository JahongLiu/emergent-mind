/** Wire protocol: request from client. */
export interface ClientRequest {
  type: "req";
  id: string;
  method: "agent" | "health";
  params?: Record<string, unknown>;
}

/** Agent request params. */
export interface AgentParams {
  message: string;
  sessionId?: string;
}

/** Server response. */
export interface ServerResponse {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: string;
}

/** Server-push event (e.g. agent stream). */
export interface ServerEvent {
  type: "event";
  event: string;
  payload: unknown;
}

export type WireFrame = ClientRequest | ServerResponse | ServerEvent;
