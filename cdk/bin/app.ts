import { App } from "aws-cdk-lib";
import z from "zod";
import { AWSDailyCostSlackReportStack } from "../lib/AWSDailyCostReportStack";

const appConfigSchema = z.object({
  name: z.string().toLowerCase(),
  // スタック名のサフィックス
  // 例: 'dev'の場合のスタック名は`AWSDailyCostReporter-dev`
  stackNameSuffix: z.string().toLowerCase().optional(),
  reporter: z.object({
    type: z.literal("slack-webhook"),
    // SlackのWebhook URLが保存されたAWS Secrets ManagerのシークレットのARN
    webhookUrlSecretsManagerArn: z.string(),
  }),
});

type AppConfig = z.infer<typeof appConfigSchema>;

function createConfigFromContext(app: App): AppConfig {
  const envKey = app.node.tryGetContext("environment");
  if (envKey === undefined) {
    throw new Error("usage: cdk deploy -c environment=<env name>");
  }

  const appConfigRaw = app.node.tryGetContext(envKey);
  if (appConfigRaw === undefined) {
    throw new Error(
      `parameters for environment '${envKey}' is not found in the context. set parameters in cdk.context.json.`
    );
  }

  const appConfig = appConfigSchema.parse(appConfigRaw);
  return appConfig;
}

const app = new App();

const appConfig = createConfigFromContext(app);

new AWSDailyCostSlackReportStack(
  app,
  `AWSDailyCostReporter-${appConfig.stackNameSuffix}`,
  {
    slackWebhookUrlSecretsManagerArn:
      appConfig.reporter.webhookUrlSecretsManagerArn,
  }
);

app.synth();
