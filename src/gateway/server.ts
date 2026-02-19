import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { loadConfig } from "../config.js";
import { runAgent } from "../agent/loop.js";
import type { ClientRequest, ServerEvent, ServerResponse } from "./protocol.js";
import { getSessionHistory, appendToSession } from "./sessions.js";

export function startGateway(): void {
  const config = loadConfig();
  const { port, bind } = config.gateway;
  const { model, workspace: workspaceRoot } = config.agent;

  const httpServer = createServer((req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(getWebChatHtml());
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      try {
        const frame = JSON.parse(raw.toString()) as ClientRequest;
        if (frame.type !== "req" || !frame.id) return;

        const ack: ServerResponse = { type: "res", id: frame.id, ok: true };
        ws.send(JSON.stringify(ack));

        if (frame.method === "health") {
          ws.send(JSON.stringify({ type: "res", id: frame.id, ok: true, payload: { status: "ok" } }));
          return;
        }

        if (frame.method === "agent") {
          const params = (frame.params ?? {}) as { message?: string; sessionId?: string };
          const message = params.message ?? "";
          const sessionId = params.sessionId ?? "main";

          const history = getSessionHistory(sessionId);
          const sendEvent = (payload: ServerEvent["payload"]) => {
            ws.send(JSON.stringify({ type: "event", event: "agent", payload }));
          };

          runAgent(message, {
            history,
            model,
            workspaceRoot: workspaceRoot ?? undefined,
            onChunk: (chunk) => sendEvent({ chunk }),
          })
            .then((content) => {
              sendEvent({ done: true, content });
              appendToSession(sessionId, message, content);
            })
            .catch((err) => {
              const error = err instanceof Error ? err.message : String(err);
              sendEvent({ done: true, error });
            });
        }
      } catch {
        // ignore parse errors
      }
    });
  });

  httpServer.listen(port, bind, () => {
    console.error(`Gateway listening on http://${bind}:${port}`);
    console.error(`  WebChat: http://${bind}:${port}/`);
    console.error(`  WebSocket: ws://${bind}:${port}/ws`);
  });
}

function getWebChatHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Emergent Mind</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
    #log { border: 1px solid #ccc; border-radius: 8px; min-height: 200px; padding: 1rem; margin-bottom: 1rem; white-space: pre-wrap; }
    #input { display: flex; gap: 0.5rem; }
    #input input { flex: 1; padding: 0.5rem; border: 1px solid #ccc; border-radius: 6px; }
    #input button { padding: 0.5rem 1rem; background: #333; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    .user { color: #06c; margin-bottom: 0.5rem; }
    .assistant { color: #363; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <h1>Emergent Mind</h1>
  <div id="log"></div>
  <div id="input">
    <input type="text" id="msg" placeholder="Message..." />
    <button id="send">Send</button>
  </div>
  <script>
    const log = document.getElementById('log');
    const input = document.getElementById('msg');
    const sendBtn = document.getElementById('send');
    const wsUrl = (location.origin.replace(/^http/, 'ws') + '/ws');
    let ws = null;
    let reqId = 0;
    let currentAssistant = null;

    function connect() {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => { log.appendChild(document.createTextNode('Connected.\\n')); };
      ws.onclose = () => { log.appendChild(document.createTextNode('Disconnected.\\n')); setTimeout(connect, 2000); };
      ws.onerror = () => {};
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'event' && data.event === 'agent') {
          const p = data.payload || {};
          if (p.chunk) {
            if (!currentAssistant) {
              currentAssistant = document.createElement('div');
              currentAssistant.className = 'assistant';
              currentAssistant.textContent = p.chunk;
              log.appendChild(currentAssistant);
            } else currentAssistant.textContent += p.chunk;
          }
          if (p.done) {
            if (p.error) (currentAssistant || log).appendChild(document.createTextNode('Error: ' + p.error));
            currentAssistant = null;
          }
        }
      };
    }
    connect();

    function send() {
      const message = input.value.trim();
      if (!message || !ws || ws.readyState !== WebSocket.OPEN) return;
      const id = String(++reqId);
      const userLine = document.createElement('div');
      userLine.className = 'user';
      userLine.textContent = 'You: ' + message;
      log.appendChild(userLine);
      input.value = '';
      ws.send(JSON.stringify({ type: 'req', id, method: 'agent', params: { message } }));
    }
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  </script>
</body>
</html>`;
}
