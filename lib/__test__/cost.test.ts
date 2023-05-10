import { GetCostAndUsageRequest } from "@aws-sdk/client-cost-explorer";
import { describe, jest } from "@jest/globals";
import * as assert from "assert";
import { addDays, format } from "date-fns";
import { postCostAndUsage } from "../cost";
import { mockCostExplorer, mockSlackWebhook } from "./mock";
describe("postCostAndUsage", () => {
  it("指定日のコストエクスプローラの結果をslackへ送信する. リザーブドインスタンスなどの料金は支払日に加算する", async () => {
    // Arrange
    const slack = mockSlackWebhook();
    const cost = mockCostExplorer();
    const date = new Date(2020, 0, 2);
    const token =
      "xoxp-0000000000-0000000000-000000000000-00000000000000000000000000000000";

    // Act
    await postCostAndUsage(
      { channel: "C0TESTCHANNEL", webhook_url: token, start: date },
      { slack, cost }
    );

    // Assert
    const mockedGetCostAndUsage = cost.getCostAndUsage as jest.Mock;
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
              title: "Amazon Elastic Compute Cloud - Compute",
              value: "$ 159.403",
              short: true,
            },
            {
              title: "Amazon Simple Storage Service",
              value: "$ 95.001",
              short: true,
            },
            {
              title: "Tax",
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

  it("１日前のコストエクプローラの結果を取得する", async () => {
    // Arrange
    const today = new Date();
    const slack = mockSlackWebhook();
    const cost = mockCostExplorer();

    // Act
    await postCostAndUsage(
      {
        channel: "C0TESTCHANNEL",
        webhook_url: "xoxp-0000000000",
      },
      { slack, cost }
    );

    // Assert
    const mockedGetCostAndUsage = cost.getCostAndUsage as jest.Mock;
    assert.deepStrictEqual(
      (mockedGetCostAndUsage.mock.calls[0][0] as any).TimePeriod,
      {
        Start: format(addDays(today, -1), "y-MM-dd"),
        End: format(today, "y-MM-dd"),
      }
    );
  });
});
