import { StateGraph, StateSchema, START, END } from "@langchain/langgraph";

import * as z from "zod";
import { saveGraphAsPng, visualizeGraph } from "../../utils/graphVisualize";
import { logNodeExecution, logNodeResult } from "../../utils/nodeLogger";
import { ChatOllama } from "@langchain/ollama";
import { StringOutputParser } from "@langchain/core/output_parsers";

import { config } from "dotenv";

//@ts-ignore
import render from "cli-markdown";

config();

// Define the state
const BlogState = new StateSchema({
  topic: z.string(),
  outline: z.string().optional(),
  blog: z.string().optional(),
  rating: z.number().optional(),
});

const llm = new ChatOllama({ model: "qwen3:4b" });
const stringOutputParser = new StringOutputParser();

const ratingModel = llm.withStructuredOutput(
  z.object({
    rating: z
      .number()
      .min(1)
      .max(10)
      .describe(
        "A number between 1 and 10 representing the rating of the blog post.",
      ),
  }),
);
const model = llm.pipe(stringOutputParser);

//Nodes
const createOutline = async (state: typeof BlogState.State) => {
  logNodeExecution("createOutline", state);
  const prompt = `You are a professional content strategist.

Create a clear and detailed outline for a blog post about:
"${state.topic}"

The outline should:
- Have a logical introduction, body, and conclusion
- Contain 4-6 main sections
- Include key points that should be discussed under each section
- Be suitable for a well-researched technical blog

Return only the outline. Do not write the actual blog post.
`;
  const outline = await model.invoke(prompt);
  console.log("Outline:\n\n");
  console.log(render(outline));
  logNodeResult("createOutline", { outline });
  return { outline };
};

const createBlog = async (state: typeof BlogState.State) => {
  logNodeExecution("createBlog", state);
  const prompt = `You are a professional technical writer.

Write a high-quality blog post about:
"${state.topic}"

Use the following outline as the structure for the article:

${state.outline}

Requirements:
- Follow the outline closely
- Explain concepts clearly for a general technical audience
- Use appropriate headings and subheadings
- Provide useful examples where relevant
- Avoid unnecessary repetition
- End with a concise conclusion

Return only the blog post`;
  const blog = await model.invoke(prompt);
  console.log("Blog:\n\n");
  console.log(render(blog));
  logNodeResult("createBlog", { blog });
  return { blog };
};

const rateBlog = async (state: typeof BlogState.State) => {
  logNodeExecution("rateBlog", state);
  const prompt = `You are an expert blog editor.

Evaluate the following blog post:

Topic:
${state.topic}

Blog:
${state.blog}

Rate the blog post from 1 to 10 based on:
- Accuracy and relevance
- Structure and organization
- Clarity and readability
- Depth and usefulness
- Overall writing quality

Use the full 1–10 range appropriately:
1 = extremely poor
5 = average
10 = exceptional

Return only the structured rating. Do not provide explanations.
`;
  const { rating } = await ratingModel.invoke(prompt);
  console.log("Rating:\n\n");
  console.log(rating);
  logNodeResult("rateBlog", { rating });
  return { rating };
};

//Graph
const graph = new StateGraph(BlogState)

  .addNode("createOutline", createOutline)
  .addNode("createBlog", createBlog)
  .addNode("rateBlog", rateBlog)

  .addEdge(START, "createOutline")
  .addEdge("createOutline", "createBlog")
  .addEdge("createBlog", "rateBlog")
  .addEdge("rateBlog", END)

  .compile();

//Visualize graph
await visualizeGraph(graph);
await saveGraphAsPng(graph, "blog_writer.png");

// Run Graph
await graph.invoke({
  topic: "How mobile phone causes insomnia and how to prevent it",
});
