import OpenAI from "openai";
import type { Message } from "./types.js";
import { tools } from "../tools/definitions.js";
import { runTool } from "../tools/runner.js";

const SYSTEM_PROMPT = `You are a helpful agent that does things. You have access to tools: run_shell (run shell commands) and read_file (read file contents). Use them when needed to answer the user. Be concise. If you run commands, summarize what you did and the result.`;

const MAX_TURNS = 10;

export interface RunAgentOptions {
  /** Previous conversation turns (user/assistant) for context. */
  history?: Message[];
  /** Called with content chunks when the model streams the final reply. */
  onChunk?: (chunk: string) => void;
  model?: string;
}

export async function runAgent(
  userMessage: string,
  options: RunAgentOptions = {}
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Set OPENAI_API_KEY to run the agent.");
  }

  const { history = [], onChunk, model: modelOverride } = options;
  const client = new OpenAI({ apiKey });
  const model = modelOverride ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.filter((m) => m.role !== "system"),
    { role: "user", content: userMessage },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.chat.completions.create({
      model,
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      tools: tools as OpenAI.Chat.Completions.ChatCompletionTool[],
      tool_choice: "auto",
      stream: false,
    });

    const choice = response.choices[0];
    if (!choice?.message) {
      return "No response from model.";
    }

    const msg = choice.message;

    if (msg.content && typeof msg.content === "string" && !msg.tool_calls?.length) {
      if (onChunk) onChunk(msg.content);
      return msg.content;
    }

    messages.push({
      role: "assistant",
      content: msg.content ?? null,
      tool_calls: msg.tool_calls as Message["tool_calls"],
    });

    if (!msg.tool_calls?.length) {
      const content = (msg.content as string) || "Done.";
      if (onChunk) onChunk(content);
      return content;
    }

    for (const tc of msg.tool_calls) {
      const name = tc.function.name;
      const args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
      let result: string;
      try {
        result = runTool(name, args);
      } catch (err) {
        result = `Error: ${(err as Error).message}`;
      }
      messages.push({
        role: "tool",
        content: result,
        tool_call_id: tc.id,
      } as Message);
    }
  }

  const fallback = "Max turns reached.";
  if (onChunk) onChunk(fallback);
  return fallback;
}
