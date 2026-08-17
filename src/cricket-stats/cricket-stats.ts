import { StateGraph, StateSchema, START, END } from "@langchain/langgraph";

import * as z from "zod";
import { saveGraphAsPng, visualizeGraph } from "../../utils/graphVisualize";
import { logNodeExecution, logNodeResult } from "../../utils/nodeLogger";

import { config } from "dotenv";
config();

// Define the state
const CricketStatsState = new StateSchema({
  runs: z.number(),
  balls: z.number(),
  fours: z.number(),
  sixes: z.number(),

  strike_rate: z.number().optional(),
  balls_per_boundary: z.number().optional(),
  boundary_percentage: z.number().optional(),

  summary: z.string().optional(),
});

//Nodes
const calculateStrikeRate = async (state: typeof CricketStatsState.State) => {
  logNodeExecution("CalculateStrikeRate", state);
  const strike_rate = (state.runs / state.balls) * 100;
  logNodeResult("CalculateStrikeRate", { strike_rate });
  return { strike_rate };
};

const calculateBallsPerBoundary = async (
  state: typeof CricketStatsState.State,
) => {
  logNodeExecution("CalculateBallsPerBoundary", state);
  const total_boundaries = state.fours + state.sixes;
  const balls_per_boundary = state.balls / total_boundaries;
  logNodeResult("CalculateBallsPerBoundary", { balls_per_boundary });
  return { balls_per_boundary };
};

const calculateBoundaryPercentage = async (
  state: typeof CricketStatsState.State,
) => {
  logNodeExecution("CalculateBoundaryPercentage", state);
  const total_boundaries_run = state.fours * 4 + state.sixes * 6;
  const boundary_percentage = (total_boundaries_run / state.balls) * 100;
  logNodeResult("CalculateBoundaryPercentage", { boundary_percentage });
  return { boundary_percentage };
};

const summarizeStats = async (state: typeof CricketStatsState.State) => {
  logNodeExecution("SummarizeStats", state);
  const summary = `The player scored ${state.runs} runs in ${state.balls} balls, hitting ${state.fours} fours and ${state.sixes} sixes. The strike rate is ${state.strike_rate?.toFixed(
    2,
  )}% and the boundary percentage is ${state.boundary_percentage?.toFixed(2)}%.`;
  logNodeResult("SummarizeStats", { summary });
  return { summary };
};

//Graph
const graph = new StateGraph(CricketStatsState)

  .addNode("CalculateStrikeRate", calculateStrikeRate)
  .addNode("CalculateBallsPerBoundary", calculateBallsPerBoundary)
  .addNode("CalculateBoundaryPercentage", calculateBoundaryPercentage)
  .addNode("SummarizeStats", summarizeStats)

  .addEdge(START, "CalculateBallsPerBoundary")
  .addEdge(START, "CalculateStrikeRate")
  .addEdge(START, "CalculateBoundaryPercentage")
  .addEdge("CalculateBallsPerBoundary", "SummarizeStats")
  .addEdge("CalculateStrikeRate", "SummarizeStats")
  .addEdge("CalculateBoundaryPercentage", "SummarizeStats")
  .addEdge("SummarizeStats", END)

  .compile();

//Visualize graph
await visualizeGraph(graph);
await saveGraphAsPng(graph, "cricket_stats.png");

// Run Graph
const result = await graph.invoke({
  runs: 100,
  balls: 60,
  fours: 10,
  sixes: 5,
});

console.log(result.summary);
