export interface MedicalChunk {
  id: string;
  source: "WHO";
  title: string;
  text: string;
  tags: string[];
}

export interface StoredEmbedding {
  id: string;
  embedding: number[];
}

export interface RetrievedChunk extends MedicalChunk {
  similarity: number;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  message: string;
}

export interface ConversationResponse {
  assistant_message: string;
  follow_up_questions: string[];
  urgency: "low" | "medium" | "high";
  reasoning: string;
}

export interface ConversationTurnInput {
  userInput: string;
  history: ConversationMessage[];
}

export interface ConversationTurnResult {
  response: ConversationResponse;
  retrievedChunks: RetrievedChunk[];
  rawModelOutput: string | null;
}
