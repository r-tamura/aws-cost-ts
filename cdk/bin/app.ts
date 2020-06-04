import { App } from "@aws-cdk/core";
import { AppStack } from "../lib/app-stack";

const app = new App();
new AppStack(app, "DailyCost");

app.synth();
