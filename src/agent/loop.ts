import type { Message } from "./types.js";
import { tools } from "../tools/definitions.js";
import { runTool } from "../tools/runner.js";
import { createCompletion, getRequiredEnvForModel } from "./llm.js";
import { loadSystemPrompt } from "../workspace/prompts.js";

const MAX_TURNS = 10;

export interface RunAgentOptions {
  history?: Message[];
  onChunk?: (chunk: string) => void;
  model?: string;
  /** Workspace root for system prompt and tool cwd */
  workspaceRoot?: string;
}

export async function runAgent(
  userMessage: string,
  options: RunAgentOptions = {}
): Promise<string> {
  const { history = [], onChunk, model: modelOverride, workspaceRoot } = options;
  const model = modelOverride ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const envKey = getRequiredEnvForModel(model);
  if (!process.env[envKey]) {
    throw new Error(`Set ${envKey} to run the agent.`);
  }

  const systemPrompt = workspaceRoot
    ? loadSystemPrompt(workspaceRoot)
    : `You are a helpful agent that does things. You have access to tools: run_shell, read_file, write_file. Use them when needed. Be concise.`;

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    ...history.filter((m) => m.role !== "system"),
    { role: "user", content: userMessage },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const { content, tool_calls } = await createCompletion(messages, tools, model);

    if (content && (!tool_calls || tool_calls.length === 0)) {
      if (onChunk) onChunk(content);
      return content;
    }

    messages.push({
      role: "assistant",
      content,
      tool_calls: tool_calls.map((tc) => ({
        id: tc.id,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })),
    });

    if (!tool_calls?.length) {
      const text = content || "Done.";
      if (onChunk) onChunk(text);
      return text;
    }

    for (const tc of tool_calls) {
      const name = tc.function.name;
      const args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
      let result: string;
      try {
        result = runTool(name, args, { workspaceRoot });
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
