# aws-cost-ts

A script for posting AWS daily billing to Slack

## 使い方

- Secrets Manager へ Slack Webhook URL の登録

```sh
aws secretsmanager put-secret-value \
 --secret-id 'prod/DailyCost' \
 --secret-string '{"SLACK_WEBHOOK_URL": "https://hooks.slack.com/services/XXXXXXXXX/XXXXXXXXX/XXXXXXXXXXXXXXXXXX"}'
```

- AWS 環境へのデプロイ

```sh
cdk deploy
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
