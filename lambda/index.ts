import { IncomingWebhook } from "@slack/webhook";
import { createSlackReporter, postCostAndUsageByAccount } from "../lib/cost";

const webhook_url = process.env.SLACK_WEBHOOK_URL;
const channel = process.env.SLACK_CHANNEL;

function parseEvent(event: Record<string, unknown>) {
  return [[], event] as const;
}

export function handler(
  event: Record<string, unknown>,
  _context: Record<string, unknown>,
) {
  if (!webhook_url) {
    throw new TypeError("'token' not set");
  }
  const [_args, opts] = parseEvent(event);
  console.log({ channel, webhook_url });
  const reporter = createSlackReporter(
    channel,
    new IncomingWebhook(webhook_url),
  );
  postCostAndUsageByAccount({ ...opts }, { reporter });
}
