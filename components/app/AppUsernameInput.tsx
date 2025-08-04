"use client";

import { ApiResponse, fetchJson } from "@/types/api/api";
import {
  AIInput,
  AIInputSubmit,
  AIInputText,
} from "../external/kibo-ui/ai/input";
import { useState } from "react";
import { useLoading } from "@/contexts/LoadingContext";
import { toast } from "sonner";

type AppAIInputProps = {
  onUsernameSubmit: (username: string) => void;
};

export default function AppUsernameInput({
  onUsernameSubmit,
}: AppAIInputProps) {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<
    "submitted" | "streaming" | "ready" | "error"
  >("ready");

  const { setIsLoading } = useLoading();

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();

    if (!username.trim() || status === "submitted") return;

    toast.dismiss();
    setStatus("submitted");
    setIsLoading(true);

    try {
      const data = await fetchJson<ApiResponse>("/api/createNewUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sleeperUsername: username }),
      });

      if (data.success) {
        toast.success("Your League Data has been successfully uploaded!", {
          dismissible: false,
          onAutoClose: () => {
            onUsernameSubmit(username);
            setStatus("ready");
          },
          duration: 1500,
        });
      } else {
        switch (data.code) {
          case "INVALID_USERNAME":
            toast.error(
              "Username not found. Please check your spelling or try again.",
            );
            break;
          case "INVALID_JSON_PAYLOAD":
            toast.error("There was a problem reading your request. Try again?");
            break;
          case "UNEXPECTED_ERROR":
          default:
            toast.error("Network Error: Please try again later.");
            break;
        }

        setStatus("error");
      }
    } catch (err: unknown) {
      console.error("handleClick error:", err);
      toast.error("Network error: please try again later.");
      setStatus("error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AIInput
      onSubmit={handleSubmit}
      className="w-full max-w-l sm:min-w-xl mx-auto flex p-2"
    >
      <AIInputText
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Enter your Sleeper username."
        spellCheck={false}
      ></AIInputText>
      <AIInputSubmit
        disabled={!username.trim() || status === "submitted"}
        status={status}
      ></AIInputSubmit>
    </AIInput>
  );
}
