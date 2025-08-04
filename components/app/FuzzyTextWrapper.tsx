"use client";

import { ReactNode } from "react";
import FuzzyText from "../external/react-bits/FuzzyText/FuzzyText";

interface FuzzyTextWrapperProps {
  children: ReactNode;
  fontSize?: string;
}

export default function FuzzyTextWrapper({
  children,
  fontSize = "clamp(3rem, 8vw, 10rem)",
}: FuzzyTextWrapperProps) {
  return (
    <FuzzyText
      baseIntensity={0.02}
      hoverIntensity={0}
      enableHover={false}
      fontSize={fontSize}
      className="font-figtree"
    >
      {children}
    </FuzzyText>
  );
}
