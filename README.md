# Zeus

Zeus is an AI chat interface for talking to various AI models, served through
[OpenRouter](https://openrouter.ai).

## Getting started

Create `.env.local` with your OpenRouter API key:

```bash
OPENROUTER_API_KEY=sk-or-...
```

Then install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## What's included

- Black UI with cyan for the send button, links and selected states (no light theme)
- Streaming replies with stop, regenerate, edit & resend, copy and thumbs up/down
- "Thinking…" while a model reasons, then "Thought for 12s", which opens the model's reasoning
  when it shares it
- Web search: with Search on in the message box (the default), the model searches the web when a
  question needs current information, shows "Searching the web…" with the sites it finds, cites
  them inline, and lists them under Sources below the reply
- Real-time awareness: every reply knows today's date in the user's time zone and can check the
  exact time
- Markdown rendering with tables and syntax-highlighted code blocks
- Model and reasoning effort pickers next to the send button, with models from several providers
  (edit the list in `lib/models.ts`). The chosen effort carries across models; a model without
  that level uses its closest one
- Chats saved in the browser (localStorage), grouped by date, with rename, delete and search
- Collapsible sidebar on desktop, slide-out drawer on mobile
- Shortcuts: `⌘⇧O` new chat, `⌘K` search chats, `⌘⇧S` toggle sidebar (Ctrl on Windows/Linux)

## Project layout

```
app/                    Routes: / (new chat) and /c/[id] (a chat); both render ChatApp
components/chat-app.tsx Top-level layout, shortcuts, dialogs
components/chat/        Chat view, composer, messages, markdown, model and effort pickers, search
                        toggle and sources
components/sidebar/     Sidebar, chat list, account menu
components/ui/          Tooltip, menu, icon button and confirm dialog primitives
app/api/chat/route.ts   Server route that streams replies from OpenRouter (holds the API key)
app/api/chat/system-prompt.ts
                        Today's date and the search instructions sent to the model
lib/chat-api.ts         Browser side of that stream
lib/store.ts            Zustand store, persisted to localStorage
lib/actions.ts          Send, stop, regenerate, edit, rename, delete
lib/models.ts           Models shown in the picker and the reasoning efforts each supports
```

## How replies work

The browser posts `{ model, effort, webSearch, timeZone, messages }` to `/api/chat`. The route
checks the model is one of those in `lib/models.ts` and supports that effort, calls OpenRouter's
chat completions API with `stream: true` and `reasoning: { effort }`, and streams the reasoning
and the answer back as newline-delimited JSON (see `ChatStreamEvent` in `lib/types.ts`).
Stopping a reply closes the connection, which also cancels the generation at OpenRouter.

Before the chat, the route adds a system message with today's date in the user's time zone. It
also gives the model two of OpenRouter's [server tools](https://openrouter.ai/docs/guides/features/server-tools),
which OpenRouter runs when the model calls them: `openrouter:datetime` for the exact time and,
when Search is on, `openrouter:web_search`. The pages a search finds arrive as `url_citation`
annotations, which the route forwards as `sources` events. Every model in the picker has to
support tool calling.

Searches cost about a cent each on top of the model's tokens, which include the search results
it reads. A reply can search at most 5 times (`max_uses` in `serverTools` in the route).

`/api/chat` has no authentication yet, so anyone who can reach a deployed copy can spend your
OpenRouter credits, searches included. Add sign-in or rate limiting before deploying publicly.
