"use client";

import { useChat } from "@ai-sdk/react";
import { Card, CardContent, CardFooter } from "../external/shadcn/card";
import AppAIInput from "./AppAIInput";
import ChatComponent from "./ChatComponent";
import { useLoading } from "@/contexts/LoadingContext";
import { useEffect } from "react";

type AIChatPanelProps = {
  username: string;
  startTyping: boolean;
};

export default function AIChatPanel({
  username,
  startTyping,
}: AIChatPanelProps) {
  const { messages, sendMessage, status } = useChat();
  const { setIsLoading } = useLoading();

  useEffect(() => {
    setIsLoading(status === "submitted" || status === "streaming");
  }, [setIsLoading, status]);

  return (
    <Card className="flex flex-col h-[85vh] w-full max-w-4xl mx-auto">
      <CardContent className="flex flex-col flex-1 overflow-hidden px-4">
        <ChatComponent
          username={username}
          startTyping={startTyping}
          messages={messages}
        />
      </CardContent>
      <CardFooter className="pt-4 border-t">
        <AppAIInput sendMessage={sendMessage} status={status} />
      </CardFooter>
    </Card>
  );
}
