<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Zeus

ChatGPT-style chat app for many models via OpenRouter: Next.js 16 App Router, React 19, Tailwind v4, Radix UI, Zustand. Chats are saved in the browser (localStorage); there is no database or auth.

## Commands

Use npm (`package-lock.json`).

- Dev server: `npm run dev` (http://localhost:3000). Only one can run per directory, so reuse a running one; its logs are in `.next/dev/logs/next-development.log`.
- Lint: `npm run lint`. `next build` does not lint.
- Typecheck: `npx next typegen && npx tsc --noEmit`. `typegen` creates the route types (`LayoutProps`, …) that a fresh checkout lacks.
- Build: `npm run build` (includes the typecheck). Safe to run while the dev server is up.

There are no tests. Before finishing, run lint, typecheck and build; for UI changes, also check the page in the dev server.

## How it fits together

- Both pages (`/`, `/c/[id]`) render `<ChatApp />`, which reads the chat id from the URL on the client. Switch chats with `navigate(chatHref(id))` from `lib/navigation.ts` (History API), not `router.push`.
- Change chat state only through `lib/actions.ts`; components read `useChatStore` with selectors.
- `lib/store.ts` loads saved chats after mount. Don't write to the store until `hydrated` is true, or the write overwrites the saved chats.
- For an incompatible change to persisted state (`Conversation`, `Message`, `modelId`), bump `version` in `lib/store.ts` and add a `migrate`. Bumping without `migrate` discards everyone's saved chats.
- `/api/chat` streams NDJSON `ChatStreamEvent`s (`lib/types.ts`) that `lib/chat-api.ts` parses; change both sides together.

## Rules

- `OPENROUTER_API_KEY` lives in `.env.local` and is read only by `app/api/chat/route.ts`. Never call OpenRouter from the browser, expose the key through a `NEXT_PUBLIC_` variable, or print `.env.local`.
- `/api/chat` accepts only the models in `lib/models.ts`. Their ids are OpenRouter slugs: check new ones against https://openrouter.ai/api/v1/models, not memory.
- `/api/chat` has no auth or rate limiting, so don't deploy publicly or add deploy config until it does.
- Model output is untrusted: keep raw HTML off in `components/chat/markdown.tsx` (no `rehype-raw`).
- The app must work over plain HTTP on a LAN IP: use `createId()` and `copyToClipboard()` from `lib/utils.ts`, not `crypto.randomUUID()` or `navigator.clipboard`.
- Every message sent in the dev app is a real, billed OpenRouter request. Keep test messages few and short.
- Work on a branch and open a PR into `main`; never push to `main`.

## UI

- Black theme only: no light mode or theme toggle.
- Tailwind v4: colors are `@theme` tokens in `app/globals.css` (`bg-surface`, `text-fg-muted`, `border-line`, …) and there is no `tailwind.config`. Add a token rather than a one-off hex value.
- Cyan (`accent`) is only for the send button, links, and selected and focus states; red only for errors and destructive actions.
- Reuse `components/ui/` (`IconButton`, `Tooltip`, `Menu`, `ConfirmDialog`). Import Radix from the unified `radix-ui` package, not `@radix-ui/react-*`.
