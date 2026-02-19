import type { CoreTool } from "../agent/types.js";

export const tools: CoreTool[] = [
  {
    type: "function",
    function: {
      name: "run_shell",
      description: "Run a shell command on the host. Use for listing files, running scripts, or any terminal task. Prefer simple, single commands.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The shell command to run (e.g. ls -la, pwd)" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file. Path is relative to the workspace or current working directory.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file to read" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file. Creates the file if it does not exist; overwrites if it does. Path is relative to the workspace or current working directory.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file to write" },
          content: { type: "string", description: "Content to write to the file" },
        },
        required: ["path", "content"],
      },
    },
  },
];
