import { postCostAndUsage } from "../lib/cost";
import * as arg from "arg";

const token = process.env["SLACK_APP_TOKEN"];

function parse(argv: string[]) {
  const spec = {
    "--start": String,
    "-s": "--start",
    "--end": String,
    "-e": "--end",
  };
  const parsed = arg(spec, { argv });
  return [parsed._, parsed] as const;
}

function blankLine() {
  console.log("");
}

function usage() {
  blankLine();
  console.log("usage:", "awscost <channel>");
  blankLine();
  console.log("environment variables:");
  console.log("    SLACK_APP_TOKEN:  Slack OAuth Token (required)");
  console.log("    SLACK_CHANNEL  :  Slack channel");
  blankLine();
}

export async function main(argv: string[]) {
  const [args, opts] = parse(argv);

  const channelFromEnv = process.env["SLACK_CHANNEL"];
  if (args.length < 1 && !channelFromEnv) {
    console.error("argument 'channel' is required.");
    usage();
    process.exit(1);
  }

  if (!token) {
    console.log(
      `Your OAuth token must be set via environment variable 'SLACK_APP_TOKEN'.`
    );
    process.exit(2);
  }
  const channel = args[0] ?? channelFromEnv;
  await postCostAndUsage({ channel, token });

  console.log(`daily cost was sent to channel '${channel}'.`);
}
