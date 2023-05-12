import {
  GetCostAndUsageResponse,
  type CostExplorer,
  type GetCostAndUsageRequest,
} from "@aws-sdk/client-cost-explorer";
import { describe, jest } from "@jest/globals";
import { IncomingWebhook } from "@slack/webhook";
import * as assert from "assert";
import { addDays, format } from "date-fns";
import { postCostAndUsageByAccount } from "../cost";

describe("postCostAndUsage", () => {
  test("指定日のコストエクスプローラの結果をslackへ送信する. リザーブドインスタンスなどの料金は支払日に加算する(Unblended)", async () => {
    // Arrange
    // TypeScriptではmockResolvedValueの利用するのに型の指定が必要
    // https://jestjs.io/docs/mock-function-api#mockfnmockresolvedvalueoncevalue
    const slack = {
      send: jest.fn<() => Promise<{}>>().mockResolvedValueOnce({}),
    } as unknown as IncomingWebhook;
    const ce = {
      getCostAndUsage: jest
        .fn<() => Promise<GetCostAndUsageResponse>>()
        .mockResolvedValue({
          GroupDefinitions: [{ Type: "DIMENSION", Key: "LINKED_ACCOUNT" }],
          ResultsByTime: [
            {
              TimePeriod: { Start: "2020-01-01", End: "2020-01-02" },
              Total: {},
              Groups: [
                {
                  Keys: ["123456789123"],
                  Metrics: {
                    UnblendedCost: { Amount: "95.0012729986", Unit: "USD" },
                  },
                },
                {
                  Keys: ["456789123456"],
                  Metrics: {
                    UnblendedCost: { Amount: "159.4033492869", Unit: "USD" },
                  },
                },
                {
                  Keys: ["789123456789"],
                  Metrics: {
                    UnblendedCost: { Amount: "0.060", Unit: "USD" },
                  },
                },
              ],
              Estimated: false,
            },
          ],
          DimensionValueAttributes: [
            {
              Value: "123456789123",
              Attributes: {
                description: "Account A",
              },
            },
            {
              Value: "456789123456",
              Attributes: {
                description: "Account B",
              },
            },
            {
              Value: "789123456789",
              Attributes: {
                description: "Account C",
              },
            },
          ],
        }),
    } as unknown as CostExplorer;
    const date = new Date(2020, 0, 2);
    const token =
      "xoxp-0000000000-0000000000-000000000000-00000000000000000000000000000000";

    // Act
    await postCostAndUsageByAccount(
      { channel: "C0TESTCHANNEL", webhook_url: token, start: date },
      { slack, ce: ce }
    );

    // Assert
    const mockedGetCostAndUsage = ce.getCostAndUsage as jest.Mock;
    const firstCall = mockedGetCostAndUsage.mock
      .calls[0][0] as GetCostAndUsageRequest;
    assert.deepStrictEqual(
      firstCall["TimePeriod"],
      {
        Start: "2020-01-02",
        End: "2020-01-03",
      },
      "指定日のコストを取得する"
    );
    assert.deepStrictEqual(
      firstCall["Metrics"],
      ["UnblendedCost"],
      "リザーブドインスタンスなどの支払いは、すべて支払日のコストに含める"
    );
    assert.deepStrictEqual(firstCall["Granularity"], "DAILY");
    assert.deepStrictEqual(
      firstCall["GroupBy"],
      [{ Type: "DIMENSION", Key: "LINKED_ACCOUNT" }],
      "アカウント毎にグループ化する"
    );

    const mockedPostMessage = slack.send as jest.Mock;
    assert.deepStrictEqual(mockedPostMessage.mock.calls[0][0], {
      attachments: [
        {
          fallback: "attachment",
          color: "default",
          author_name: "サービス毎内訳",
          text: " ",
          fields: [
            {
              title: "Account B (456789123456)",
              value: "$ 159.403",
              short: true,
            },
            {
              title: "Account A (123456789123)",
              value: "$ 95.001",
              short: true,
            },
            {
              title: "Account C (789123456789)",
              value: "$ 0.060",
              short: true,
            },
          ],
          pretext: `*2020-01-02* のAWS利用料 は *$ 254.465* です`,
        },
      ],
      channel: "C0TESTCHANNEL",
    });
  });

  test("コストを取得する日付を指定しないとき,１日前のコストエクプローラの結果を取得する", async () => {
    // Arrange
    const today = new Date();
    const slack = {
      send: jest.fn<() => Promise<any>>().mockResolvedValueOnce({}),
    } as unknown as IncomingWebhook;
    const ce = {
      getCostAndUsage: jest
        .fn<() => Promise<GetCostAndUsageResponse>>()
        .mockResolvedValueOnce({
          GroupDefinitions: [{ Type: "DIMENSION", Key: "LINKED_ACCOUNT" }],
          ResultsByTime: [],
          DimensionValueAttributes: [],
        }),
    } as unknown as CostExplorer;

    // Act
    await postCostAndUsageByAccount(
      {
        channel: "C0TESTCHANNEL",
        webhook_url: "xoxp-0000000000",
      },
      { slack, ce }
    );

    // Assert
    const mockedGetCostAndUsage = ce.getCostAndUsage as jest.Mock;
    assert.deepStrictEqual(
      (mockedGetCostAndUsage.mock.calls[0][0] as any).TimePeriod,
      {
        Start: format(addDays(today, -1), "y-MM-dd"),
        End: format(today, "y-MM-dd"),
      }
    );
  });
});
