import WebSocket from "ws";
import type { ClientRequest } from "./protocol.js";

export interface AgentStreamOptions {
  baseUrl?: string;
  sessionId?: string;
  onChunk?: (chunk: string) => void;
}

/**
 * Connect to the gateway over WebSocket, send an agent request, stream the reply.
 * Returns the full content when done. Throws if gateway is unreachable or returns an error.
 */
export function runAgentViaGateway(
  message: string,
  options: AgentStreamOptions = {}
): Promise<string> {
  const { baseUrl = "ws://127.0.0.1:18789/ws", sessionId, onChunk } = options;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(baseUrl);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Gateway did not respond in time"));
    }, 120_000);

    ws.on("error", (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });

    ws.on("open", () => {
      const id = "agent-" + Date.now();
      const req: ClientRequest = {
        type: "req",
        id,
        method: "agent",
        params: { message, ...(sessionId && { sessionId }) },
      };
      ws.send(JSON.stringify(req));
    });

    let content = "";
    ws.on("message", (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === "event" && data.event === "agent") {
          const p = data.payload ?? {};
          if (p.chunk) {
            content += p.chunk;
            onChunk?.(p.chunk);
          }
          if (p.done) {
            clearTimeout(timeout);
            ws.close();
            if (p.error) reject(new Error(p.error));
            else resolve(p.content ?? content);
          }
        }
      } catch {
        // ignore
      }
    });
  });
}
