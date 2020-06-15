import * as path from "path";
import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import * as events from "@aws-cdk/aws-events";
import * as targets from "@aws-cdk/aws-events-targets";
import * as sm from "@aws-cdk/aws-secretsmanager";
import * as lambda from "@aws-cdk/aws-lambda-nodejs";

const ASSET_PATH = path.join(__dirname, "..", "..", "lambda", "index.ts");

export class AppStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
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

    const secret = sm.Secret.fromSecretAttributes(this, "ImportedSecret", {
      secretArn:
        "arn:aws:secretsmanager:ap-northeast-1:878754454461:secret:prod/DailyCost-DK8Eje",
    });

    const lambdaFn = new lambda.NodejsFunction(this, "AWSCostFunction", {
      entry: ASSET_PATH,
      handler: "handler",
      environment: {
        SLACK_WEBHOOK_URL: secret
          .secretValueFromJson("SLACK_WEBHOOK_URL")
          .toString(),
      },
      role: lambdaRole,
    });

    new events.Rule(this, "DailyCost", {
      schedule: events.Schedule.expression("cron(10 15 ? * MON-FRI *)"), // 0:10 AM JST
      targets: [new targets.LambdaFunction(lambdaFn)],
    });
  }
}
