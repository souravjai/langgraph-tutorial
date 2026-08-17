import {
  StateGraph,
  StateSchema,
  START,
  END,
  MemorySaver,
} from "@langchain/langgraph";
import * as z from "zod";
import { logNodeExecution, logNodeResult } from "../../utils/nodeLogger";

// Persistence Pattern Example
// Demonstrates graph state persistence and checkpointing

const PersistenceState = new StateSchema({
  step: z.number().default(0),
  data: z.string().default(""),
  checkpoint: z.string().optional(),
});

const graph = new StateGraph(PersistenceState);

function step1(state: any) {
  logNodeExecution("step1", { step: state.step });
  const data = state.data + "[Step1] ";
  logNodeResult("step1", { data });
  return { data, step: 1 };
}

function step2(state: any) {
  logNodeExecution("step2", { step: state.step });
  const data = state.data + "[Step2] ";
  const checkpoint = `Checkpoint at step 2: ${data}`;
  logNodeResult("step2", { data, checkpoint });
  return { data, step: 2, checkpoint };
}

function step3(state: any) {
  logNodeExecution("step3", { step: state.step });
  const data = state.data + "[Step3] ";
  const checkpoint = `Checkpoint at step 3: ${data}`;
  logNodeResult("step3", { data, checkpoint });
  return { data, step: 3, checkpoint };
}

graph
  .addNode("step1", step1)
  .addNode("step2", step2)
  .addNode("step3", step3)
  .addEdge(START, "step1")
  .addEdge("step1", "step2")
  .addEdge("step2", "step3")
  .addEdge("step3", END);

// Using MemorySaver for checkpointing
const checkpointer = new MemorySaver();
const compiled = graph.compile({ checkpointer });

async function main() {
  console.log("Persistence Pattern Example");
  const config = { configurable: { thread_id: "thread-1" } };
  const result = await compiled.invoke({ step: 0, data: "" }, config);
  console.log("Persistence Result:", result);
}

main().catch(console.error);
