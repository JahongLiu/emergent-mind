# Emergent Mind

An AI agent that actually does things: takes requests, reasons with an LLM, and runs tools (shell, files) to get them done. One control plane (gateway), multiple ways to talk to it (CLI, WebChat).

---

## Goal

- **Personal agent** that runs on your machine and uses your tools.
- **Single control plane** — a long-lived gateway process. CLI, WebChat, and future channels connect to it; one agent serves all.
- **Sessions** — the agent keeps conversation context per session (default: `main`).
- **Brain + hands** — an LLM for reasoning and tools: run shell, read file, write file.
- **Workspace** — optional workspace root with `AGENTS.md`, `TOOLS.md`, and `skills/*/SKILL.md` to shape the agent.
- **Sessions** are persisted to disk so context survives gateway restarts.

---

## Architecture

1. **Gateway (control plane)**  
   A daemon that listens on a port (default `18789`). It accepts WebSocket connections, keeps sessions, and runs the agent when you send a message. One gateway per machine. It also serves a small WebChat UI and a health endpoint.

2. **Agent**  
   The core loop: receive a message, call the LLM with context and tools, execute tool calls, repeat until the model returns a final answer, then send the reply back. The agent is “brain” (LLM) plus “hands” (tools).

3. **Channels**  
   How you talk to the agent. Each channel connects to the gateway (over WebSocket or HTTP). Built-in: **CLI** (terminal) and **WebChat** (browser). The same agent and session back both.

```
CLI / WebChat / future channels  →  Gateway (WS + HTTP)  →  Agent (LLM + tools)
                                              ↑
                                    sessions, routing
```

---

## Quick start

**1. Install and build**

```bash
npm install
npm run build
```

**2. Set your API key** (OpenAI or Anthropic)

```bash
export OPENAI_API_KEY=sk-...
# Or for Anthropic: export ANTHROPIC_API_KEY=sk-ant-...
```

**3. Run the gateway** (in one terminal)

```bash
npm start -- gateway
```

**4. Talk to the agent** (in another terminal, or use the browser)

```bash
# CLI
npm start -- "What's in my home directory?"
npm start -- agent --message "List files in the current folder"

# Or open in browser: http://127.0.0.1:18789/
```

If the gateway is not running, you can still run a one-off agent locally:

```bash
npm start -- agent --no-gateway --message "Hello"
```

---

## Commands

| Command | Description |
|--------|-------------|
| `emergent-mind gateway` | Start the gateway daemon (WebSocket + WebChat + health). |
| `emergent-mind agent --message "..."` | Send a message to the agent via the gateway; streams the reply. |
| `emergent-mind agent --no-gateway --message "..."` | Run the agent in-process (no gateway). |
| `emergent-mind message send --message="..."` | Send a message through the gateway (same as agent, different form). |
| `emergent-mind "your message"` | Shorthand: same as agent with that message (tries gateway, then in-process). |

---

## Configuration

Config file: `~/.emergent-mind/config.json` (optional). Override with `EMERGENT_MIND_CONFIG`.

Example:

```json
{
  "gateway": {
    "port": 18789,
    "bind": "127.0.0.1"
  },
  "agent": {
    "model": "gpt-4o-mini",
    "workspace": "~/.emergent-mind/workspace"
  }
}
```

- **model** — Use `gpt-4o-mini`, `gpt-4o`, or any OpenAI model. For Anthropic use the `anthropic/` prefix, e.g. `anthropic/claude-3-5-sonnet-20241022`.
- **workspace** — Directory for agent identity and skills. If present, the agent loads system prompt from `AGENTS.md`, optional `TOOLS.md`, and any `skills/<name>/SKILL.md`. Tool paths (read_file, write_file, run_shell cwd) are relative to this directory. Default: `~/.emergent-mind/workspace`.

Environment: `OPENAI_API_KEY` (for OpenAI models), `ANTHROPIC_API_KEY` (for Anthropic models). `OPENAI_MODEL` overrides config model.

---

## Project layout

- `src/` — TypeScript source
  - `gateway/` — Control plane: WebSocket server, sessions, protocol, WebChat HTML, in-process and client helpers
  - `agent/` — Agent loop: LLM calls, tool execution
  - `channels/` — Channel helpers (CLI input)
  - `tools/` — Tool definitions and runner (run_shell, read_file, write_file)
  - `workspace/` — Load workspace prompts (AGENTS.md, TOOLS.md, skills)
  - `config.ts` — Load config from file and env
  - `cli.ts` — CLI entry (gateway, agent, message)
- `dist/` — Build output (`npm run build`)

---

## Roadmap

- [x] **Gateway daemon** — WebSocket server, sessions, health, WebChat
- [x] **CLI** — gateway, agent, message send; fallback in-process
- [x] **Workspace** — AGENTS.md, TOOLS.md, skills/*/SKILL.md; tool cwd
- [x] **Session persistence** — Sessions saved to disk under `~/.emergent-mind/sessions/`
- [x] **Multi-provider** — OpenAI and Anthropic (model prefix `anthropic/`)
- [x] **write_file** tool
- [ ] **More tools** — Browser, custom skills
- [ ] **More channels** — Optional integrations (e.g. messaging, voice)

---

## Contributing

Open an issue or PR. One topic per PR.
