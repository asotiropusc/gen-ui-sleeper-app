"use client";

import { useLoading } from "@/contexts/LoadingContext";
import { AnimatePresence, motion } from "motion/react";
import TextType from "../external/react-bits/TextType/TextType";

export default function WelcomeMessage() {
  const { isLoading } = useLoading();

  return (
    <div className="min-h-14 flex items-center justify-center">
      <AnimatePresence mode="wait">
        {!isLoading ? (
          <motion.p
            key="intro"
            className="max-w-md text-center text-lg text-gray-300"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.4 }}
          >
            Enter your Sleeper username to get started with personalized
            fantasy-football insights powered by AI.
          </motion.p>
        ) : (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.4 }}
          >
            <TextType
              text={[
                "Loading your Sleeper league",
                "Summoning fantasy stats",
                "Generating AI insights",
                "This may take a few seconds",
              ]}
              typingSpeed={70}
              pauseDuration={1600}
              showCursor={true}
              cursorCharacter="..."
              className="text-center text-lg text-gray-300"
            ></TextType>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
