import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { AWSDailyCostSlackReportStack } from "../lib/AWSDailyCostReportStack";

describe("DailyCostSlackNotificationStack", () => {

  const TEST_SECRETS_MANAGER_SECRET_ARN =
    "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prod/DailyCost-xxxxxx";
  let template: Template;
  beforeAll(() => {
    const app = new App();

    const stack = new AWSDailyCostSlackReportStack(
      app,
      "Test-AWSDailyCostReporter",
      {
        slackWebhookUrlSecretsManagerArn: TEST_SECRETS_MANAGER_SECRET_ARN,
      }
    );
    template = Template.fromStack(stack);
  })

  test("利用コストをAWS APIから取得してSlackへ通知するLambda関数が定義されている", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.handler",
      Runtime: "nodejs18.x",
      Environment: {
        Variables: {
          SLACK_WEBHOOK_URL: Match.stringLikeRegexp(TEST_SECRETS_MANAGER_SECRET_ARN),
        },
      },
    });
  });

  test("Lambda関数がCostExplorer APIを利用してコストを取得するための権限を持っている", () => {
    template.hasResourceProperties(
      "AWS::IAM::Role",
      Match.objectLike({
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

  test("Lambda関数にAWSLambdaBasicExecutionRoleを付与されている", () => {
    template.hasResourceProperties(
      "AWS::IAM::Role",
      Match.objectLike({
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
        ManagedPolicyArns: [
          {
            "Fn::Join": [
              "",
              [
                "arn:",
                { Ref: "AWS::Partition" },
                Match.stringLikeRegexp(".*AWSLambdaBasicExecutionRole"),
              ],
            ],
          }
        ],
      })
    );
  })
});
