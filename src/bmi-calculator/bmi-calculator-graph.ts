import { StateGraph, StateSchema, START, END } from "@langchain/langgraph";

import * as z from "zod";
import { saveGraphAsPng, visualizeGraph } from "../../utils/graphVisualize";
import { logNodeExecution, logNodeResult } from "../../utils/nodeLogger";

// Define the state
const BMIState = new StateSchema({
  height: z.number(),
  weight: z.number(),
  bmi: z.number().optional(),
});

//Nodes
const calculateBMI = (state: typeof BMIState.State) => {
  logNodeExecution("calculateBMI", state);
  const bmi = state.weight / (state.height * state.height);
  logNodeResult("calculateBMI", { bmi });
  return { bmi };
};

//Graph
const graph = new StateGraph(BMIState)
  .addNode("calculateBMI", calculateBMI)
  .addEdge(START, "calculateBMI")
  .addEdge("calculateBMI", END)
  .compile();

//Visualize graph
await visualizeGraph(graph);
await saveGraphAsPng(graph, "bmi_graph.png");

// Run Graph
const result = await graph.invoke({
  height: 1.75,
  weight: 70,
});

console.log(result);
