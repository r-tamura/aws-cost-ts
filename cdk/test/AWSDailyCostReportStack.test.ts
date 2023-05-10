import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { AWSDaylyCostSlackReportStack } from "../lib/AWSDailyCostReportStack";

describe("DailyCostSlackNotificationStack", () => {
  test("利用コストをAWS APIから取得してSlackへ通知するLambda関数が定義されている", () => {
    // WHEN
    const app = new App();
    const testSecresmanagerSecretArn =
      "arn:aws:secretsmanager:ap-northeast-1:878754454461:secret:prod/DailyCost-xxxxxx";
    const stack = new AWSDaylyCostSlackReportStack(
      app,
      "Test-AWSDailyCostReporter",
      {
        slackWebhookUrlSecretsManagerArn: testSecresmanagerSecretArn,
      }
    );
    // THEN
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.handler",
      Runtime: "nodejs18.x",
      Environment: {
        Variables: {
          SLACK_WEBHOOK_URL: Match.stringLikeRegexp(testSecresmanagerSecretArn),
        },
      },
    });

    template.hasResourceProperties(
      "AWS::IAM::Role",
      Match.objectEquals({
        AssumeRolePolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Action: "sts:AssumeRole",
              Effect: "Allow",
              Principal: {
                Service: "lambda.amazonaws.com",
              },
            },
          ],
        },
        Policies: [
          {
            PolicyName: Match.anyValue(),
            PolicyDocument: {
              Version: "2012-10-17",
              Statement: [
                {
                  Action: "ce:GetCostAndUsage",
                  Effect: "Allow",
                  Resource: "*",
                },
              ],
            },
          },
        ],
      })
    );
  });
});
