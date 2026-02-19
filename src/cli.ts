import { loadConfig } from "./config.js";
import { startGateway } from "./gateway/server.js";
import { runAgentViaGateway } from "./gateway/client.js";
import { handleMessage } from "./gateway/inprocess.js";

const args = process.argv.slice(2);
const sub = args[0];

async function main(): Promise<void> {
  if (sub === "gateway") {
    startGateway();
    return;
  }

  if (sub === "agent") {
    const rest = args.slice(1);
    let message = "";
    let useGateway = true;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === "--message" && rest[i + 1] !== undefined) {
        message = rest[++i];
        break;
      }
      if (rest[i] === "--no-gateway") useGateway = false;
    }
    if (!message) message = rest.filter((a) => !a.startsWith("--")).join(" ").trim();
    if (!message) {
      console.error("Usage: emergent-mind agent --message \"your message\"");
      process.exit(1);
    }

    const config = loadConfig();
    const baseUrl = `ws://${config.gateway.bind}:${config.gateway.port}/ws`;

    if (useGateway) {
      try {
        const content = await runAgentViaGateway(message, {
          baseUrl,
          onChunk: (chunk) => process.stdout.write(chunk),
        });
        if (!content.endsWith("\n")) process.stdout.write("\n");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("ECONNREFUSED") || msg.includes("connect")) {
          console.error("Gateway not running. Start it with: emergent-mind gateway");
          console.error("Or run in-process: emergent-mind agent --no-gateway --message \"...\"");
        } else console.error(msg);
        process.exit(1);
      }
    } else {
      const reply = await handleMessage(message);
      process.stdout.write(reply);
      if (!reply.endsWith("\n")) process.stdout.write("\n");
    }
    return;
  }

  if (sub === "message" && args[1] === "send") {
    const msgArg = args.find((a) => a.startsWith("--message="));
    const message = msgArg ? msgArg.slice("--message=".length) : args.slice(3).join(" ");
    if (!message) {
      console.error("Usage: emergent-mind message send <to> --message=\"...\"");
      process.exit(1);
    }
    const config = loadConfig();
    const baseUrl = `ws://${config.gateway.bind}:${config.gateway.port}/ws`;
    try {
      const content = await runAgentViaGateway(message, { baseUrl });
      console.log(content);
    } catch (err) {
      console.error("Gateway not running or error:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
    return;
  }

  // Default: treat as agent message (backward compat)
  const message = args.join(" ").trim();
  if (!message) {
    console.error("Usage: emergent-mind gateway | emergent-mind agent --message \"...\" | emergent-mind \"your message\"");
    process.exit(1);
  }
  const config = loadConfig();
  const baseUrl = `ws://${config.gateway.bind}:${config.gateway.port}/ws`;
  try {
    const content = await runAgentViaGateway(message, {
      baseUrl,
      onChunk: (chunk) => process.stdout.write(chunk),
    });
    if (!content.endsWith("\n")) process.stdout.write("\n");
  } catch {
    const reply = await handleMessage(message);
    process.stdout.write(reply);
    if (!reply.endsWith("\n")) process.stdout.write("\n");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
