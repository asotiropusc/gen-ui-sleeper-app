"use client";

import { useEffect, useState } from "react";
import {
  AIConversation,
  AIConversationContent,
  AIConversationScrollButton,
} from "../external/kibo-ui/ai/conversation";
import { AIMessage, AIMessageContent } from "../external/kibo-ui/ai/message";
import { UIMessage } from "@ai-sdk/react";
import React from "react";

type ChatComponentProps = {
  username: string;
  startTyping: boolean;
  messages: UIMessage[];
};

export default function ChatComponent({
  username,
  startTyping,
  messages,
}: ChatComponentProps) {
  const [welcomeContent, setWelcomeContent] = useState("");
  const welcomeMessage = `Hi ${username}, I've analyzed your Sleeper league from top to bottom. Ask me anything — from trade advice to roast-worthy team takes.`;

  useEffect(() => {
    if (!startTyping) return;
    const welcomeChunks = welcomeMessage.split(" ");
    let currentContent = "";
    let index = 0;

    const interval = setInterval(() => {
      if (index < welcomeChunks.length) {
        currentContent += ` ${welcomeChunks[index++]}`;
        setWelcomeContent(currentContent);
      } else {
        clearInterval(interval);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [startTyping]);

  return (
    <AIConversation className="relative size-full rounded-lg border">
      <AIConversationContent>
        <AIMessage from="assistant">
          {startTyping && <AIMessageContent>{welcomeContent}</AIMessageContent>}
        </AIMessage>

        {messages.map((message) => (
          <AIMessage
            from={message.role === "user" ? "user" : "assistant"}
            key={message.id}
          >
            <AIMessageContent>
              {message.parts.map((part, index) =>
                part.type === "text" ? (
                  <React.Fragment key={index}>{part.text}</React.Fragment>
                ) : null,
              )}
            </AIMessageContent>
          </AIMessage>
        ))}
      </AIConversationContent>
      <AIConversationScrollButton />
    </AIConversation>
  );
}
