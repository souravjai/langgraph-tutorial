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
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
config();

const SemanticSchema = z.object({
  feedback: z.string().describe("The feedback provided by the user."),
  semantic: z
    .enum(["positive", "negative"])
    .optional()
    .describe("Classify the feedback as positive or negative."),
  diagonis: z.object({
    issueType: z.enum(["UX", "Bug", "Performance", "Other"]),
    tone: z.enum(["angry", "frustrating", "disappointed", "clam"]),
    urgency: z.enum(["low", "medium", "high"]),
  }),
  reply: z
    .string()
    .optional()
    .describe("The reply generated based on the feedback."),
});

// Define the state
const SemanticFeedbackState = new StateSchema(SemanticSchema.shape);

const llm = new ChatOllama({ model: "qwen3:4b" });
const sentimentModel = llm.withStructuredOutput(SemanticSchema.shape.semantic);
const replyModel = llm.withStructuredOutput(SemanticSchema.shape.reply);
const diagnosticModel = llm.withStructuredOutput(SemanticSchema.shape.diagonis);

//Nodes
const classifySentiment = async (state: typeof SemanticFeedbackState.State) => {
  logNodeExecution("ClassifySentiment", state);
  const semantic = await sentimentModel.invoke(
    `You are an expert Semantic Finder you are also able to detect sarcasm. You reply only positive or negative. Find the semantic of this feedback:${state.feedback}`,
  );
  console.log(semantic);
  logNodeResult("ClassifySentiment", { semantic });
  return { semantic };
};

const positiveReply = async (state: typeof SemanticFeedbackState.State) => {
  logNodeExecution("positiveReply", state);
  const { reply } = await replyModel.invoke(
    `Write a positive reply for the feedback ${state.feedback}`,
  );
  return { reply };
};

const negativeReply = async (state: typeof SemanticFeedbackState.State) => {
  logNodeExecution("negativeReply", state);
  const reply = await replyModel.invoke(
    `Write an apology reply for the Feedback: ${state.feedback}, The diagnosis is: ${state.diagonis.issueType}`,
  );
  console.log(reply);
  logNodeResult("negativeReply", { reply });
  return { reply };
};

const negativeDiagnostic = async (
  state: typeof SemanticFeedbackState.State,
) => {
  logNodeExecution("negativeDiagnostic", state);
  const diagonis = await diagnosticModel.invoke(
    `Find out the issueType , tone and urgency for the feedback: ${state.feedback}.`,
  );
  logNodeResult("negativeDiagnostic", { diagonis });
  return { diagonis };
};

//Graph
const graph = new StateGraph(SemanticFeedbackState)

  .addNode("ClassifySentiment", classifySentiment)
  .addNode("positiveReply", positiveReply)
  .addNode("negativeDiagnostic", negativeDiagnostic)
  .addNode("negativeReply", negativeReply)

  .addEdge(START, "ClassifySentiment")
  .addConditionalEdges(
    "ClassifySentiment",
    (state) => {
      if (!state.semantic) throw new Error("semantic needs to be generated");
      return state.semantic;
    },
    {
      positive: "positiveReply",
      negative: "negativeDiagnostic",
    },
  )
  .addEdge("positiveReply", END)
  .addEdge("negativeDiagnostic", "negativeReply")
  .addEdge("negativeReply", END)

  .compile();

//Visualize graph
await visualizeGraph(graph);
await saveGraphAsPng(graph, "sentiment-feedback.png");

// Run Graph
const result = await graph.invoke({
  feedback: "Very bad app, Unable to login in it.",
});

console.log("Final Result:", result);
