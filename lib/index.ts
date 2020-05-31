import { postCostAndUsage } from "./cost";

const token = process.env["SLACK_APP_TOKEN"];
const channel = process.env["SLACK_CHANNEL"];

export function handler(event: any, _context: any) {
  if (!channel) {
    throw new TypeError("'channel' not set");
  }
  if (!token) {
    throw new TypeError("'token' not set");
  }
  const [args, opts] = parse(event);
  postCostAndUsage({ channel, token, ...opts });
}

function parse(event: any) {
  return event;
}
