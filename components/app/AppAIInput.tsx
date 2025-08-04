"use client";

import { useState } from "react";
import {
  AIInput,
  AIInputSubmit,
  AIInputTextarea,
  AIInputToolbar,
  AIInputTools,
} from "../external/kibo-ui/ai/input";
import type { useChat } from "@ai-sdk/react";

type ChatHook = ReturnType<typeof useChat>;
type AppAIInputProps = Pick<ChatHook, "sendMessage" | "status">;

export default function AppAIInput({ sendMessage, status }: AppAIInputProps) {
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    setMessage("");
    await sendMessage({ text });
  }

  const disabled = !message.trim() || status !== "ready";

  return (
    <AIInput onSubmit={handleSubmit} className="w-full px-2 py-3">
      <AIInputTextarea
        value={message}
        onChange={(e) => setMessage(e.currentTarget.value)}
        minHeight={48}
        maxHeight={160}
        placeholder="Ask Sleeper Sage anything about your fantasy league..."
      />
      <AIInputToolbar>
        <AIInputTools></AIInputTools>
        <AIInputSubmit disabled={disabled} status={status} />
      </AIInputToolbar>
    </AIInput>
  );
}
