# aws-cost-ts

A script for posting AWS daily billing to Slack

## Prerequisites

- yarn(v1)
- cdk
- Docker ()

## 使い方

- Secrets Manager へ Slack Webhook URL の登録

```sh
aws secretsmanager put-secret-value \
 --secret-id 'prod/DailyCost' \
 --secret-string '{"SLACK_WEBHOOK_URL": "https://hooks.slack.com/services/XXXXXXXXX/XXXXXXXXX/XXXXXXXXXXXXXXXXXX"}'
```

- AWS 環境へのデプロイ
  docker を起動しておく

```sh
yarn build && cdk deploy
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
