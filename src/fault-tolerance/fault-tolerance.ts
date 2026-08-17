import { StateGraph, StateSchema, START, END } from "@langchain/langgraph";
import * as z from "zod";
import { logNodeExecution, logNodeResult } from "../../utils/nodeLogger";
import { saveGraphAsPng } from "../../utils/graphVisualize";

// Fault Tolerance Pattern Example
// Demonstrates error handling and recovery in state graphs

const FaultToleranceState = new StateSchema({
  input: z.string(),
  attempt: z.number().default(0),
  result: z.string().optional(),
  error: z.string().optional(),
});

function riskyOperation(state: any) {
  logNodeExecution("riskyOperation", {
    attempt: state.attempt,
    input: state.input,
  });
  try {
    if (state.attempt < 2) {
      throw new Error(`Simulated failure on attempt ${state.attempt + 1}`);
    }
    logNodeResult("riskyOperation", { result: "Success!" });
    return { result: "Operation completed successfully" };
  } catch (err: any) {
    logNodeResult("riskyOperation", { error: err.message });
    return { error: err.message, attempt: state.attempt + 1 };
  }
}

function retry(state: any) {
  logNodeExecution("retry", { attempt: state.attempt });
  if (state.attempt < 3) {
    logNodeResult("retry", { message: "Retrying..." });
    return { attempt: state.attempt + 1 };
  }
  logNodeResult("retry", { message: "Max retries reached" });
  return { result: "Failed after max retries" };
}

const graph = new StateGraph(FaultToleranceState)
  .addNode("risky", riskyOperation)
  .addNode("retry", retry)

  .addEdge(START, "risky")
  .addEdge("retry", "risky")
  .addConditionalEdges(
    "risky",
    (state: any) => (state.error ? "retry" : "end"),
    {
      retry: "retry",
      end: END,
    },
  )
  .compile();

saveGraphAsPng(graph, "fault-tolerance.png");

async function main() {
  console.log("Fault Tolerance Pattern Example");
  const result = await graph.invoke({ input: "test data" });
  console.log("Fault Tolerance Result:", result);
}

main().catch(console.error);
