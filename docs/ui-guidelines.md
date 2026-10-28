# UI guidelines (keeping the app ready for a redesign)

The look of the app will be redone later. These rules keep that cheap.

1. **Colours live in one file.** `apps/web/src/app/globals.css` defines semantic tokens (`page`, `ink`, `muted`, `subtle`, `line`, `line-strong`, `raised`, `sunken`, `primary`, `on-primary`, `warning-*`, `danger`, `danger-line`) with their light and dark values. Components use only those names (`bg-primary text-on-primary`, `border-line`, `text-muted`). `design-tokens.test.ts` fails the build if a raw palette colour, `dark:` colour override or hex colour appears in a component. To add a colour, add a token.
2. **Logic is not presentation.** Rules, maths and data shaping live in `lib/` or in `*-logic.ts` next to a page, and have unit tests (see `order-panel-logic.ts`). Components call them and render the result. A component should not decide business rules.
3. **API routes are the only server interface.** Pages and components talk to `/api/...`; they do not import database code. A new front end can replace every component without touching the backend.
4. **Small components.** Prefer many small components over a long one. Keep spacing and type sizes as Tailwind scale classes, not one-off pixel values.
5. **Copy lives in data.** Names, taglines, FAQ and step text are in `lib/brand.ts`, not in JSX.

## Example: the design screen

`design/workspace.tsx` only lays out three panels. All state and server calls are in `design/use-workspace.ts` (a hook that renders nothing); `design-toolbar.tsx`, `chat-panel.tsx` and `part-panel.tsx` read what it returns. To redesign the screen, replace the panels; to change behaviour, change the hook.

The routes the screens call are listed in [api.md](api.md); a test keeps that list complete.
