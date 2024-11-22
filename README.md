# aws-cost-ts

A script for posting AWS daily billing to Slack

## Prerequisites

- yarn(v1)
- AWS CDK ToolkitV(v2)
- esbuild

## 使い方

### Secrets ManagerへSlack Webhook URLの登録

出力されたシークレットのARNを書き留める

```sh
aws secretsmanager create-secret \
 --name '<Secret Name>' \
 --secret-string '{"SLACK_WEBHOOK_URL": "https://hooks.slack.com/services/XXXXXXXXX/XXXXXXXXX/XXXXXXXXXXXXXXXXXX"}'
```

### AWS環境へのデプロイ

1. 環境ごとの設定は以下のようなcdk.context.jsonを用意する

```json
{
  "<environment key>": {
    "name": "environment name",
    "reporter": {
      "type": "slack-webhook",
      "webhookUrlSecretsArn": "AWS Secrets Manager Secret ARN"
    }
  }
}
```

例: dev環境

```json
{
  "dev": {
    "name": "dev",
    "stackNameSuffix": "dev",
    "reporter": {
      "type": "slack",
      "slackWebhookUrlSecretsManagerArn": "<Secret ARN>"
    }
  }
}
```

`cdk deploy`コマンドの`-c`/`--context`オプションで環境名を指定してデプロイする。

```sh
cdk deploy -c environment=<environment name>
```

## Development

- build

```sh
yarn watch
```

- test

```sh
yarn test
```

## Delete resources

```sh
cdk destroy -c environment=<environment name>
aws secretsmanager delete-secret --secret-id 'prod/DailyCost'
```

