"use client";

import React, { useState, useEffect } from 'react';
import { useChat } from 'ai/react';
import { ChatInput, ChatMessages } from './ui/chat';

// Define the default message structure
interface Message {
  id: string;
  content: string | JSX.Element[]; // Update this to allow for JSX.Element array
  role: string;
}

export default function ChatSection() {
  const {
    messages,
    input,
    isLoading,
    handleSubmit,
    handleInputChange,
    reload,
    stop,
  } = useChat({ api: process.env.NEXT_PUBLIC_CHAT_API });

  // Define a default message
  const defaultMessage: Message = {
    id: 'default-msg-0',
    content: 'Welcome to our chat! If you have any questions, feel free to ask. I am an Ai system all about rUv',
    role: 'system',
  };

  // State to manage the array of messages, initialized with the default message
  const [chatMessages, setChatMessages] = useState<Message[]>([defaultMessage]);

  // Effect to update the chatMessages state with new messages from useChat
  useEffect(() => {
    if (messages && messages.length > 0) {
      // Process each message content to split into paragraphs
      const processedMessages = messages.map(msg => ({
        ...msg,
        content: typeof msg.content === 'string' ? splitIntoParagraphs(msg.content) : msg.content,
      }));
      setChatMessages(processedMessages);
    }
  }, [messages]);

  // Split message content into paragraphs
  const splitIntoParagraphs = (content: string): JSX.Element[] => {
    const paragraphs = content.split('\n\n');
    return paragraphs.map((paragraph, index) => (
      <p key={index} className="mb-2">
        {paragraph}
      </p>
    ));
  };

  return (
    <div className="space-y-4 max-w-5xl w-full">
      <ChatMessages
        messages={chatMessages}
        isLoading={isLoading}
        reload={reload}
        stop={stop}
      />
      <ChatInput
        input={input}
        handleSubmit={handleSubmit}
        handleInputChange={handleInputChange}
        isLoading={isLoading}
      />
    </div>
  );
}