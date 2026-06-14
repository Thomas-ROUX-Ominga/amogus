---
name: amogus
description: A mobile-first cockpit HUD for running Among Us IRL — dark, neon-blue, instrument-panel.
colors:
  hologram-blue: "#58A6FF"
  signal-blue-deep: "#1F6FEB"
  cabin-black: "#0D1117"
  panel-graphite: "#21262D"
  hull-line: "#30363D"
  readout-white: "#F0F6FC"
  instrument-grey: "#8B949E"
  secondary-ink: "#C9D1D9"
  crewmate-green: "#2DA44E"
  impostor-red: "#DA3633"
  alert-red: "#F85149"
  caution-amber: "#D29922"
typography:
  display:
    fontFamily: "Orbitron, var(--font-geist-mono), monospace"
    fontSize: "clamp(1.75rem, 6vw, 3.75rem)"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "0.06em"
  headline:
    fontFamily: "Orbitron, var(--font-geist-mono), monospace"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.3em"
  title:
    fontFamily: "Orbitron, var(--font-geist-mono), monospace"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.1em"
  body:
    fontFamily: "var(--font-jetbrains-mono), var(--font-geist-mono), monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Rajdhani, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.1em"
rounded:
  none: "0px"
  pill: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  touch: "44px"
components:
  button-primary:
    backgroundColor: "{colors.hologram-blue}"
    textColor: "{colors.cabin-black}"
    rounded: "{rounded.none}"
    padding: "16px 32px"
  button-primary-hover:
    backgroundColor: "{colors.cabin-black}"
    textColor: "{colors.hologram-blue}"
  scan-button:
    backgroundColor: "{colors.cabin-black}"
    textColor: "{colors.hologram-blue}"
    rounded: "{rounded.none}"
    padding: "24px"
    height: "120px"
  buzzer-button:
    backgroundColor: "{colors.alert-red}"
    textColor: "{colors.impostor-red}"
    rounded: "{rounded.none}"
    padding: "6px 12px"
  input-field:
    backgroundColor: "{colors.cabin-black}"
    textColor: "{colors.readout-white}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
    height: "48px"
  role-badge:
    backgroundColor: "{colors.cabin-black}"
    textColor: "{colors.readout-white}"
    rounded: "{rounded.none}"
    padding: "32px"
---

# Design System: amogus

## 1. Overview

**Creative North Star: "The Spaceship Cockpit"**

Every screen is an instrument panel held in one hand, at night, mid-game. The cabin is dark and the readouts glow; the player glances down, acts, and looks back up at the room. The interface is hardware: flat metal panels with hairline seams, characters etched in Orbitron, indicator lights in Hologram Blue. Nothing is rounded, nothing is soft. Depth comes from light, not from drop shadows — a control is "raised" because it is lit, the way a real backlit switch sits proud of an unlit one. Motion is electrical: elements pulse while armed, snap on contact, and fire a haptic the instant they register.

This system is tuned for divided attention under social pressure. One decision per screen, thumb-sized targets, single-sentence instructions, and feedback that is impossible to misread. The scan→action→success loop is the emotional apex of the digital layer; the rest of the UI recedes around it so that beat can land. Role identity is carried by light: crewmate green and impostor red are signal colors, never decoration, and the impostor's camouflage flow is visually indistinguishable from a real crewmate success.

It explicitly rejects three things. It is **not a cartoonish Among Us clone** — no bean characters, no primary-color crewmate cosmetics, no toy. It is **not a cluttered quiz app** — no dense menus, no option-list walls, no settings sprawl. And the organizer dashboard is **not a corporate SaaS admin** — no cream-and-navy, no hero-metric template, no tracked-uppercase eyebrow over every block. The dashboard speaks the same cockpit language as the game.

**Key Characteristics:**
- Dark cabin (`#0D1117`) by default; `color-scheme: dark`, no light mode.
- Zero corner radius. Sharp panels everywhere; pills reserved for dots and tags.
- Depth via neon glow and tonal fills, not drop shadows.
- Orbitron display / Rajdhani labels / JetBrains Mono body — three voices, one machine.
- Color is signal: blue = active, green = crewmate, red = impostor/sabotage, amber = caution.
- Charged motion: armed states pulse, contact snaps, haptics confirm.

## 2. Colors

A near-black cabin lit by a single neon-blue instrument light, with green/red/amber reserved strictly as game and status signals.

### Primary
- **Hologram Blue** (`#58A6FF`): The color of every active interface light — scan button, focus rings, links, armed controls, the scan beam, primary CTAs. Reads as a glowing projected readout. This is the one ambient accent; everything else is signal or neutral.
- **Signal Blue Deep** (`#1F6FEB`): Pressed/active depth for blue surfaces and the `accent` token. Used where Hologram Blue needs a darker seated state.

### Secondary (status signals — used only to mean something)
- **Crewmate Green** (`#2DA44E`): Role identity for crewmates; quest success state; the `success` token. Never decorative.
- **Impostor Red** (`#DA3633`): Role identity for impostors; the camouflage success heading; danger framing. Distinct from the system alert red.
- **Alert Red** (`#F85149`): The `destructive`/error token and buzzer/report surfaces. Errors and irreversible actions only.
- **Caution Amber** (`#D29922`): The `warning` token. Reserved for timed and at-risk states.

