import { groq } from "@ai-sdk/groq";
import { streamText, UIMessage, convertToModelMessages } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: groq("llama-3.1-8b-instant"),
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
