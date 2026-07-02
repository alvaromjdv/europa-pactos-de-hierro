# UI Redesign Plan

## Reference Read

The user provided two visual directions:

- Premium game table: a cinematic dark room, centered play area, strong glow accents, big readable buttons, visible player identity, and a bottom action dock. I will borrow the hierarchy, lighting feel, and table-like focus, not the characters, logo, art, or protected assets.
- Risk-like world board: a bright readable map, bold faction colors, circular troop counters, visible routes, player rail, and simple turn state. I will adapt the clarity and board-game language to the existing Europe map, not copy the exact Risk layout, branding, or map assets.

## Proposed Layout

- Start screen:
  - Large game title and short one-line objective.
  - Three primary actions: `Crear partida`, `Unirse con codigo`, and `Como jugar`.
  - Clear settings block for quick/standard duration, number of players, and capital target.
  - Short Risk-like flow preview: refuerza, ataca, fortifica, termina turno.

- Tutorial modal:
  - 60-second onboarding with four steps.
  - Explains what to click, the objective, and what each phase allows.
  - Uses concise tactical language instead of lore-heavy copy.

- Game screen:
  - Full viewport war table.
  - Top HUD with match code, active player, phase, turn, objective, and sync status.
  - Left rail for the turn sequence.
  - Center map as the visual priority.
  - Right command panel for selected territories, actions, cards, and battle log.
  - The existing victory modal stays, but is styled as an end-of-campaign result panel.

## Palette

- Background: near-black brown and charcoal for the premium war-room feel.
- Board: parchment tan and muted ocean blue, inspired by classic strategy boards.
- Factions: blue, red, gold, green, violet, orange with high contrast.
- Actions: green for reinforce/ready, blue for movement, red for attack, amber for fortify.
- Disabled states remain visibly disabled, not merely low contrast.

## Typography

- Title: Georgia-style serif to evoke a physical strategy board.
- UI: system sans-serif for readability.
- No negative letter spacing and no viewport-scaled body text.

## Components

- Lobby hero panel.
- `Como jugar` modal.
- Phase rail with numbered steps.
- Map frame with stable canvas dimensions.
- Faction-colored troop counters.
- Territory cards for origin/destination.
- Action card with one obvious primary action and one obvious phase-advance button.
- Sync/error status chips.
- Battle report and compact log.

## Visual Hierarchy

1. Map and phase state.
2. Current action.
3. Selected origin/destination.
4. Objective and player resources.
5. Cards/log as secondary support.

## Gameplay Flow

The core logic currently has four phases: production, movement, battle, consolidation. To avoid destabilizing validated logic, the UI will translate this into a Risk-like flow:

1. Refuerza: add troops.
2. Maniobra: optional repositioning.
3. Ataca: attack adjacent enemies.
4. Fortifica: lock down a key position and pass the turn.

This preserves existing tests and server validation while making the player-facing language simpler.

## Differences From Current UI

- The start screen will explain how to start and how to win before a player creates a match.
- Hover will no longer trigger destructive or heavy canvas redraws.
- Important actions will require clicks, not hover.
- The map will read more like a board game: troop disks, faction colors, capital rings, and clear connections.
- The right panel will be ordered by decision priority instead of technical state.

## UI Library Decision

The project uses React/Vite with plain CSS and no Tailwind setup. shadcn/ui would require adding Tailwind, Radix primitives, config files, and a design-system migration. That is too much risk for this stability pass. I will keep native React components and CSS, and only revisit shadcn if the project later adopts Tailwind intentionally.

## Validation Plan

- Run `npm run validate`.
- Run `npm run test:e2e`.
- Add a Playwright visual smoke script that stores screenshots under `artifacts/ui-review/`.
- Capture start screen, tutorial modal, live match board, and a victory modal visual fixture.
- Do not deploy this branch until the UI is accepted.
