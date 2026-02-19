/**
 * CLI channel: message comes from argv, reply goes to stdout.
 */
export function getMessageFromArgs(): string {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    return "Hello — what would you like me to do? (Pass your message as arguments, e.g. npm start -- \"list files in this directory\")";
  }
  return args.join(" ").trim();
}
