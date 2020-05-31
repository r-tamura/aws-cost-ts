import { postCostAndUsage } from "../lib/cost";
import * as assert from "assert";
import { mockSlack, mockCostExplorer } from "./mock";
import { format, addDays } from "date-fns";
describe("postCostAndUsage", () => {
  it("指定日のコストエクスプローラの結果をslackへ送信する", async () => {
    // Arrange
    const slack = mockSlack();
    const cost = mockCostExplorer();
    const date = new Date(2020, 0, 2);
    const token =
      "xoxp-0000000000-0000000000-000000000000-00000000000000000000000000000000";

    // Act
    await postCostAndUsage(
      { channel: "C0TESTCHANNEL", token, start: date },
      { slack, cost }
    );

    // Assert
    const mockedPostMessage = slack.chat.postMessage as jest.Mock;
    assert.deepEqual(mockedPostMessage.mock.calls[0][0], {
      attachments: [
        {
          fallback: "attachment",
          color: "default",
          author_name: "サービス毎内訳",
          text: " ",
          fields: [
            {
              title: "Amazon Simple Storage Service",
              value: "$ 95.001",
              short: true,
            },
            {
              title: "Amazon Elastic Compute Cloud - Compute",
              value: "$ 159.403",
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
      text: "",
      channel: "C0TESTCHANNEL",
    });
  });

  it("１日前のコストエクプロータの結果を取得する", async () => {
    // Arrange
    const today = new Date();
    const slack = mockSlack();
    const cost = mockCostExplorer();

    // Act
    await postCostAndUsage(
      {
        channel: "C0TESTCHANNEL",
        token: "xoxp-0000000000",
      },
      { slack, cost }
    );

    // Assert
    const mockedGetCostAndUsage = cost.getCostAndUsage as jest.Mock;
    assert.deepEqual(mockedGetCostAndUsage.mock.calls[0][0].TimePeriod, {
      Start: format(addDays(today, -1), "y-MM-dd"),
      End: format(today, "y-MM-dd"),
    });
  });
});
