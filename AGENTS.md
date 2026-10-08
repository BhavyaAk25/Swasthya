# AGENTS.md

## Product
Swasthya is a calm, minimalist wellness website for meals (Nourish), training (Move), recovery (Restore) and a coach chat. It is responsive: sidebar on desktop, bottom tabs on phones.

## Hard rules
- **Free and local.** No paid APIs, no cloud services, no accounts. All user data lives in browser `localStorage` (`lib/store.ts`).
- **AI is optional.** Gemini (a free AI Studio key) only upgrades features. Every AI feature must keep working offline through its fallback (see `docs/ARCHITECTURE.md`).
- **Gemini is server-side only.** Never expose `GEMINI_API_KEY`. Live voice uses single-use ephemeral tokens.
- **Validate everything on the server.** Use zod on input and output, cap lengths, keep user text out of system instructions, and never echo provider errors.
- Never commit secrets. `.env.local` is gitignored.
- Meal numbers are estimates. No medical claims. Don't use real people's names or likeness.

## Design
- Light theme, warm linen background, moss/sage/clay palette, Fraunces display + Manrope body.
- Minimal text. Image areas use `ImageSlot` placeholders (`lib/images.ts`).
- Fluid motion: use the shared `calm` spring and `Sheet` from `components/ui.tsx`. No hard cuts and no bounce.
- No horizontal scroll at 375px. Grid children need `min-w-0`.
- Base CSS goes in `@layer base` so Tailwind utilities win.

## Commands
```bash
npm run setup
npm run dev
npm run lint
npm run typecheck
npm run build
```

## Layout
- `apps/web/src/components/app.tsx`: shell, navigation, overlay routing, recovery nudge
- `apps/web/src/components/views/`: Today, Nourish, Move, Restore, Onboarding
- `apps/web/src/components/overlays/`: meal capture, squat tracker, recovery session, live voice, coach, settings
- `apps/web/src/lib/`: store, foods, plan, coach rules, recovery script, utils
- `apps/web/src/app/api/`: `status`, `meal`, `coach`, `live`
