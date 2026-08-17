import {
  StateGraph,
  StateSchema,
  START,
  END,
  ReducedValue,
} from "@langchain/langgraph";

import * as z from "zod";
import { saveGraphAsPng, visualizeGraph } from "../../utils/graphVisualize";
import { logNodeExecution, logNodeResult } from "../../utils/nodeLogger";

import { config } from "dotenv";
import { ChatOllama } from "@langchain/ollama";
import { assert } from "console";
config();

// Define the state
const QuadraticState = new StateSchema({
  a: z.number().describe("The coefficient of x^2."),
  b: z.number().describe("The coefficient of x."),
  c: z.number().describe("The constant term."),
  discriminant: z.number().optional(),
  result: z.array(z.number()).optional(),
});

//Utility

//Nodes
const showEquation = async (state: typeof QuadraticState.State) => {
  logNodeExecution("ShowEquation", state);
  console.log(
    `The quadratic equation is: ${state.a}x^2 + ${state.b}x + ${state.c} = 0`,
  );
  logNodeResult("ShowEquation", {});
  return {};
};

const calculateDiscriminant = async (state: typeof QuadraticState.State) => {
  logNodeExecution("calculateDiscriminant", state);
  const discriminant = state.b ** 2 - 4 * state.a * state.c;
  console.log(`The discriminant (D) is: ${discriminant}`);
  logNodeResult("calculateDiscriminant", { discriminant });
  return { discriminant };
};

const calculateRealRoots = async (state: typeof QuadraticState.State) => {
  logNodeExecution("calculateRealRoots", state);
  const D = state.discriminant;
  if (D === undefined) throw new Error("Discriminant is not calculated yet.");

  const sqrtD = Math.sqrt(D);
  const x1 = (-state.b + sqrtD) / (2 * state.a);
  const x2 = (-state.b - sqrtD) / (2 * state.a);
  console.log(`The real roots are: ${x1} and ${x2}`);
  logNodeResult("calculateRealRoots", { result: [x1, x2] });
  return { result: [x1, x2] };
};

const calculateComplexRoots = async (state: typeof QuadraticState.State) => {
  logNodeExecution("calculateComplexRoots", state);
  const D = state.discriminant;
  if (D === undefined) throw new Error("Discriminant is not calculated yet.");

  const realPart = -state.b / (2 * state.a);
  const imaginaryPart = Math.sqrt(-D) / (2 * state.a);
  console.log(
    `The complex roots are: ${realPart} + ${imaginaryPart}i and ${realPart} - ${imaginaryPart}i`,
  );
  logNodeResult("calculateComplexRoots", { result: [realPart, imaginaryPart] });
  return { result: [realPart, imaginaryPart] };
};

const calculateSingleRoot = async (state: typeof QuadraticState.State) => {
  logNodeExecution("calculateSingleRoot", state);
  const D = state.discriminant;
  if (D === undefined) throw new Error("Discriminant is not calculated yet.");
  const sqrtD = Math.sqrt(D);
  const x = (-state.b + sqrtD) / (2 * state.a);
  console.log(`The single root is: ${x}`);
  logNodeResult("calculateSingleRoot", { result: [x] });
  return { result: [x] };
};

//Graph
const graph = new StateGraph(QuadraticState)

  .addNode("ShowEquation", showEquation)
  .addNode("calculateDiscriminant", calculateDiscriminant)
  .addNode("calculateRealRoots", calculateRealRoots)
  .addNode("calculateComplexRoots", calculateComplexRoots)
  .addNode("calculateSingleRoot", calculateSingleRoot)

  .addEdge(START, "ShowEquation")
  .addEdge("ShowEquation", "calculateDiscriminant")
  .addConditionalEdges(
    "calculateDiscriminant",
    (state) => {
      const D = state.discriminant;

      if (!D) throw new Error("Discriminant is not calculated yet.");
      else if (D > 0) return "RealRoots";
      else if (D < 0) return "ComplexRoots";
      return "SingleRoot";
    },
    {
      RealRoots: "calculateRealRoots",
      ComplexRoots: "calculateComplexRoots",
      SingleRoot: "calculateSingleRoot",
    },
  )
  .addEdge("calculateRealRoots", END)
  .addEdge("calculateComplexRoots", END)
  .addEdge("calculateSingleRoot", END)

  .compile();

//Visualize graph
await visualizeGraph(graph);
await saveGraphAsPng(graph, "quad-root.png");

// Run Graph
const result = await graph.invoke({
  a: 5,
  b: 3,
  c: 1,
});

console.log("Final Result:", result);
