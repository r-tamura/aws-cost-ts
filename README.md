# aws-cost-ts

A script for posting AWS daily billing to Slack

## Prerequisites

- yarn(v1)
- cdk
- esbuild

## 使い方

- Secrets ManagerへSlack Webhook URLの登録

```sh
aws secretsmanager put-secret-value \
 --secret-id 'prod/DailyCost' \
 --secret-string '{"SLACK_WEBHOOK_URL": "https://hooks.slack.com/services/XXXXXXXXX/XXXXXXXXX/XXXXXXXXXXXXXXXXXX"}'
```

- AWS環境へのデプロイ

```sh
SLACK_WEBHOOK_URL_SECRETSMANAGER_ARN='Secret ARN' cdk deploy 
```

## Developemnt

- build

```sh
yarn watch
```

- test

```sh
yarn test
```

## 環境消去

```sh
cdk destroy
aws secretsmanager delete-secret --secret-id 'prod/DailyCost'
```
