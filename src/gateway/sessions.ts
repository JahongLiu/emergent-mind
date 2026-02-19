import type { Message } from "../agent/types.js";

export interface Session {
  id: string;
  messages: Message[];
}

const sessions = new Map<string, Session>();

const MAIN_ID = "main";

export function getOrCreateSession(sessionId: string = MAIN_ID): Session {
  let s = sessions.get(sessionId);
  if (!s) {
    s = { id: sessionId, messages: [] };
    sessions.set(sessionId, s);
  }
  return s;
}

export function appendToSession(sessionId: string, userContent: string, assistantContent: string): void {
  const s = getOrCreateSession(sessionId);
  s.messages.push({ role: "user", content: userContent });
  s.messages.push({ role: "assistant", content: assistantContent });
}

export function getSessionHistory(sessionId: string): Message[] {
  return getOrCreateSession(sessionId).messages;
}
