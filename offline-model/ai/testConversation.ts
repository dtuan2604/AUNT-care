import { createInterface } from "node:readline/promises";
import process from "node:process";

import { MAX_HISTORY_MESSAGES } from "./config.js";
import { runConversationTurnDetailed } from "./rag/conversation.js";
import type { ConversationMessage } from "./types.js";

function trimHistory(history: ConversationMessage[]) {
  return history.slice(-MAX_HISTORY_MESSAGES);
}

async function main() {
  const debugMode = process.argv.includes("--debug");
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const history: ConversationMessage[] = [];

  console.log("Offline WHO medical RAG CLI");
  console.log("Type 'exit' or 'quit' to stop.\n");

  try {
    while (true) {
      const input = (await readline.question("You: ")).trim();
      if (!input) {
        continue;
      }

      if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
        break;
      }

      const result = await runConversationTurnDetailed({
        userInput: input,
        history: trimHistory(history),
      });

      if (debugMode && result.retrievedChunks.length > 0) {
        console.log("\nRetrieved WHO chunks:");
        for (const chunk of result.retrievedChunks) {
          console.log(
            `- ${chunk.title} (${chunk.similarity.toFixed(3)}) [${chunk.id}]`,
          );
        }
      }

      console.log("\nAssistant JSON:");
      console.log(JSON.stringify(result.response, null, 2));
      console.log("");

      history.push(
        { role: "user", message: input },
        {
          role: "assistant",
          message: result.response.assistant_message,
        },
      );

      const trimmed = trimHistory(history);
      history.splice(0, history.length, ...trimmed);
    }
  } finally {
    readline.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Conversation test failed: ${message}`);
  process.exitCode = 1;
});