### Neutral
- **Cabin Black** (`#0D1117`): The body, card, and popover background — one continuous dark hull. Also the ink that sits *on* Hologram Blue (primary button text).
- **Panel Graphite** (`#21262D`): Raised neutral surfaces — `secondary` and `muted` fills, quiet chips, inactive controls.
- **Hull Line** (`#30363D`): Borders, inputs, and dividers — the hairline seams between panels.
- **Readout White** (`#F0F6FC`): Primary text and high-emphasis foreground.
- **Secondary Ink** (`#C9D1D9`): Secondary text on dark surfaces.
- **Instrument Grey** (`#8B949E`): Muted/auxiliary text. The floor for body text — never go lighter for prose, or night legibility breaks.

### Named Rules
**The One Light Rule.** Hologram Blue is the only ambient accent. Green, red, and amber are signals: they appear because the game state or a status demands them, never to "add color." If a screen has two competing accents and neither is a live signal, one is wrong.

**The Camouflage Parity Rule.** The impostor success flow must be pixel-identical in structure to the crewmate flow. The only sanctioned difference is the signal color (red vs green) and the haptic/glitch character — never layout, never copy length, never information.

## 3. Typography

**Display Font:** Orbitron (with Geist Mono, monospace fallback)
**Body Font:** JetBrains Mono (with Geist Mono, monospace fallback) — `font-mono` is the document default
**Label Font:** Rajdhani (with sans-serif fallback)

**Character:** Orbitron is the etched, wide-tracked panel lettering — it shouts role and status like silkscreen on hardware. JetBrains Mono is the telemetry readout: even, legible, technical. Rajdhani is the condensed switch-label that fits a lot of uppercase into a small lit strip. The pairing is one machine speaking in three registers, not three competing typefaces.

### Hierarchy
- **Display** (Orbitron 900, `clamp(1.75rem, 6vw, 3.75rem)`, lh 1.05, tracking 0.06em, uppercase): Role reveals, overlay verdicts ("MISSION ACCOMPLISHED"), screen identity. The loudest voice; one per screen.
- **Headline** (Orbitron 700, ~1.25rem, tracking 0.3em, uppercase): The signature wide-tracked control label — the scan button word, primary section banners.
- **Title** (Orbitron 700, ~1rem, tracking 0.1em, uppercase): Card and panel headers.
- **Body** (JetBrains Mono 400, 1rem, lh 1.5): Quest prompts, instructions, telemetry. Keep to single sentences where possible; cap prose at 65–75ch.
- **Label** (Rajdhani 700, 0.75rem, tracking 0.1em, uppercase): Hints, badges, buzzer/action labels, field captions. Short strings only (≤4 words).

### Named Rules
**The Etched-Label Rule.** Uppercase + wide tracking belongs to Orbitron/Rajdhani labels and headings only. Never set body sentences in all-caps; below ~14px, all-caps prose is unreadable in the dark.

**The Three-Voice Ceiling.** Display = Orbitron, body = JetBrains Mono, labels = Rajdhani. No fourth family. Geist Mono exists only as the system fallback.

## 4. Elevation

This system is **flat with luminous depth**. Surfaces share one background (`#0D1117`) and corner radius zero, so they never separate by shadow or rounding. Hierarchy comes from **light**: a neon glow (`box-shadow: 0 0 Npx rgb(var(--primary-rgb)/α)`) marks an element as active or armed; tonal fills (`bg-primary/5` → `bg-primary/20`) and hairline borders mark it as raised; backdrop blur lifts overlays above the cabin. Conventional soft grey drop shadows are absent by design — a panel looks proud because it is lit, not because it casts a shadow.

### Shadow Vocabulary
- **Ambient glow** (`box-shadow: 0 0 50px rgb(var(--primary-rgb)/0.05)`): The faint blue cabin haze under large primary surfaces. Atmospheric only.
- **Active halo** (`box-shadow: 0 0 20px rgb(var(--primary-rgb)/0.25)`): An armed/focused control's blue corona. The default "this is live" cue.
- **Signal glow** (`box-shadow: 0 0 28px rgba(239,68,68,0.22)` / green equivalents): Sabotage and success halos. Color = state, intensity = urgency.
- **Overlay lift** (`backdrop-blur-sm` + `bg-black/90` or `bg-red-900/40`): Full-screen verdict overlays floating above the game.

### Named Rules
**The Light-Not-Shadow Rule.** Depth is conveyed with glow, tonal fill, and hairline borders — never a soft grey drop shadow. If an element needs to feel raised, light it; do not float it.

**The Glow-Means-Live Rule.** A blue halo signals an interactive, armed, or focused element. Don't apply glow to static decoration; in this cockpit, light is a status, not a style.

## 5. Components

Components feel **charged and responsive**: they glow while armed, snap on contact, and fire a haptic the instant they register. Every interactive element carries a vibration pattern (short `[50]` for success, long `[200]` for blocked) so the screen reaches into the room.

