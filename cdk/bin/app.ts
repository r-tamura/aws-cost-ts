import { App } from "aws-cdk-lib";
import { DaylyCostSlackNotificationStack } from "../lib/DailyCostStack";

interface EnvironmentVariables {
  SLACK_WEBHOOK_URL_SECRETSMANAGER_ARN: string;
}

function getArgsFromEnv() {
  const SLACK_WEBHOOK_URL_SECRETSMANAGER_ARN =
    process.env["SLACK_WEBHOOK_URL_SECRETSMANAGER_ARN"];

  if (SLACK_WEBHOOK_URL_SECRETSMANAGER_ARN === undefined) {
    throw Error(
      "environment variable 'SLACK_WEBHOOK_URL_SECRETSMANAGER_ARN' is required"
    );
  }
  return {
    SLACK_WEBHOOK_URL_SECRETSMANAGER_ARN,
  };
}

const envs = getArgsFromEnv();

const app = new App();
new DaylyCostSlackNotificationStack(app, "DailyCost", {
  slackWebhookUrlsecretsmanagerArn: envs.SLACK_WEBHOOK_URL_SECRETSMANAGER_ARN
});

app.synth();
