"use client";

export default function Home() {
  const handleClick = async () => {
    try {
      const res = await fetch("/api/createNewUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sleeperUsername: "asotzrocky" }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server responded ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (data.success) {
        alert("User created successfully.");
      } else {
        alert(`Error: ${data.error}`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("handleClick error:", err);
      alert(`Error: ${err.message}`);
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
