"use client";
import Image from "next/image";
import logoNoBg from "@/assets/logo_no_bg.png";
import FuzzyTextWrapper from "./FuzzyTextWrapper";
import { LayoutGroup, motion } from "motion/react";

type AnimatedHeaderProps = {
  screenState: "welcome" | "transitioning" | "chat" | "chatVisible";
};

const MotionFuzzy = motion.create(FuzzyTextWrapper);

export default function AnimatedHeader({ screenState }: AnimatedHeaderProps) {
  const shouldAnimate = screenState === "chat" || screenState === "chatVisible";

  return (
    <LayoutGroup>
      <motion.div
        layout
        initial={false}
        transition={{
          layout: { type: "spring", stiffness: 1000, damping: 200 },
        }}
        className={`flex items-center ${shouldAnimate ? "flex-row justify-center" : "flex-col justify-start"}`}
      >
        <motion.div
          layout
          animate={{
            width: shouldAnimate ? 100 : 250,
            height: shouldAnimate ? 100 : 250,
          }}
          transition={{
            type: "tween",
            duration: 0.8,
            ease: "easeInOut",
          }}
        >
          <Image
            src={logoNoBg}
            alt="SleeperSageLogo"
            width={250}
            height={250}
          />
        </motion.div>

        <MotionFuzzy
          layout
          fontSize={shouldAnimate ? "4.5rem" : "8rem"}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          Sleeper Sage
        </MotionFuzzy>
      </motion.div>
    </LayoutGroup>
  );
}
