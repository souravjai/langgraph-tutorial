/**
 * Log node execution with input details
 * @param nodeName - Name of the node being executed
 * @param input - Input data passed to the node
 */
export function logNodeExecution(nodeName: string, input: any): void {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] 📍 Executing Node: ${nodeName}`);
  if (input && Object.keys(input).length > 0) {
    console.log("  Input:", JSON.stringify(input, null, 2));
  }
}

/**
 * Log node result/output
 * @param nodeName - Name of the node that executed
 * @param result - Output data from the node
 */
export function logNodeResult(nodeName: string, result: any): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ✓ Node Result: ${nodeName}`);
  if (result && Object.keys(result).length > 0) {
    console.log("  Output:", JSON.stringify(result, null, 2));
  }
  console.log("---");
}
