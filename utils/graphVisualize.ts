import { writeFile } from "fs/promises";
import { renderMermaidASCII } from "beautiful-mermaid";

interface VisualizableGraph {
  getGraphAsync(): Promise<{
    drawMermaid(): string;
    drawMermaidPng(): Promise<Blob>;
  }>;
}

export async function visualizeGraph(graph: VisualizableGraph): Promise<void> {
  const drawableGraph = await graph.getGraphAsync();

  const mermaid = drawableGraph.drawMermaid();

  // LangGraph's Mermaid output has some syntax
  // that beautiful-mermaid doesn't accept.
  const cleanedMermaid = mermaid
    .replace(/^%%\{.*?\}%%\s*/s, "")
    .replace(/^graph TD;/m, "graph TD")
    .replace(/\*\*/g, "")
    .replace(/^classDef.*$/gm, "")
    .replace(/:::first|:::last/g, "");

  console.log(renderMermaidASCII(cleanedMermaid));
}

export async function saveGraphAsPng(
  graph: VisualizableGraph,
  filename: string,
): Promise<void> {
  const drawableGraph = await graph.getGraphAsync();

  const blob = await drawableGraph.drawMermaidPng();
  const data = new Uint8Array(await blob.arrayBuffer());

  await writeFile(filename, data);

  console.log(`Graph saved to ${filename}`);
}
