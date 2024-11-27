import {
  aws_events as events,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_lambda_nodejs as nodejs,
  aws_secretsmanager as sm,
  Stack,
  aws_events_targets as targets,
  type StackProps,
} from "aws-cdk-lib";
import type { Construct } from "constructs";
import * as path from "node:path";

const ASSET_PATH = path.join(__dirname, "..", "..", "lambda", "index.ts");

export interface AWSDailyCostSlackReportStackProps extends StackProps {
  /**
   * The ARN of the AWS SecretsManager that stores the Slack webhook URL.
   */
  slackWebhookUrlSecretsManagerArn: string;
}

export class AWSDailyCostSlackReportStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    {
      slackWebhookUrlSecretsManagerArn: secretsmanagerArn,
      ...props
    }: AWSDailyCostSlackReportStackProps,
  ) {
    super(scope, id, props);

    const lambdaPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["ce:GetCostAndUsage"],
          resources: ["*"],
        }),
      ],
    });

    const lambdaRole = new iam.Role(this, "LambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      inlinePolicies: {
        lambdaPolicy,
      },
    });
    lambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaBasicExecutionRole",
      ),
    );

    const secret = sm.Secret.fromSecretAttributes(this, "ImportedSecret", {
      secretCompleteArn: secretsmanagerArn,
    });

    const lambdaFn = new nodejs.NodejsFunction(this, "AWSCostFunction", {
      entry: ASSET_PATH,
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_LATEST,
      environment: {
        SLACK_WEBHOOK_URL: secret
          .secretValueFromJson("SLACK_WEBHOOK_URL")
          .toString(),
      },
      role: lambdaRole,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    new events.Rule(this, "DailyCost", {
      schedule: events.Schedule.expression("cron(10 15 ? * * *)"), // 0:30 AM JST
      targets: [new targets.LambdaFunction(lambdaFn)],
    });
  }
}
