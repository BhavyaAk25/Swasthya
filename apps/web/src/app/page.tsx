import { App } from "@/components/app";

// The shell references versioned media and code; always serve the current release.
export const dynamic = "force-dynamic";

export default function Page() {
  return <App />;
}
