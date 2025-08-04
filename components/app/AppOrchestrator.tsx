"use client";

import { useState } from "react";
import AnimatedHeader from "./AnimatedHeader";
import { AnimatePresence, motion } from "motion/react";
import WelcomeMessage from "./WelcomeParagraph";
import AppUsernameInput from "./AppUsernameInput";
import AIChatPanel from "./AIChatPanel";

type ScreenState = "welcome" | "transitioning" | "chat" | "chatVisible";

export default function AppOrchestrator() {
  const [screen, setScreen] = useState<ScreenState>("welcome");
  const [username, setUsername] = useState("");

  const handleUsernameSubmit = (name: string) => {
    setScreen("transitioning");
    setUsername(name);
  };

  return (
    <motion.div
      layout
      initial={false}
      transition={{ layout: { duration: 0.8, ease: "easeInOut" } }}
      className={`flex flex-col items-center ${
        screen !== "welcome" ? "justify-start pt-4" : "justify-center space-y-4"
      } h-screen px-4 md:px-0`}
    >
      <AnimatedHeader screenState={screen} />

      <AnimatePresence
        mode="sync"
        onExitComplete={() => {
          setScreen("chat");
        }}
      >
        {screen === "welcome" && (
          <>
            <motion.div
              key="welcome-msg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                x: "-100vw",
                transition: { duration: 1, ease: "easeInOut" },
              }}
              transition={{ duration: 0.15 }}
            >
              <WelcomeMessage />
            </motion.div>

            <motion.div
              key="username-input"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                x: "100vw",
                transition: { duration: 1, ease: "easeInOut" },
              }}
              transition={{ duration: 0.15, delay: 0.1 }}
              className="w-full max-w-3xl sm:min-w-xl"
            >
              <AppUsernameInput onUsernameSubmit={handleUsernameSubmit} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(screen === "chat" || screen === "chatVisible") && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{
              type: "tween",
              duration: 0.8,
              ease: "easeInOut",
            }}
            className="w-full flex-grow"
            onAnimationComplete={() => setScreen("chatVisible")}
          >
            <AIChatPanel
              username={username}
              startTyping={screen === "chatVisible"}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
