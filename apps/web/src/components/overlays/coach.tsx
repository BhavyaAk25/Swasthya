"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useApp } from "@/components/app";
import { calm, Chip, Sheet } from "@/components/ui";
import { offlineReply, understand } from "@/lib/coach";
import { actions, todayOf } from "@/lib/store";
import type { CoachAction, CoachContext, CoachReply } from "@/lib/types";
import { cn } from "@/lib/utils";

const SUGGESTIONS = ["I had 2 eggs and toast", "I'm tired today", "Only 15 minutes", "Help me relax"];

export function CoachSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Coach">
      <Chat onClose={onClose} />
    </Sheet>
  );
}

function Chat({ onClose }: { onClose: () => void }) {
  const { data, ai, open } = useApp();
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const messages = data.messages;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, thinking]);

  function runAction(action: CoachAction) {
    if (!action) return;
    // Let the reply land, then hand over to the right tool.
    setTimeout(() => {
      onClose();
      setTimeout(
        () => open(action === "open_camera" ? "camera" : action === "open_squats" ? "squats" : { recovery: { minutes: 10 } }),
        320,
      );
    }, 700);
  }

  async function send(raw: string) {
    const message = raw.trim().slice(0, 600);
    if (!message || thinking) return;
    setText("");
    actions.addMessage("user", message);

    const intent = understand(message);
    if (intent.kind === "meal") {
      const protein = todayOf(data).protein + intent.estimate.protein;
      actions.addMeal({ ...intent.estimate, source: "text" });
      actions.addMessage("coach", `Logged ${intent.estimate.items.join(", ")} — about ${intent.estimate.calories} kcal. You're at ${protein}g protein today.`);
      return;
    }
    if (intent.kind === "adapt") {
      actions.setAdaptation(intent.constraint);
      actions.addMessage("coach", intent.text);
      return;
    }
    if (intent.kind === "done") {
      actions.setWorkoutStatus("done");
      actions.addMessage("coach", intent.text);
      return;
    }
    if (intent.kind === "action") {
      actions.addMessage("coach", intent.text);
      runAction(intent.action);
      return;
    }

    if (!ai.ai) {
      actions.addMessage("coach", offlineReply(message));
      return;
    }

    setThinking(true);
    try {
      const t = todayOf(data);
      const profile = data.profile!;
      const context: CoachContext = {
        name: profile.name,
        goal: profile.goal,
        session: t.session?.title ?? "Rest",
        calories: t.calories,
        calorieTarget: profile.calorieTarget,
        protein: t.protein,
        proteinTarget: profile.proteinTarget,
      };
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          context,
          history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text.slice(0, 600) })),
        }),
      });
      const reply = (await res.json().catch(() => null)) as CoachReply | null;
      if (!res.ok || !reply?.text) throw new Error();
      actions.addMessage("coach", reply.text);
      runAction(reply.action);
    } catch {
      actions.addMessage("coach", offlineReply(message));
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="flex min-h-[55dvh] flex-col">
      <div className="flex-1 space-y-3 pb-4">
        {messages.length === 0 ? <p className="py-6 text-center text-sm text-ink-faint">Ask about meals, training or rest.</p> : null}
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={calm}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-[22px] px-4 py-2.5 text-[15px] leading-relaxed",
                  m.role === "user" ? "rounded-br-md bg-moss text-white" : "rounded-bl-md bg-surface-2 text-ink",
                )}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
          {thinking ? (
            <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-1 px-4 py-3">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-ink-faint"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 -mx-6 bg-surface px-6 pb-1 pt-3">
        <div className="no-scrollbar -mx-6 mb-3 flex gap-2 overflow-x-auto px-6">
          {SUGGESTIONS.map((s) => (
            <Chip key={s} onClick={() => void send(s)}>
              {s}
            </Chip>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
          className="flex items-center gap-2 rounded-full border border-line bg-bg p-1.5 pl-5 focus-within:border-sage"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={600}
            placeholder="Message your coach"
            aria-label="Message"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
          />
          <motion.button
            type="submit"
            aria-label="Send"
            disabled={!text.trim() || thinking}
            whileTap={{ scale: 0.9 }}
            className="grid h-10 w-10 place-items-center rounded-full bg-moss text-white disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.2} />
          </motion.button>
        </form>
      </div>
    </div>
  );
}
