import type { ConstructorParams } from "@browserbasehq/stagehand";
import dotenv from "dotenv";

import { CustomOpenAIClient } from "./llm_clients/customOpenAI_client.js";
import { OpenAI } from "openai";

dotenv.config();

const StagehandConfig: ConstructorParams = {
  verbose: 0 /* Verbosity level for logging: 0 = silent, 1 = info, 2 = all */,
  domSettleTimeoutMs: 30_000 /* Further reduced timeout for DOM to settle in milliseconds */,

  // LLM configuration
  llmClient: new CustomOpenAIClient({
    modelName: "llama-3.3-70b", // better models work better
    client: new OpenAI({
      baseURL: "https://api.cerebras.ai/v1",
      apiKey: process.env.CEREBRAS_API_KEY!, //get your key here: https://cloud.cerebras.ai/?utm_source=inferencedocs
    }),
  }),

  // Ultra-concise system prompt to minimize token usage
  systemPrompt: "Web automation assistant. Be extremely concise. Focus only on essential elements for the action.",

  // Disable caching to avoid storing large payloads
  enableCaching: false, //Important. Dont change this



  // Browser configuration
  env: "LOCAL" /* Environment to run in: LOCAL or BROWSERBASE */,
  apiKey: process.env.BROWSERBASE_API_KEY /* API key for authentication */,
  projectId: process.env.BROWSERBASE_PROJECT_ID /* Project identifier */,
  browserbaseSessionID:
    undefined /* Session ID for resuming Browserbase sessions */,
  browserbaseSessionCreateParams: {
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    browserSettings: {
      blockAds: true,
      viewport: {
        width: 1024,
        height: 768,
      },
    },
  },
  localBrowserLaunchOptions: {
    viewport: {
      width: 1024,
      height: 768,
    },
  } /* Configuration options for the local browser */,
};

export default StagehandConfig;
