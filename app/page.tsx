"use client";

import { ApiResponse, fetchJson } from "@/types/api/api";

export default function Home() {
  const handleClick = async (): Promise<void> => {
    try {
      const data = await fetchJson<ApiResponse>("/api/createNewUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sleeperUsername: "asotzrocky" }),
      });

      if (data.success) {
        alert("User created successfully.");
      } else {
        alert(`Error: ${data.error ?? "Unknown error"}`);
      }
    } catch (err: unknown) {
      console.error("handleClick error:", err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`Error: ${message}`);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Hello.</h1>
      <button
        onClick={handleClick}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Click me
      </button>
    </div>
  );
}
