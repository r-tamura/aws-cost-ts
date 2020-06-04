import { postCostAndUsage } from "../lib/cost";

const webhook_url = process.env["SLACK_WEBHOOK_URL"];
const channel = process.env["SLACK_CHANNEL"];

function parseEvent(event: any) {
  return [[], event] as const;
}

export function handler(event: any, _context: any) {
  if (!webhook_url) {
    throw new TypeError("'token' not set");
  }
  const [args, opts] = parseEvent(event);
  console.log({ channel, webhook_url });
  postCostAndUsage({ channel, webhook_url, ...opts });
}
