import Image from "next/image";

import { cn } from "@/lib/utils";

/** The selected opening lotus, shared by the shell and welcome screen. */
export function SwasthyaWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/brand/swasthya-lotus.svg"
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 shrink-0"
      />
      <span className="font-display text-[22px] leading-none">swasthya</span>
    </div>
  );
}
