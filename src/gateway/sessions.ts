import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "../config.js";
import type { Message } from "../agent/types.js";

export interface Session {
  id: string;
  messages: Message[];
}

const sessions = new Map<string, Session>();
const SESSIONS_DIR = join(CONFIG_DIR, "sessions");
const MAIN_ID = "main";

function sessionPath(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(SESSIONS_DIR, safe + ".json");
}

function loadFromDisk(sessionId: string): Session | null {
  const path = sessionPath(sessionId);
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, "utf-8")) as { messages?: unknown[] };
    const messages = (data.messages ?? []) as Message[];
    return { id: sessionId, messages };
  } catch {
    return null;
  }
}

function saveToDisk(session: Session): void {
  mkdirSync(SESSIONS_DIR, { recursive: true });
  const path = sessionPath(session.id);
  writeFileSync(path, JSON.stringify({ messages: session.messages }, null, 0), "utf-8");
}

export function getOrCreateSession(sessionId: string = MAIN_ID): Session {
  let s = sessions.get(sessionId);
  if (!s) {
    s = loadFromDisk(sessionId) ?? { id: sessionId, messages: [] };
    sessions.set(sessionId, s);
  }
  return s;
}

export function appendToSession(
  sessionId: string,
  userContent: string,
  assistantContent: string
): void {
  const s = getOrCreateSession(sessionId);
  s.messages.push({ role: "user", content: userContent });
  s.messages.push({ role: "assistant", content: assistantContent });
  saveToDisk(s);
}

export function getSessionHistory(sessionId: string): Message[] {
  return getOrCreateSession(sessionId).messages;
}
