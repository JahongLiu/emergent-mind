import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_SYSTEM = `You are a helpful agent that does things. You have access to tools: run_shell (run shell commands), read_file (read file contents), and write_file (write content to a file). Use them when needed to answer the user. Be concise. If you run commands or edit files, summarize what you did and the result.`;

/**
 * Load system prompt from workspace: AGENTS.md (primary), TOOLS.md, and skills/<name>/SKILL.md if present.
 */
export function loadSystemPrompt(workspaceRoot: string): string {
  const agentsPath = join(workspaceRoot, "AGENTS.md");
  const toolsPath = join(workspaceRoot, "TOOLS.md");
  const skillsDir = join(workspaceRoot, "skills");
  const parts: string[] = [];

  if (existsSync(agentsPath)) {
    try {
      parts.push(readFileSync(agentsPath, "utf-8").trim());
    } catch {
      parts.push(DEFAULT_SYSTEM);
    }
  } else {
    parts.push(DEFAULT_SYSTEM);
  }

  if (existsSync(toolsPath)) {
    try {
      parts.push("\n\n---\n\n" + readFileSync(toolsPath, "utf-8").trim());
    } catch {
      // skip
    }
  }

  if (existsSync(skillsDir)) {
    try {
      const names = readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
      for (const name of names) {
        const skillPath = join(skillsDir, name, "SKILL.md");
        if (existsSync(skillPath)) {
          parts.push("\n\n---\n\n## Skill: " + name + "\n\n" + readFileSync(skillPath, "utf-8").trim());
        }
      }
    } catch {
      // skip
    }
  }

  return parts.join("");
}
