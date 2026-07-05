# Architecture

MelodyMarkets is a [Next.js](https://nextjs.org) App Router project written in TypeScript
and styled with Tailwind CSS. All application code lives under `src/`.

## Folder structure

### `src/app`

Route definitions using the Next.js App Router. Each folder maps to a URL segment, and
`page.tsx` inside a folder is the page rendered at that route (e.g. `src/app/markets/page.tsx`
renders `/markets`). `layout.tsx` at the root defines the shared HTML shell (fonts, global
navigation) that wraps every page, and `globals.css` holds the global stylesheet and design
tokens.

### `src/components/ui`

Small, reusable, presentation-only UI primitives that have no knowledge of routes or business
logic — things like `Button`, `Card`, and other building blocks that any page can compose
together. These should stay generic so they can be reused across unrelated features.

### `src/components/layout`

Structural "shell" components that define the app's chrome: the top navigation bar, the
logo/wordmark, and page wrappers. These components are aware of the site's routes and overall
layout, unlike the generic primitives in `components/ui`.

### `src/lib`

Framework-agnostic utilities, constants, and (in the future) API clients — for example, helper
functions, shared configuration like the navigation link list, and later on things like a
Supabase client or a Last.fm API wrapper. Nothing in here should render UI.

### `src/types`

Shared TypeScript types and interfaces used across multiple files, so features rely on a single
source of truth instead of redefining shapes inline.

## Design system

Colors, fonts, and border radii are defined once as Tailwind theme tokens in
`src/app/globals.css` (via the `@theme` block) rather than hard-coded in components. This keeps
the dark theme, accent gradient, and gain/loss colors consistent as new pages are added.

## What's intentionally not here yet

This foundation deliberately excludes a database, authentication, charts, and any trading
logic. Those will be layered on top of this structure in future work.
