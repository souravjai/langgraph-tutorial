import { ChatOllama } from "@langchain/ollama";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { z } from "zod";
import { tool } from "@langchain/core/tools";

import {
  END,
  MessagesValue,
  START,
  StateGraph,
  StateSchema,
} from "@langchain/langgraph";

import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";

import { HumanMessage, AIMessage } from "@langchain/core/messages";

import { MemorySaver } from "@langchain/langgraph-checkpoint";

import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";

import { config as loadEnv } from "dotenv";

loadEnv();

// ============================================================
// LLM
// ============================================================

const llm = new ChatOllama({
  model: "qwen3:4b",
});

// ============================================================
// Tools
// ============================================================

const searchTool = new DuckDuckGoSearch();

const calculator = tool(
  async ({ first_num, second_num, operation }) => {
    switch (operation) {
      case "add":
        return first_num + second_num;

      case "sub":
        return first_num - second_num;

      case "mul":
        return first_num * second_num;

      case "div":
        if (second_num === 0) {
          throw new Error("Cannot divide by zero.");
        }

        return first_num / second_num;

      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  },
  {
    name: "calculator",

    description:
      "Perform basic arithmetic operations on two numbers. " +
      "Supported operations: add, sub, mul, div",

    schema: z.object({
      first_num: z.number().describe("First number"),

      second_num: z.number().describe("Second number"),

      operation: z
        .enum(["add", "sub", "mul", "div"])
        .describe("Arithmetic operation"),
    }),
  },
);

const getCityWeather = tool(
  async ({ city }) => {
    const URL = `https://wttr.in/${city}?format=j2`;
    const resposne = await fetch(URL);
    const data = await resposne.json();
    return data;
  },
  {
    name: "getCityWeather",
    description: "Tool to fetch weather of a city",
    schema: z.object({
      city: z.string().describe("City whose weather needs to be fetched"),
    }),
  },
);

const tools = [searchTool, calculator, getCityWeather];

const llmWithTools = llm.bindTools(tools);

// ============================================================
// State
// ============================================================

const GraphState = new StateSchema({
  messages: MessagesValue,
});

// ============================================================
// Nodes
// ============================================================

const chatNode = async (state: typeof GraphState.State) => {
  const response = await llmWithTools.invoke(state.messages);

  return {
    messages: [response],
  };
};

const toolsNode = new ToolNode(tools);

// ============================================================
// Checkpointer
// ============================================================

const checkpointer = new MemorySaver();

// ============================================================
// Graph
// ============================================================

const graph = new StateGraph(GraphState)

  .addNode("chat", chatNode)
  .addNode("tools", toolsNode)

  .addEdge(START, "chat")

  .addConditionalEdges("chat", toolsCondition, {
    tools: "tools",
    [END]: END,
  })

  .addEdge("tools", "chat")

  .compile({
    checkpointer,
  });

// ============================================================
// Interactive Terminal
// ============================================================

const readline = createInterface({
  input,
  output,
});

// IMPORTANT:
// Same thread_id = same conversation
const threadConfig = {
  configurable: {
    thread_id: "terminal-chat",
  },
};

console.log("\n=================================");
console.log("🤖 LangGraph Tool Agent");
console.log("=================================");
console.log("Type 'exit' to quit.\n");

while (true) {
  const userInput = await readline.question("You: ");

  if (userInput.trim().toLowerCase() === "exit") {
    break;
  }

  if (!userInput.trim()) {
    continue;
  }

  const response = await graph.invoke(
    {
      messages: [new HumanMessage(userInput)],
    },
    threadConfig,
  );

  const lastMessage = response.messages.at(-1);

  if (lastMessage instanceof AIMessage) {
    console.log(`\nAI: ${lastMessage.content}\n`);
  }
}

readline.close();
