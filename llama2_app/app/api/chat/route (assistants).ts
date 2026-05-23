import { NextRequest, NextResponse } from "next/server";

interface Message {
  role: string;
  content: string;
}

async function checkRunStatus(threadId, runId, headers) {
  let pollCount = 0;
  const MAX_POLLS = 30;
  while (true) {
    if (pollCount++ >= MAX_POLLS) {
      throw new Error('Assistant response timeout after 30 seconds');
    }
    const runStatusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
      method: 'GET',
      headers: headers,
    });

    const runStatus = await runStatusResponse.json();
    if (runStatus.status === 'completed') {
      break;
    }

    // Wait for a short period before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_ASSISTANT_ID) {
    return new Response(JSON.stringify({ error: 'OPENAI_ASSISTANT_ID not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await request.json();
    const { messages, sessionId }: { messages: Message[], sessionId: string } = body;

    // Validation to ensure messages are present and the last message is from the user
    if (!messages || messages.length === 0 || messages[messages.length - 1].role !== "user") {
      return new Response(JSON.stringify({
        error: "Messages are required in the request body, and the last message must be from the user.",
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage?.content || lastMessage.content.length > 4096) {
      return new Response(JSON.stringify({ error: 'Message too long or empty' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Headers for OpenAI API requests
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'assistants=v2',
    });

    // Always create a new thread for each new session
    const threadResponse = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: headers,
    });

    if (!threadResponse.ok) {
      throw new Error(`Failed to create thread: ${await threadResponse.text()}`);
    }

    const threadData = await threadResponse.json();
    const threadId = threadData.id;

    // Post user messages to the new thread
    for (const message of messages) {
      if (message.role === 'user') {
        const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(message),
        });

        if (!messageResponse.ok) {
          throw new Error(`Failed to post message: ${await messageResponse.text()}`);
        }
      }
    }

    // Trigger a run of the assistant
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ assistant_id: process.env.OPENAI_ASSISTANT_ID || '' }),
    });

    if (!runResponse.ok) {
      throw new Error(`Failed to execute run: ${await runResponse.text()}`);
    }

    const runData = await runResponse.json();
    const runId = runData.id;

    // Check the run status
    await checkRunStatus(threadId, runId, headers);

    // Fetch the messages after the run is complete
    const completedMessagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'GET',
      headers: headers,
    });

    if (!completedMessagesResponse.ok) {
      throw new Error(`Failed to fetch messages: ${await completedMessagesResponse.text()}`);
    }

    const completedMessages = await completedMessagesResponse.json();

    let assistantResponse = '';
    completedMessages.data.forEach(msg => {
      if (msg.role === 'assistant') {
        assistantResponse += msg.content[0].text.value;
      }
    });

    // Remove JSON-safe encoding
    assistantResponse = assistantResponse.replace(/\\/g, '');

    return new Response(assistantResponse, {
      headers: { 'Content-Type': 'text/plain' },
    });

  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ error: 'An internal error occurred' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}