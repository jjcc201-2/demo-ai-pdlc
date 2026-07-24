import type { ReactNode } from "react";
import RunNav from "@/components/RunNav";

export default function RunLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RunNav />
      {children}
    </>
  );
}
