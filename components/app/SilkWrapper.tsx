"use client";

import Silk from "../external/react-bits/Silk/Silk";
import { useLoading } from "@/contexts/LoadingContext";

export default function SilkBackground() {
  const { isLoading } = useLoading();

  return (
    <Silk
      speed={isLoading ? 20 : 5}
      scale={1}
      color={isLoading ? "#426BBD" : "#283E69"}
      noiseIntensity={1.5}
      rotation={0}
    />
  );
}
