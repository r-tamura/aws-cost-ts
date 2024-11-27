import type {
  CostExplorer,
  GetCostAndUsageRequest,
  GetCostAndUsageResponse,
} from "@aws-sdk/client-cost-explorer";
import { describe, jest } from "@jest/globals";
import type { IncomingWebhook } from "@slack/webhook";
import { format } from "date-fns";
import * as assert from "node:assert";
import {
  type Reporter,
  type ReporterInput,
  createSlackReporter,
  postCostAndUsageByAccount,
} from "../cost";

interface MockedReporter extends Reporter {
  getArgs(): ReporterInput;
}

function createTestReporter(): MockedReporter {
  let args: ReporterInput;
  return {
    async report(input) {
      args = input;
    },
    getArgs() {
      return args;
    },
  };
}

describe("postCostAndUsage", () => {
  test("指定日のコストエクスプローラの結果をslackへ送信する. リザーブドインスタンスなどの料金は支払日に加算する(AmortizedCost)", async () => {
    // Arrange
    // TypeScriptではmockResolvedValueの利用するのに型の指定が必要
    // https://jestjs.io/docs/mock-function-api#mockfnmockresolvedvalueoncevalue
    const reporter = {
      report: jest
        .fn<() => Promise<Record<string, never>>>()
        .mockResolvedValueOnce({}),
    } as unknown as Reporter;
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
                    AmortizedCost: { Amount: "95.0012729986", Unit: "USD" },
                  },
                },
                {
                  Keys: ["456789123456"],
                  Metrics: {
                    AmortizedCost: { Amount: "159.4033492869", Unit: "USD" },
                  },
                },
                {
                  Keys: ["789123456789"],
                  Metrics: {
                    AmortizedCost: { Amount: "0.060", Unit: "USD" },
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

    // Act
    await postCostAndUsageByAccount({ start: date }, { reporter, ce });

    // Assert
    const mockedGetCostAndUsage = ce.getCostAndUsage as jest.Mock;
    const firstCall = mockedGetCostAndUsage.mock
      .calls[0][0] as GetCostAndUsageRequest;
    assert.deepStrictEqual(
      firstCall.TimePeriod,
      {
        Start: "2020-01-02",
        End: "2020-01-03",
      },
      "指定日のコストを取得する",
    );
    assert.deepStrictEqual(
      firstCall.Metrics,
      ["AmortizedCost"],
      "リザーブドインスタンス/Savings Planの料金は、使用期間で均等に割り振る",
    );
    assert.deepStrictEqual(firstCall.Granularity, "DAILY");
    assert.deepStrictEqual(
      firstCall.GroupBy,
      [{ Type: "DIMENSION", Key: "LINKED_ACCOUNT" }],
      "アカウント毎にグループ化する",
    );

    const mockedReport = reporter.report as jest.Mock;
    assert.deepStrictEqual(mockedReport.mock.calls[0][0], {
      accounts: [
        {
          accountId: "123456789123",
          accountName: "Account A",
          cost: 95.0012729986,
        },
        {
          accountId: "456789123456",
          accountName: "Account B",
          cost: 159.4033492869,
        },
        {
          accountId: "789123456789",
          accountName: "Account C",
          cost: 0.06,
        },
      ],
      start: "2020-01-02",
      end: "2020-01-03",
    });
  });

  test("コストを取得する日付を指定しないとき,１日前のコストエクプローラの結果を取得する", async () => {
    // Arrange
    jest.useFakeTimers().setSystemTime(new Date(2024, 0, 1));
    const today = new Date();
    const slack = {
      send: jest.fn<() => Promise<unknown>>().mockResolvedValueOnce({}),
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
    const reporter: Reporter = {
      async report(_) {},
    };
    await postCostAndUsageByAccount({}, { reporter, ce });

    // Assert
    const mockedGetCostAndUsage = ce.getCostAndUsage as jest.Mock;
    assert.deepStrictEqual(
      (mockedGetCostAndUsage.mock.calls[0][0] as Record<string, unknown>)
        .TimePeriod,
      {
        Start: format(new Date(2023, 11, 31), "y-MM-dd"),
        End: format(today, "y-MM-dd"),
      },
    );
  });
});

describe("Slack Reporter", () => {
  test("指定されたChannelにコストレポートを送信する", async () => {
    // Arrange
    createSlackReporter;
    const slack = {
      send: jest
        .fn<() => Promise<undefined>>()
        .mockResolvedValueOnce(undefined),
    } as unknown as IncomingWebhook;

    // Act
    const reporter = createSlackReporter("C0TESTCHANNEL", slack);
    await reporter.report({
      accounts: [
        {
          accountId: "123456789123",
          accountName: "Account A",
          cost: 95.0012729986,
        },
        {
          accountId: "456789123456",
          accountName: "Account B",
          cost: 159.4033492869,
        },
        {
          accountId: "789123456789",
          accountName: "Account C",
          cost: 0.06,
        },
      ],
      start: "2020-01-02",
      end: "2020-01-03",
    });

    // Assert
    assert.deepStrictEqual((slack.send as jest.Mock).mock.calls[0][0], {
      attachments: [
        {
          fallback: "attachment",
          color: "default",
          author_name: "アカウント毎内訳",
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
          pretext: "*2020-01-02* のAWS利用料 は *$ 254.465* です",
        },
      ],
      channel: "C0TESTCHANNEL",
    });
  });
});
