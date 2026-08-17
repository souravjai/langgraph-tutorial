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
config();

// Define the state
const EssayGradingState = new StateSchema({
  essay: z.string().describe("The essay to be rated."),
  clarity_of_thought_feedback: z.string().optional(),
  depth_of_analysis_feedback: z.string().optional(),
  language_and_style_feedback: z.string().optional(),
  ratings: new ReducedValue(z.array(z.number()).default([]), {
    inputSchema: z.array(z.number()),
    reducer: (current, next) => [...current, ...next],
  }),
  final_feedback: z.string().optional(),
  average_rating: z.number().optional(),
});

//Models
const llm = new ChatOllama({ model: "qwen3:4b" });
const model = llm.withStructuredOutput(
  z.object({
    feedback: z.string().describe("Feedback on the essay."),
    rating: z
      .number()
      .min(1)
      .max(10)
      .describe(
        "A number between 1 and 10 representing the rating of the essay.",
      ),
  }),
);

//Nodes

const gradeClarityOfThought = async (state: typeof EssayGradingState.State) => {
  logNodeExecution("gradeClarityOfThought", state);
  const prompt = `You are an expert essay grader. \n Evaluate the clarity of thought in the following essay: \n"${state.essay}" \n Provide feedback and a rating between 0 and 10.`;

  const { feedback, rating } = await model.invoke(prompt);
  logNodeResult("gradeClarityOfThought", {
    clarity_of_thought_feedback: feedback,
    ratings: [rating],
  });
  return { clarity_of_thought_feedback: feedback, ratings: [rating] };
};

const gradeDepthOfAnalysis = async (state: typeof EssayGradingState.State) => {
  logNodeExecution("gradeDepthOfAnalysis", state);
  const prompt = `You are an expert essay grader. \n Evaluate the depth of analysis in the following essay: \n"${state.essay}" \n Provide feedback and a rating between 0 and 10.`;
  const { feedback, rating } = await model.invoke(prompt);
  logNodeResult("gradeDepthOfAnalysis", {
    depth_of_analysis_feedback: feedback,
    ratings: [rating],
  });
  return {
    depth_of_analysis_feedback: feedback,
    ratings: [rating],
  };
};

const gradeLanguageAndStyle = async (state: typeof EssayGradingState.State) => {
  logNodeExecution("gradeLanguageAndStyle", state);
  const prompt = `You are an expert essay grader. \n Evaluate the language and style in the following essay: \n"${state.essay}" \n Provide feedback and a rating between 0 and 10.`;
  const { feedback, rating } = await model.invoke(prompt);
  logNodeResult("gradeLanguageAndStyle", {
    language_and_style_feedback: feedback,
    ratings: [rating],
  });
  return {
    language_and_style_feedback: feedback,
    ratings: [rating],
  };
};

const finalEvaluation = async (state: typeof EssayGradingState.State) => {
  logNodeExecution("finalEvaluation", state);
  const ratings = state.ratings ?? [];
  const average_rating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

  const prompt = `You are an expert essay grader. \n Provide a final evaluation of the essay based on the following feedback: \n Clarity of Thought Feedback: ${state.clarity_of_thought_feedback}\n Depth of Analysis Feedback: ${state.depth_of_analysis_feedback}\n Language and Style Feedback: ${state.language_and_style_feedback}\n The average rating is ${average_rating.toFixed(2)} out of 10. \n Provide a final feedback summary.`;

  const result = await llm.invoke(prompt);
  logNodeResult("finalEvaluation", {
    final_feedback: result.content,
    average_rating,
  });
  return {
    final_feedback: result.content,
    average_rating,
  };
};

//Graph
const graph = new StateGraph(EssayGradingState)

  .addNode("gradeClarityOfThought", gradeClarityOfThought)
  .addNode("gradeDepthOfAnalysis", gradeDepthOfAnalysis)
  .addNode("gradeLanguageAndStyle", gradeLanguageAndStyle)
  .addNode("finalEvaluation", finalEvaluation)

  .addEdge(START, "gradeClarityOfThought")
  .addEdge(START, "gradeDepthOfAnalysis")
  .addEdge(START, "gradeLanguageAndStyle")
  .addEdge("gradeClarityOfThought", "finalEvaluation")
  .addEdge("gradeDepthOfAnalysis", "finalEvaluation")
  .addEdge("gradeLanguageAndStyle", "finalEvaluation")
  .addEdge("finalEvaluation", END)

  .compile();

//Visualize graph
await visualizeGraph(graph);
await saveGraphAsPng(graph, "essay_grading.png");

// Run Graph
const result = await graph.invoke({
  essay: `Tourism in India

Toruisim in Idnia

Tourisum in India is very imoprtant for our cuntry. India is a big cuntry and there are many palces to visti. There is Tajmahal, Kashimr, Goa, Kerla and Rajastan. Many turists comes to see these palces.

Tourism gives employement to many peopel. Tourist stay in hotles, eat food and travle in cars and trains. Shopkepper and taxi drivers can also earn mony from tourism. So tourism is good for our econmy.

India has many diffrent types of tourism. There is religous tourism, historical tourism and natuer tourism. Many peopel visit temples and old monumants. Foregin tourists also come to see Indian cultuer and traditons.

But tourism has some problmes. Too many tourist can create crowed and trafffic. They also throw garbge and plastic in some palces. Historical monumants can get damged. The enviroment can also be harmd.

The goverment should make better roads and facilites for tourists. Tourist palces should be kept cleen and safe. Local peopel should also get benifit from tourism.

In conclution, tourism is very importent for India. It gives jobs and money and shows our cultuer to the world. But tourism should be done in a good way so that our natuer and monumants are not damged.

Tourism is importent for India because India has many palces and many tourist comes to India.`,
});
console.log("Scores", result.ratings);
console.log("Final Result:", result.final_feedback, result.average_rating);
