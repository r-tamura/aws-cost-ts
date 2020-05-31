import * as fs from "fs";
import * as path from "path";
import { WebClient } from "@slack/web-api";
import { CostExplorer } from "aws-sdk";

const readJson = (name: string) =>
  fs.promises
    .readFile(path.join(__dirname, "fixtures", name + ".json"), "utf-8")
    .then(JSON.parse);

export function mockCostExplorer() {
  return ({
    getCostAndUsage: jest.fn().mockReturnValue({
      promise: jest.fn().mockImplementation(() => readJson("getCostAndUsage")),
    }),
  } as unknown) as CostExplorer;
}

export function mockSlack() {
  return ({
    chat: {
      postMessage: jest.fn().mockResolvedValue({}),
    },
  } as unknown) as WebClient;
}

export function mockDate(timeToUse: Date) {
  let spy: jest.SpyInstance;
  const start = () => {
    spy = jest.spyOn(global, "Date").mockReturnValue(timeToUse as any);
  };

  const end = () => {
    spy.mockRestore();
  };

  return [start, end] as const;
}
