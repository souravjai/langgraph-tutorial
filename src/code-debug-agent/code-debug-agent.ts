import { StateGraph, StateSchema, START, END } from "@langchain/langgraph";

import vm from "node:vm";

import * as z from "zod";
import { saveGraphAsPng, visualizeGraph } from "../../utils/graphVisualize";
import { logNodeExecution, logNodeResult } from "../../utils/nodeLogger";

import { config } from "dotenv";
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
config();

type ExecutionResult =
  | {
      success: true;
      output: unknown;
    }
  | {
      success: false;
      error: string;
    };

// Define the state
const DebugStateSchema = z.object({
  code: z.string().describe("The given code to be tested and fixed"),
  intent: z.string().describe("Intent of the given code."),

  generatedTests: z
    .array(
      z.object({
        name: z.string().describe("Name of the test case"),
        functionName: z.string().describe("Name of the function to be tested"),
        input: z
          .any()
          .describe("Input that needs to be passed to the function"),
        expectedOutput: z.any().describe("Expected Output of the function"),
        description: z.string(),
      }),
    )
    .describe("Array of Test cases")
    .default([]),
  testResults: z
    .array(
      z.object({
        passed: z.boolean(),
        input: z.any(),
        expectedOutput: z.any(),
        actualOutput: z.any(),
        error: z.string().optional(),
      }),
    )
    .default([]),

  iteration: z.number().default(0),
  maxIteration: z.number(),
});
const DebugState = new StateSchema(DebugStateSchema.shape);

//LLM

const llm = new ChatOllama({ model: "qwen3:4b" });

//Nodes
const generateTest = async (state: typeof DebugState.State) => {
  logNodeExecution("generateTest", state);
  const model = llm.withStructuredOutput(DebugStateSchema.shape.generatedTests);
  const message = [
    new SystemMessage(
      "You are an Expert Quality Engineer. Your job is to generate Test Scenario and Test code for given intent of code.",
    ),
    new HumanMessage(
      `Look the given code: \`\`\`\n${state.code}\n\`\`\` \n The intent ${state.intent}. 
      Please generate a list of test cases with Name, Function name of the code to be tested, input , Expected Outcome and Description.
      Figure out the Function name, input type and expected output type based on given code.
      Having the correct input type and Expected output Type is most important.
      You should output it as a list of Testable code object with name, input, output and description`,
    ),
  ];
  const result = await model.invoke(message);
  console.dir("Test Generated:", result);
  logNodeResult("generateTest", { generatedTests: result });
  return { generatedTests: result };
};

const runTests = async (state: typeof DebugState.State) => {
  logNodeExecution("runTests", state);
  function executeCode(
    code: string,
    functionName: string,
    input: unknown,
  ): ExecutionResult {
    try {
      const context: {
        input: unknown;
        result?: unknown;
      } = {
        input,
      };

      vm.createContext(context);

      const wrappedCode = `
      ${code}

      result = ${functionName}(input);
    `;

      vm.runInContext(wrappedCode, context, {
        timeout: 10_000,
      });

      return {
        success: true,
        output: context.result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const output = state.generatedTests.map((test) =>
    executeCode(state.code, test.functionName, test.input),
  );

  const result = output.map((item, index) => ({
    passed: item.success
      ? state.generatedTests[index].expectedOutput == item.output
      : false,
    input: state.generatedTests[index].input,
    expectedOutput: state.generatedTests[index].expectedOutput,
    actualOutput: item.success == true ? item.output : "",
    error: undefined,
  }));
  logNodeResult("runTests", { testResults: result });
  return { testResults: result };
};

const fixCode = async (state: typeof DebugState.State) => {
  logNodeExecution("fixCode", state);
  const currentIteration = state.iteration;
  const code = state.code;
  const intent = state.intent;
  const result = state.testResults;
  console.dir(`Trying to fix code`);

  const response =
    await llm.invoke(`Based on the Test Result: ${JSON.stringify(result)}
    Fix this code: ${JSON.stringify(code)}
    The intent of code is : ${JSON.stringify(intent)}
    Only give the code as output as it will be send to a funtion for evulation.`);

  console.log("Fixed Code", response.content);
  logNodeResult("fixCode", {
    code: response.content,
    iteration: currentIteration + 1,
  });
  return {
    code: response.content,
    iteration: currentIteration + 1,
  };
};

//Graph
const graph = new StateGraph(DebugState)
  .addNode("generateTest", generateTest)
  .addNode("runTests", runTests)
  .addNode("fixCode", fixCode)

  .addEdge(START, "generateTest")
  .addEdge("generateTest", "runTests")
  .addConditionalEdges(
    "runTests",
    (state) => {
      const attemptLeft = state.maxIteration - state.iteration;
      if (attemptLeft <= 0) return "Exhaused";

      const hasAnyTestFailed = state.testResults.some(
        (result) => !result.passed,
      );

      return hasAnyTestFailed ? "Failed" : "Passed";
    },
    {
      Failed: "fixCode",
      Passed: END,
      Exhaused: END,
    },
  )
  .addEdge("fixCode", "runTests")

  .compile();

//Visualize graph
await visualizeGraph(graph);
await saveGraphAsPng(graph, "Code-Debug-Agent.png");

// Run Graph
const result = await graph.invoke({
  code: `function average(nums){
    const total = nums.reduce((a,b)=>a+b,1);
    const length = nums.length;

    return length/total;
    }`,
  intent: "Find the average of given numbers",
  maxIteration: 5,
});

console.log("FIXED CODE\n", result.code);
