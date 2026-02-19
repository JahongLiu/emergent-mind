import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "./types.js";
import type { CoreTool } from "./types.js";

export interface CompletionResult {
  content: string | null;
  tool_calls: Array<{ id: string; function: { name: string; arguments: string } }>;
}

const OPENAI_PREFIX = "openai/";
const ANTHROPIC_PREFIX = "anthropic/";

function normalizeModel(model: string): { provider: "openai" | "anthropic"; modelId: string } {
  if (model.startsWith(ANTHROPIC_PREFIX)) {
    return { provider: "anthropic", modelId: model.slice(ANTHROPIC_PREFIX.length) };
  }
  if (model.startsWith(OPENAI_PREFIX)) {
    return { provider: "openai", modelId: model.slice(OPENAI_PREFIX.length) };
  }
  return { provider: "openai", modelId: model };
}

function toOpenAIMessages(messages: Message[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool" as const, content: m.content ?? "", tool_call_id: m.tool_call_id! };
    }
    if (m.role === "assistant" && m.tool_calls?.length) {
      return {
        role: "assistant",
        content: m.content ?? null,
        tool_calls: m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      };
    }
    return {
      role: m.role as "system" | "user" | "assistant",
      content: m.content ?? "",
    };
  });
}

function toAnthropicTools(tools: CoreTool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: {
      type: "object" as const,
      properties: t.function.parameters.properties,
      required: t.function.parameters.required ?? [],
    },
  }));
}

function anthropicToMessages(anthropicMessages: Anthropic.MessageParam[]): Message[] {
  const out: Message[] = [];
  for (const m of anthropicMessages) {
    if (m.role === "user") {
      const content = Array.isArray(m.content)
        ? m.content.map((c) => (c.type === "text" ? c.text : "")).join("")
        : "";
      out.push({ role: "user", content });
    }
    if (m.role === "assistant") {
      const content = Array.isArray(m.content)
        ? m.content.map((c) => (c.type === "text" ? c.text : "")).join("")
        : "";
      const tool_calls = Array.isArray(m.content)
        ? (m.content as { type: string; id?: string; name?: string; input?: unknown }[])
            .filter((c) => c.type === "tool_use")
            .map((c) => ({
              id: c.id!,
              function: { name: c.name!, arguments: JSON.stringify(c.input ?? {}) },
            }))
        : [];
      out.push({ role: "assistant", content: content || null, tool_calls });
    }
  }
  return out;
}

function messagesToAnthropic(messages: Message[]): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = [];
  for (const m of messages) {
    if (m.role === "system") continue; // handled separately
    if (m.role === "user" && m.tool_call_id == null) {
      result.push({ role: "user", content: m.content ?? "" });
      continue;
    }
    if (m.role === "assistant") {
      const content: Anthropic.ContentBlockParam[] = [];
      if (m.content) content.push({ type: "text", text: m.content });
      if (m.tool_calls?.length) {
        for (const tc of m.tool_calls) {
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments || "{}"),
          });
        }
      }
      if (content.length) result.push({ role: "assistant", content });
      continue;
    }
    if (m.role === "tool") {
      result.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: m.tool_call_id!,
            content: m.content ?? "",
          },
        ],
      });
    }
  }
  return result;
}

export async function createCompletion(
  messages: Message[],
  tools: CoreTool[],
  model: string
): Promise<CompletionResult> {
  const { provider, modelId } = normalizeModel(model);

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for OpenAI models.");
    const client = new OpenAI({ apiKey });
    const openaiMessages = toOpenAIMessages(messages);
    const response = await client.chat.completions.create({
      model: modelId,
      messages: openaiMessages,
      tools: tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        },
      })),
      tool_choice: "auto",
    });
    const choice = response.choices[0]?.message;
    if (!choice) return { content: "No response.", tool_calls: [] };
    const content = typeof choice.content === "string" ? choice.content : null;
    const tool_calls = (choice.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      function: { name: tc.function.name, arguments: tc.function.arguments ?? "{}" },
    }));
    return { content, tool_calls };
  }

  // Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required for Anthropic models.");
  const client = new Anthropic({ apiKey });
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const anthMessages = messagesToAnthropic(messages.filter((m) => m.role !== "system"));
  const response = await client.messages.create({
    model: modelId,
    max_tokens: 4096,
    system,
    messages: anthMessages,
    tools: toAnthropicTools(tools),
  });

  const contentBlocks = response.content ?? [];
  let content: string | null = null;
  const tool_calls: CompletionResult["tool_calls"] = [];
  for (const block of contentBlocks) {
    if (block.type === "text") content = (content ?? "") + block.text;
    if (block.type === "tool_use") {
      tool_calls.push({
        id: block.id,
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input ?? {}),
        },
      });
    }
  }
  return { content: content || null, tool_calls };
}

export function getRequiredEnvForModel(model: string): string {
  const { provider } = normalizeModel(model);
  return provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
}
