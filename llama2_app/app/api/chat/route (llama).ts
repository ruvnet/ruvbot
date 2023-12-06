import { Message, StreamingTextResponse } from "ai";
import { OpenAI } from "llamaindex";
import { NextRequest, NextResponse } from "next/server";
import { createChatEngine } from "./engine";
import { LlamaIndexStream } from "./llamaindex-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Function to prepare the AI's context and instructions
function preparePrompt(lastMessageContent) {
  // Define the system's purpose and desired tone
  const systemPurpose = "I am a virtual assistant designed to provide informative and supportive responses. My name is ruvbot";
  const systemTone = "My tone is professional, friendly, and helpful.";

  // Prepare the prompt with context about the system's role and the last message content
  return `${systemPurpose}\n${systemTone}\n\nFollowing this guidance, please provide a detailed, multi-paragraph response to the following question:\n\n${lastMessageContent}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages }: { messages: Message[] } = body;
    const lastMessage = messages.pop();
    if (!messages || !lastMessage || lastMessage.role !== "user") {
      return NextResponse.json(
        {
          error: "Messages are required in the request body, and the last message must be from the user.",
        },
        { status: 400 },
      );
    }

    const llm = new OpenAI({
      model: "gpt-3.5-turbo",
    });

    const chatEngine = await createChatEngine(llm);

    // Generate the prompt with system context and user's last message
    const prompt = preparePrompt(lastMessage.content);

    // Call the chat engine with the prompt that includes system guidance
    const response = await chatEngine.chat(prompt, messages, true);

    // Transform the response into a readable stream
    const stream = LlamaIndexStream(response);

    // Return a StreamingTextResponse, which can be consumed by the client
    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return NextResponse.json(
      {
        error: (error as Error).message,
      },
      {
        status: 500,
      },
    );
  }
}