import { LoadingProvider } from "@/contexts/LoadingContext";
import { PropsWithChildren } from "react";

export default function Providers({ children }: PropsWithChildren) {
  return <LoadingProvider>{children}</LoadingProvider>;
}
