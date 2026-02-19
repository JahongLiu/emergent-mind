import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

function getAllowedRoot(workspaceRoot?: string): string {
  return workspaceRoot ?? process.cwd();
}

function safePath(path: string, allowedRoot: string): string {
  const resolved = resolve(allowedRoot, path);
  if (!resolved.startsWith(allowedRoot)) {
    throw new Error(`Path not allowed: ${path}`);
  }
  return resolved;
}

export interface RunToolOptions {
  workspaceRoot?: string;
}

export function runTool(
  name: string,
  args: Record<string, unknown>,
  options: RunToolOptions = {}
): string {
  const root = getAllowedRoot(options.workspaceRoot);
  switch (name) {
    case "run_shell": {
      const command = args.command as string;
      if (typeof command !== "string") throw new Error("run_shell requires command");
      try {
        const out = execSync(command, {
          encoding: "utf-8",
          maxBuffer: 1024 * 1024,
          cwd: root,
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
      const resolved = safePath(path, root);
      try {
        return readFileSync(resolved, "utf-8");
      } catch (err: unknown) {
        return `Error reading file: ${(err as Error).message}`;
      }
    }
    case "write_file": {
      const path = args.path as string;
      const content = args.content as string;
      if (typeof path !== "string") throw new Error("write_file requires path");
      if (typeof content !== "string") throw new Error("write_file requires content");
      const resolved = safePath(path, root);
      try {
        mkdirSync(dirname(resolved), { recursive: true });
        writeFileSync(resolved, content, "utf-8");
        return `Wrote ${path}`;
      } catch (err: unknown) {
        return `Error writing file: ${(err as Error).message}`;
      }
    }
    default:
      return `Unknown tool: ${name}`;
  }
}