### Buttons
- **Shape:** Sharp, zero radius (`0px`). 2px borders are standard; full-pill only for tags.
- **Primary:** Hologram Blue fill, Cabin Black text, 2px Hologram Blue border, Orbitron/mono bold, uppercase, wide tracking, padding ~`16px 32px`. Hover **inverts**: transparent fill, blue text, blue border. A loading state emits an expanding blue ping ring.
- **Scan button (signature):** Full-width panel, `min-height: 120px`, 2px Hologram Blue border, `bg-primary/10`, Orbitron uppercase label at 0.3em tracking, Scan icon. Armed state breathes (`scale 1 → 1.02 → 1`, 2s). Comms-sabotaged variant swaps to a red gradient fill + red sweep animation; death-waiting variant goes graphite/slate. Respects `prefers-reduced-motion` (no pulse).
- **Buzzer / report (alert):** Compact red control — `border-red-500/50`, `bg-red-500/15`, Rajdhani uppercase, `min-height: 32px`. Hover intensifies the red fill. Used only for buzz/report-body.
- **Disabled:** Global rule — `opacity: 0.38`, desaturated, no shadow, no transform, `cursor: not-allowed`.

### Inputs / Fields
- **Style:** Cabin-black translucent fill (`bg-black/50`) with `backdrop-blur-sm`, 2px border at `border-primary/20`, zero radius, Rajdhani or mono text, `min-height: 48px`.
- **Focus:** Border brightens to Hologram Blue plus a `ring-2 ring-primary/35` halo and a faint blue fill tint. No native outline.
- **Steppers (numeric):** Native spinners stripped; custom blue +/- column with hairline blue dividers, `min-height: 44px` targets.

### Badges / Role Identity
- **Role badge:** Bordered panel (`border-primary/20`, `bg-primary/5`), zero radius, Orbitron uppercase, icon + label both inked in the role's signal color (green/red). Compact variant is icon + small Orbitron caption.

### Cards / Containers
- **Corner Style:** Zero radius. Panels, not cards.
- **Background:** Cabin Black, optionally with a low tonal tint (`bg-primary/5`) to read as raised.
- **Depth Strategy:** Hairline border (`#30363D`) + optional ambient glow. Never a grey drop shadow. Never nest a panel inside a panel.
- **Internal Padding:** Generous — `24px`–`32px` on feature panels.

### Overlays (signature)
- Full-screen, `backdrop-blur-sm`, Orbitron verdict heading. Crewmate success: green on `bg-black/90` with a clean glow; impostor success: red on `bg-red-900/40` with CRT-glitch (RGB-split text-shadow, hue-rotate jitter, scanline flash). Auto-dismisses (~2s) back to the cockpit; a manual "RETURN TO COCKPIT" exit is available. Reduced-motion collapses to a plain crossfade.

### Navigation
- Minimal global top header in the cockpit language; the app is flow-driven (scan → quest → home), not menu-driven. No persistent nav chrome competing with the game.

## 6. Do's and Don'ts

### Do:
- **Do** keep the cabin dark: `#0D1117` background, `color-scheme: dark`, Readout White text. There is no light mode.
- **Do** keep every corner sharp (`--radius: 0`). Pills (`9999px`) are allowed only for tags, dots, and ping rings.
- **Do** convey depth with glow, tonal fills, and hairline borders. Light the element; don't shadow it.
- **Do** reserve green/red/amber for real game and status signals, and keep Hologram Blue as the single ambient accent (The One Light Rule).
- **Do** pair every interaction with a haptic and an instant visual confirmation; armed controls should pulse, contact should snap.
- **Do** give touch targets ≥44px and keep one primary action per screen for one-handed, divided-attention play.
- **Do** provide a `prefers-reduced-motion` path for every animation (crossfade or instant); the scan→success loop must complete with motion suppressed.
- **Do** keep crewmate and impostor success flows structurally identical (The Camouflage Parity Rule).
- **Do** keep body text at Instrument Grey or brighter; verify ≥4.5:1 on the dark cabin (≥3:1 for large Orbitron).

### Don't:
- **Don't** make it a **cartoonish Among Us clone**: no bean characters, no primary-color crewmate cosmetics, no toy-like rounding or bounce.
- **Don't** let it become a **cluttered quiz app**: no dense menus, no long scrollable option walls, no settings sprawl, no ad-shaped surfaces.
- **Don't** dress the organizer dashboard as a **corporate SaaS admin**: no cream/navy, no hero-metric stat template, no tracked-uppercase eyebrow over every section.
- **Don't** use soft grey drop shadows or `border-radius ≥ 12px` on panels; both break the cockpit instantly.
- **Don't** set body sentences in all-caps; uppercase is for Orbitron/Rajdhani labels and headings only.
- **Don't** add a fourth font family. Orbitron + JetBrains Mono + Rajdhani, full stop.
- **Don't** leak quest information into the impostor flow; the camouflage success must reveal nothing a crewmate success wouldn't.
- **Don't** drop body text below Instrument Grey (`#8B949E`) "for elegance" — night legibility is the brand.
