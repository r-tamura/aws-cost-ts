import { CostExplorer } from "@aws-sdk/client-cost-explorer";
import type { MessageAttachment } from "@slack/types";
import { IncomingWebhook } from "@slack/webhook";
import { addDays, format } from "date-fns";
import z from "zod";

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
  /** slack Slack Web API クライアントオブジェクト */
  slack?: IncomingWebhook;
  /** AWS Cost Explorerクライアントオブジェクト(CEはus-east-1のみサポート) */
  ce?: CostExplorer;
}

interface AccountCost {
  accountId: string;
  accountName: string;
  cost: number;
}

const getCostAndUsageByAccountSchema = z.object({
  ResultsByTime: z.array(
    z.object({
      Groups: z.array(
        z.object({
          Keys: z.array(z.string()),
          Metrics: z.object({
            AmortizedCost: z.object({
              Amount: z.string().transform(Number),
              Unit: z.literal("USD"),
            }),
          }),
        })
      ),
    })
  ),
  DimensionValueAttributes: z.array(
    z.object({
      Value: z.string(),
      Attributes: z.object({ description: z.string() }),
    })
  ),
});

type AccountIdNameMap = Record<string, string>;

/**
 * AWS CostExpolere APIから指定期間のサービス毎のコストを取得し、Slackへメッセージとして送信します。
 *
 * @param params slack情報/コスト取得の日付
 * @param services slack API/AWS APIへアクセスするオブジェクト
 */
export async function postCostAndUsageByAccount(
  params: PostCostAndUsageParams,
  {
    slack = new IncomingWebhook(params.webhook_url),
    ce: cost = new CostExplorer({ region: "us-east-1" }),
  }: PostCostAndUsageEnv = {}
) {
  const startDate = params.start ?? yesterday();
  const start = format(startDate, "y-MM-dd");
  const end = format(params.end ?? addDays(startDate, 1), "y-MM-dd");

  const rawResponse = await cost.getCostAndUsage({
    TimePeriod: {
      Start: start,
      End: end,
    },
    Metrics: ["AmortizedCost"],
    Granularity: "DAILY",
    GroupBy: [{ Type: "DIMENSION", Key: "LINKED_ACCOUNT" }],
  });

  const costResponse = getCostAndUsageByAccountSchema.parse(rawResponse);

  assertsNotUndefined(costResponse.ResultsByTime, "ResultByTime");

  const accountIdNameMap = costResponse.DimensionValueAttributes?.reduce(
    (map, valAttr) => {
      map[valAttr.Value] = valAttr.Attributes.description;
      return map;
    },
    {} as AccountIdNameMap
  );

  for (const result of costResponse.ResultsByTime) {
    const accounts = result.Groups.reduce((accounts, responseGroup) => {
      const metric = responseGroup.Metrics.AmortizedCost;
      const amount = metric.Amount;
      const accountId = responseGroup.Keys[0];
      const accountCost = {
        accountId,
        accountName: accountIdNameMap[accountId],
        cost: amount,
      };
      return [...accounts, accountCost];
    }, [] as AccountCost[]);
    const message = buildSlackMessage({ accounts, start, end });
    await slack.send({ attachments: [message], channel: params.channel });
  }
}

const COST_FRACTION_DIGITS = 3;
function buildSlackMessage({
  accounts,
  start,
  end,
}: {
  accounts: AccountCost[];
  start: string;
  end: string;
}) {
  const accountsToPost = accounts
    .filter(isInteresting)
    .sort((a1, a2) => a2.cost - a1.cost);
  const totalStr = accountsToPost
    .reduce((total, account) => total + account.cost, 0)
    .toFixed(COST_FRACTION_DIGITS);
  const message: MessageAttachment = {
    fallback: "attachment",
    color: "default",
    author_name: "アカウント毎内訳",
    text: " ",
    fields: accountsToPost.map((account) => ({
      title: `${account.accountName} (${account.accountId})`,
      value: "$ " + account.cost.toFixed(3),
      short: true,
    })),
    pretext: `*${start}* のAWS利用料 は *$ ${totalStr}* です`,
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

const MIN_COST_IN_USD = 0.05;
function isInteresting(group: AccountCost) {
  return group.cost >= MIN_COST_IN_USD;
}

function yesterday() {
  return addDays(new Date(), -1);
}
