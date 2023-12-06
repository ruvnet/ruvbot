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
  const systemPurpose = "I am rUv Bot, a virtual assistant designed to provide informative and supportive responses about Reuven Cohen. I offer insights into Reuven's professional journey, achievements, and projects.";
  const systemTone = "My tone is professional, friendly, and helpful.";
  const commandInstructions = "I respond to specific commands such as `/resume` to provide Reuven Cohen's professional resume, and `/facts` for interesting facts about him. My responses are tailored to present comprehensive and engaging information.";

  // Prepare the prompt with context about the system's role and the last message content
  return `${systemPurpose}\n${systemTone}\n${commandInstructions}\n\nFollowing this guidance, please provide a detailed, multi-paragraph response to the following question:\n\n${lastMessageContent}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages }: { messages: Message[] } = body;

    if (!Array.isArray(messages) || messages.some(message => !message.content || !message.role)) {
      return NextResponse.json(
        {
          error: "Invalid message format. Each message must have a role and content.",
        },
        { status: 400 },
      );
    }

    const llm = new OpenAI({
      model: "gpt-3.5-turbo",
    });

    const chatEngine = await createChatEngine(llm);

    // Concatenate all messages to form a comprehensive conversation history
    const conversationHistory = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    const prompt = preparePrompt(conversationHistory);

    const response = await chatEngine.chat(prompt, [], true); // No need to pass messages here as they're included in the prompt

    const stream = LlamaIndexStream(response);
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
