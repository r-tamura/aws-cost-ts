import { CostExplorer } from "aws-sdk";
import { WebClient, MessageAttachment } from "@slack/web-api";
import { addDays, format } from "date-fns";

interface PostCostAndUsageParams {
  channel: string;
  token: string;
  start?: Date;
  end?: Date;
}
interface PostCostAndUsageEnv {
  slack?: WebClient;
  cost?: CostExplorer;
}

/**
 * AWS CostExpolere APIから指定期間のサービス毎のコストを取得し、Slackへメッセージとして送信します。
 *
 * @param params slack情報/コスト取得の日付
 * @param params.channel slack チャネルID (required)
 * @param params.token slack OAuthトークン (required)
 * @param params.start コスト取得期間の開始日
 * @param params.end コスト取得期間の終了日
 * @param services slack API/AWS APIへアクセスするオブジェクト
 * @param services.slack Slack Web API クライアントオブジェクト
 * @param services.cost AWS Cost Explorer クライアントオブジェクト
 */
export async function postCostAndUsage(
  params: PostCostAndUsageParams,
  {
    slack = new WebClient(params.token),
    cost = new CostExplorer({ region: "us-east-1" }),
  }: PostCostAndUsageEnv = {}
) {
  const startDate = params.start ?? yesterday();
  const start = format(startDate, "y-MM-dd");
  const end = format(params.end ?? addDays(startDate, 1), "y-MM-dd");

  const costRes = await cost
    .getCostAndUsage({
      TimePeriod: {
        Start: start,
        End: end,
      },
      Metrics: ["UnblendedCost"],
      Granularity: "DAILY",
      GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
    })
    .promise();

  assertsNotUndefined(costRes.ResultsByTime, "ResultByTime");
  for (const result of costRes.ResultsByTime) {
    let total = 0;
    assertsNotUndefined(result.Groups, "Groups");

    const fields: Required<MessageAttachment>["fields"] = [];
    for (const group of result.Groups) {
      // metricタイプ構成
      // 属性名を取得するには.Keys[0]で指定する.
      // {
      //   "Keys": ["AWS Directory Service"],
      //   "Metrics": {
      //     "UnblendedCost": { "Amount": "5.3911081713", "Unit": "USD" }
      //   }
      // }
      assertsCompleteGroup(group);
      const metric = group.Metrics?.UnblendedCost;

      assertsCompleteMetric(metric);
      if (uninteresting(metric)) {
        continue;
      }

      total += Number.parseFloat(metric.Amount);
      fields.push({
        title: group.Keys[0],
        value: metric.Amount,
        short: true,
      });
    }
    const message = slackMessage({
      channel: params.channel,
      fields,
      total,
      start,
      end,
    });
    await slack.chat.postMessage({
      attachments: [message],
      text: "",
      channel: params.channel,
    });
  }
}

function slackMessage(params: {
  channel: string;
  fields: Required<MessageAttachment>["fields"];
  total: number;
  start: string;
  end: string;
}) {
  const totalStr = params.total.toFixed(3);
  const message: MessageAttachment = {
    fallback: "attachment",
    color: "default",
    author_name: "サービス毎内訳",
    text: " ",
    fields: params.fields.map((f) => ({
      ...f,
      value: "$ " + Number.parseFloat(f.value).toFixed(3),
    })),
    pretext: `*${params.start}* のAWS利用料 は *$ ${totalStr}* です`,
  };
  return message;
}

function assertsNotUndefined<T>(
  value: T | undefined,
  name?: string
): asserts value is T {
  if (!value) {
    throw new TypeError(`${name} shouldn&t be undefined`);
  }
}

function assertsCompleteGroup(
  group: CostExplorer.Group | undefined
): asserts group is Required<CostExplorer.Group> {
  if (!group?.Keys || !group?.Metrics) {
    throw new TypeError(`Invalid Group`);
  }
}

function assertsCompleteMetric(
  metric: CostExplorer.MetricValue | undefined
): asserts metric is Required<CostExplorer.MetricValue> {
  if (!metric?.Amount || !metric?.Unit) {
    throw new TypeError(`Invalid Metric: ${metric}`);
  }
}

function uninteresting(cost: Required<CostExplorer.MetricValue>) {
  return Number.parseFloat(cost.Amount) < 0.05;
}

function yesterday() {
  return addDays(new Date(), -1);
}
