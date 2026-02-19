import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ALLOWED_CWD = process.cwd();

function safePath(path: string): string {
  const resolved = resolve(ALLOWED_CWD, path);
  if (!resolved.startsWith(ALLOWED_CWD)) {
    throw new Error(`Path not allowed: ${path}`);
  }
  return resolved;
}

export function runTool(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "run_shell": {
      const command = args.command as string;
      if (typeof command !== "string") throw new Error("run_shell requires command");
      try {
        const out = execSync(command, {
          encoding: "utf-8",
          maxBuffer: 1024 * 1024,
          cwd: ALLOWED_CWD,
        });
        return out || "(no output)";
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; message?: string };
        const stderr = e?.stderr ?? e?.message ?? String(err);
        return `Error: ${stderr}`;
      }
    }
    case "read_file": {
      const path = args.path as string;
      if (typeof path !== "string") throw new Error("read_file requires path");
      const resolved = safePath(path);
      try {
        return readFileSync(resolved, "utf-8");
      } catch (err: unknown) {
        return `Error reading file: ${(err as Error).message}`;
      }
    }
    default:
      return `Unknown tool: ${name}`;
  }
}
