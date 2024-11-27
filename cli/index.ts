import { IncomingWebhook } from "@slack/webhook";
import arg from "arg";
import { createSlackReporter, postCostAndUsageByAccount } from "../lib/cost";

const webhook_url = process.env.SLACK_WEBHOOK_URL;

function parse(argv: string[]) {
  const spec = {
    "--start": String,
    "-s": "--start",
    "--end": String,
    "-e": "--end",
    "--help": Boolean,
    "-h": "--help",
  };
  const parsed = arg(spec, { argv });
  return [parsed._, parsed] as const;
}

type Options = ReturnType<typeof parse>[1];

function blankLine() {
  console.log("");
}

function usage() {
  blankLine();
  console.log("usage:", "awscost <channel>");
  blankLine();
  console.log("environment variables:");
  console.log("    SLACK_WEBHOOK_URL:  Slack Webhook URL (required)");
  console.log("    SLACK_CHANNEL    :  Slack channel");
  blankLine();
}

export async function main(argv: string[]) {
  const [args, opts] = parse(argv);
  if (opts["--help"]) {
    displayHelp(args, opts);
  } else {
    postCostAndUsageToSlack(args, opts);
  }
}

async function displayHelp(args: string[], opts: Options) {
  usage();
}

async function postCostAndUsageToSlack(args: string[], opts: Options) {
  const channelFromEnv = process.env.SLACK_CHANNEL;
  if (args.length < 1 && !channelFromEnv) {
    console.error("argument 'channel' is required.");
    usage();
    process.exit(1);
  }

  if (!webhook_url) {
    console.log(
      `Your webhook URL must be set via environment variable 'SLACK_WEBHOOK_URL'.`,
    );
    process.exit(2);
  }
  const channel = args[0] ?? channelFromEnv;
  const reporter = createSlackReporter(
    channel,
    new IncomingWebhook(webhook_url),
  );
  await postCostAndUsageByAccount(
    {
      start: opts["--start"] ? new Date(opts["--start"]) : undefined,
    },
    { reporter },
  );

  console.log(`daily cost was sent to channel '${channel}'.`);
}
