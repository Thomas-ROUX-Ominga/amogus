# Product

## Register

brand

## Users

Three people, one party, all on their phones in a dimly lit space, attention split between a screen and the room around them.

- **Organizer / Admin** — sets up the game (creates a lobby, generates QR quests, distributes roles IRL), then monitors progress from a live dashboard. Often plays too. Needs fast setup and an at-a-glance overview, never a configuration maze.
- **Crewmate** — joins by link, scans a room's QR code, completes a short timed quest, returns home, repeats. Wants an instant validation loop so they can get back to watching the room. Operates under social pressure and divided attention.
- **Impostor** — joins the same way but sees a camouflage flow: scanning a quest shows only a generic success screen (no quest content, no duration) so they can fake being a crewmate without leaking information. Plays the IRL game (knife, sabotage, eliminations) with the app as cover.

Context of use: one-handed, thumb-driven, at night, mid-movement, under the adrenaline of a live game. The phone is a field tool, not a destination.

## Product Purpose

Amogus orchestrates an Among Us IRL event end to end: lobby creation, role-based join, QR-driven room quests, a camouflage flow for impostors, sabotage mechanics, meetings/eliminations, and an organizer tracker. It replaces the fragile ad-hoc setup (paper clues, separate apps, manual coordination) with one deployable, mobile-first companion.

Success is qualitative and reliability-driven: setup is near-instant, the scan→quest→success loop never breaks, and every role has a coherent, unambiguous experience. The app should feel invisible when idle and decisively responsive on contact. Built first for personal events, with a structure (quest pools, routes, roles, sabotages) that could later support a reusable or commercial version.

## Brand Personality

Three words: **tactical, immersive, premium.**

Voice is terse and confident — field-comms, not chatter. The interface is a cockpit/HUD: dark by default, high-contrast neon accents, sharp edges, instrument-panel typography (Orbitron/Rajdhani display, JetBrains Mono for data). Motion is fast and purposeful — it confirms, it never delays. Haptics and the camera flash deliberately bridge the screen and the physical room.

Emotional goal: convert the anxiety of Among Us into fluid, playful excitement. Discovery feels like joining an "augmented" experience; the role reveal sets the night's tone; each validated quest lands as a small, tangible victory; sabotage alerts inject urgency without confusion.

## Anti-references

- **Cartoonish Among Us clone** — no bean characters, no primary-color crewmate cosmetics, no kiddie/cartoon vibe. This is premium and tactical, not a toy.
- **Cluttered quiz/trivia app** — no dense menus, no ad-shaped surfaces, no settings sprawl, no long scrollable option lists. One decision per screen.
- **Corporate SaaS dashboard** — no cream/navy enterprise look, no hero-metric template, no tracked-uppercase eyebrow on every section. The organizer dashboard stays in the cockpit language, not B2B admin.

## Design Principles

1. **Radical simplicity under pressure.** Every extra tap is a risk during live play. One primary action per screen, large thumb targets, single-sentence instructions. Design for divided attention.
2. **The interface earns the moment, then disappears.** Idle = quiet and out of the way; on interaction = instant, explicit, satisfying. The scan→action→success beat is the emotional apex of the digital loop; everything else recedes around it.
3. **Material immersion.** Use the device — haptics for success/failure, flash for low-light scanning, motion that feels physical — to break the wall between screen and room. The phone is part of the IRL game, not a separate one.
4. **Atomic, trustworthy flow.** Quest→home and scan→success must be atomic and error-free. Stability is the brand; one flicker or dead-end breaks the spell of "this just works."
5. **Role-honest information design.** Each role sees exactly what its experience requires and nothing that would leak the game. The impostor camouflage flow must be visually indistinguishable from a real success.

## Accessibility & Inclusion

- **Night legibility first.** High contrast tuned for dark/low-light play; body text ≥4.5:1, large text ≥3:1 against the dark surfaces. Neon accents carry meaning, but never as the sole signal (pair color with icon/label).
- **Reduced motion.** Every animation needs a `prefers-reduced-motion` alternative (crossfade or instant). Motion must never gate content visibility — the scan/success loop must complete even with motion suppressed.
- **One-handed reach.** Interactive elements sit in the thumb zone; touch targets are generous to absorb movement and stress.
