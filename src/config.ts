import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface GatewayConfig {
  port: number;
  bind: string;
}

export interface AgentConfig {
  model: string;
  /** Workspace root for prompts and tool cwd. Default ~/.emergent-mind/workspace */
  workspace?: string;
}

export interface Config {
  gateway: GatewayConfig;
  agent: AgentConfig;
}

const CONFIG_DIR = process.env.EMERGENT_MIND_CONFIG_DIR ?? join(homedir(), ".emergent-mind");
const DEFAULT_WORKSPACE = join(CONFIG_DIR, "workspace");

const DEFAULT_CONFIG: Config = {
  gateway: {
    port: 18789,
    bind: "127.0.0.1",
  },
  agent: {
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    workspace: DEFAULT_WORKSPACE,
  },
};

const CONFIG_PATH = process.env.EMERGENT_MIND_CONFIG ?? join(CONFIG_DIR, "config.json");

export function loadConfig(): Config {
  const envModel = process.env.OPENAI_MODEL;
  let loaded: Partial<Config> = {};
  if (existsSync(CONFIG_PATH)) {
    try {
      loaded = JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as Partial<Config>;
    } catch {
      // ignore invalid config
    }
  }
  return {
    gateway: { ...DEFAULT_CONFIG.gateway, ...loaded.gateway },
    agent: { ...DEFAULT_CONFIG.agent, ...loaded.agent, ...(envModel && { model: envModel }) },
  };
}

export { CONFIG_DIR, CONFIG_PATH };
