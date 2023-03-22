import { expect as expectCDK, haveResource } from "@aws-cdk/assert";
import * as cdk from "@aws-cdk/core";
import { AppStack } from "../lib/app-stack";

// test("Empty Stack", () => {
//   const app = new cdk.App();
//   // WHEN
//   const stack = new AppStack(app, "MyTestStack");
//   // THEN
//   expectCDK(stack).to(
//     haveResource("AWS::Lambda::Function", {
//       Handler: "index.handler",
//       Runtime: "nodejs12.x",
//     })
//   );
// });
