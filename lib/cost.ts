import type { MessageAttachment } from "@slack/types";
import { IncomingWebhook } from "@slack/webhook";
import { CostExplorer } from "aws-sdk";
import { addDays, format } from "date-fns";

interface PostCostAndUsageParams {
  /**  webhook_url ポスト先Slack Webhook エンドポイントURL */
  webhook_url: string;
  /**  channel slack ポスト先チャネルID. 指定されない場合は、Webhook URLに指定されているチャネル。 */
  channel?: string;
  /**  start コスト取得期間の開始日 */
  start?: Date;
  /**  end コスト取得期間の終了日 */
  end?: Date;
}
interface PostCostAndUsageEnv {
  /** AWS Cost Explorer クライアントオブジェクト(CEはus-east-1のみサポート) */
  slack?: IncomingWebhook;
  /** slack Slack Web API クライアントオブジェクト */
  cost?: CostExplorer;
}

interface ServiceCost {
  service: string;
  cost: number;
}

/**
 * AWS CostExpolere APIから指定期間のサービス毎のコストを取得し、Slackへメッセージとして送信します。
 *
 * @param params slack情報/コスト取得の日付
 * @param services slack API/AWS APIへアクセスするオブジェクト
 */
export async function postCostAndUsage(
  params: PostCostAndUsageParams,
  {
    slack = new IncomingWebhook(params.webhook_url),
    cost = new CostExplorer({ region: "us-east-1" }),
  }: PostCostAndUsageEnv = {}
) {
  const startDate = params.start ?? yesterday();
  const start = format(startDate, "y-MM-dd");
  const end = format(params.end ?? addDays(startDate, 1), "y-MM-dd");

  const costResponse = await cost
    .getCostAndUsage({
      TimePeriod: {
        Start: start,
        End: end,
      },
      Metrics: ["UnblendedCost"],
      Granularity: "DAILY",
      GroupBy: [{ Type: "DIMENSION", Key: "LINKED_ACCOUNT" }],
    })
    .promise();

  assertsNotUndefined(costResponse.ResultsByTime, "ResultByTime");
  for (const result of costResponse.ResultsByTime) {
    const message = createMessage({ result, start, end });
    await slack.send({ attachments: [message], channel: params.channel });
  }
}

function createMessage({
  result,
  start,
  end,
}: {
  result: CostExplorer.ResultByTime;
  start: string;
  end: string;
}) {
  assertsNotUndefined(result.Groups, "Groups");

  let total = 0;
  const groups: ServiceCost[] = [];
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
    assertsCompleteMetric(group.Metrics?.UnblendedCost);
    const metric = group.Metrics.UnblendedCost;
    const amount = Number(metric.Amount);
    const serviceCost = { service: group.Keys[0], cost: amount };
    if (uninteresting(serviceCost)) {
      continue;
    }
    groups.push(serviceCost);
    total += amount;
  }
  groups.sort((g1, g2) => g2.cost - g1.cost);
  return slackMessage({ groups, total, start, end });
}

const COST_FRACTION_DIGITS = 3;
function slackMessage(params: {
  groups: ServiceCost[];
  total: number;
  start: string;
  end: string;
}) {
  const totalStr = params.total.toFixed(COST_FRACTION_DIGITS);
  const message: MessageAttachment = {
    fallback: "attachment",
    color: "default",
    author_name: "サービス毎内訳",
    text: " ",
    fields: params.groups.map((group) => ({
      title: group.service,
      value: "$ " + group.cost.toFixed(3),
      short: true,
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

const MIN_COST_IN_USD = 0.05;
function uninteresting(group: ServiceCost) {
  return group.cost < MIN_COST_IN_USD;
}

function yesterday() {
  return addDays(new Date(), -1);
}
