---
version: alpha
name: Tiffany-Noir
description: "A minimalist black canvas (#000000 / #0a0a0a) with near-white ink and a single chromatic accent — Tiffany blue (#0ABAB5). Generous whitespace, hairline borders instead of shadows, and calm, purposeful motion: soft fade-and-rise reveals, smooth hover lifts, and a subtle Tiffany glow on focus. The accent is scarce — primary CTA, focus ring, links, active states. Everything else is black, gray and white."

colors:
  primary: "#0ABAB5"
  on-primary: "#000000"
  primary-hover: "#2fd3ce"
  primary-pressed: "#08938f"
  primary-soft: "rgba(10, 186, 181, 0.12)"
  primary-glow: "rgba(10, 186, 181, 0.35)"
  ink: "#f5f5f5"
  ink-muted: "#b3b3b3"
  ink-subtle: "#808080"
  ink-tertiary: "#595959"
  canvas: "#000000"
  surface-1: "#0a0a0a"
  surface-2: "#121212"
  surface-3: "#1a1a1a"
  hairline: "#1f1f1f"
  hairline-strong: "#2e2e2e"
  inverse-canvas: "#ffffff"
  inverse-ink: "#000000"
  semantic-success: "#0ABAB5"
  semantic-error: "#ff5c5c"
  semantic-warning: "#f5b942"
  semantic-overlay: "rgba(0, 0, 0, 0.7)"

typography:
  display-xl:
    fontFamily: Inter
    fontSize: 72px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -2.5px
  display-lg:
    fontFamily: Inter
    fontSize: 52px
    fontWeight: 600
    lineHeight: 1.10
    letterSpacing: -1.6px
  display-md:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.9px
  headline:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.20
    letterSpacing: -0.5px
  card-title:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.30
    letterSpacing: -0.3px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.60
    letterSpacing: -0.1px
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.60
    letterSpacing: 0
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.40
    letterSpacing: 0.1px
  button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.20
    letterSpacing: 0
  eyebrow:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.30
    letterSpacing: 1.2px
  mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0

rounded:
  sm: 6px
  md: 10px
  lg: 14px
  xl: 20px
  pill: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 64px
  section: 128px

motion:
  duration-fast: 150ms
  duration-base: 250ms
  duration-slow: 450ms
  duration-reveal: 700ms
  ease-out: "cubic-bezier(0.16, 1, 0.3, 1)"
  ease-in-out: "cubic-bezier(0.65, 0, 0.35, 1)"
  ease-spring: "cubic-bezier(0.34, 1.56, 0.64, 1)"
  reveal-distance: 16px
  stagger: 60ms
  hover-lift: -2px
  press-scale: 0.97

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 10px 18px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 10px 18px
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 10px 18px
  card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 28px
  card-featured:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 28px
  text-input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 10px 14px
  badge:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  top-nav:
    backgroundColor: "rgba(0, 0, 0, 0.6)"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    height: 64px
  footer:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.caption}"
    padding: 64px 32px
---

## Overview

Tiffany Noir is a minimalist dark system. The page is black (`{colors.canvas}` #000000), content sits on barely-lifted charcoal surfaces (`{colors.surface-1}` → `{colors.surface-3}`), and borders are 1px hairlines. There is exactly one color: **Tiffany blue** `{colors.primary}` #0ABAB5. It marks what is interactive or important — never decoration.

Motion is part of the identity: elements arrive with a soft fade-and-rise, hover states lift gently, and focus glows in Tiffany. Animation is smooth and calm, never bouncy or flashy.

**Key Characteristics:**
- Pure black canvas + near-white ink (`{colors.ink}` #f5f5f5) — high contrast, lots of air.
- One accent: Tiffany `{colors.primary}`. Text on Tiffany is **black** (`{colors.on-primary}`) — white on #0ABAB5 fails contrast.
- Hierarchy via surface lift + hairlines, not shadows.
- Display type with negative tracking; body is calm and roomy (line-height 1.6).
- Purposeful motion on every interaction, always respecting `prefers-reduced-motion`.

## Colors

### Accent
- **Tiffany** ({colors.primary}): primary CTA, links, focus ring, active nav item, selected states, progress.
- **Tiffany Hover** ({colors.primary-hover}): hovered primary CTA / link.
- **Tiffany Pressed** ({colors.primary-pressed}): pressed primary CTA.
- **Tiffany Soft** ({colors.primary-soft}): badge fills, selected-row tint.
- **Tiffany Glow** ({colors.primary-glow}): focus ring and hover glow on primary CTA.

### Surface
- **Canvas** ({colors.canvas}): page background.
- **Surface 1–3**: cards, inputs, dropdowns, modals — each step one level higher.
- **Hairline / Hairline Strong**: 1px borders; strong on hover and inputs.

### Text
- **Ink** ({colors.ink}): headlines and body.
- **Ink Muted** ({colors.ink-muted}): secondary text, descriptions.
- **Ink Subtle** ({colors.ink-subtle}): meta, footer, placeholders.
- **Ink Tertiary** ({colors.ink-tertiary}): disabled.

### Semantic
- Success reuses Tiffany. Error `{colors.semantic-error}`, warning `{colors.semantic-warning}` — only in forms/status, never on marketing chrome.

## Typography

- **Inter** (Google Fonts) for everything; weights 400 / 500 / 600 only.
- **JetBrains Mono** for code and numeric tokens.
- Display tracking negative (-2.5px at 72px); eyebrow is uppercase with +1.2px tracking, color `{colors.primary}` or `{colors.ink-subtle}`.

| Token | Size | Weight | Use |
|---|---|---|---|
| `display-xl` | 72px | 600 | Hero headline |
| `display-lg` | 52px | 600 | Section headline |
| `display-md` | 36px | 600 | Sub-section |
| `headline` | 26px | 600 | CTA banner, modal title |
| `card-title` | 20px | 500 | Card titles |
| `body-lg` | 18px | 400 | Lead paragraph |
| `body` | 16px | 400 | Default |
| `body-sm` | 14px | 400 | Card body, nav |
| `caption` | 12px | 400 | Meta |
| `button` | 14px | 500 | Buttons |
| `eyebrow` | 12px | 500 | Section label, UPPERCASE |

## Layout

- Base unit 4px. Max content width 1200px, side gutter 24px (16px on mobile).
- Sections separated by `{spacing.section}` 128px (64px on mobile) — whitespace is the main design element.
- Card grids: 3-up desktop → 2-up tablet → 1-up mobile, gap 24px.
- Centered hero with one headline, one sentence, max two buttons.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 | Nothing | Text on canvas |
| 1 | `{colors.surface-1}` + 1px `{colors.hairline}` | Cards, inputs |
| 2 | `{colors.surface-2}` + 1px `{colors.hairline-strong}` | Hovered / featured cards, dropdowns |
| Focus | `0 0 0 3px {colors.primary-glow}` | Focused inputs and buttons |

No drop shadows on dark. The only "light" in the system is the Tiffany glow.

## Motion

Motion makes the interface feel alive but never gets in the way.

### Tokens
- Durations: fast 150ms (color, opacity), base 250ms (hover, lift), slow 450ms (modals, panels), reveal 700ms (scroll reveal).
- Easing: `{motion.ease-out}` for anything entering or reacting; `{motion.ease-in-out}` for moving between states; `{motion.ease-spring}` only for small toggles/checkmarks.

### Patterns
- **Scroll reveal**: opacity 0 → 1 and translateY 16px → 0, 700ms ease-out, triggered once via IntersectionObserver. Children stagger by 60ms.
- **Hero entrance**: headline, subline and buttons fade-and-rise in sequence (stagger 80ms) on load.
- **Button hover**: background → hover color (150ms) + translateY(-2px) + soft Tiffany glow `0 8px 24px -8px {colors.primary-glow}` on primary.
- **Button press**: scale(0.97), 100ms.
- **Card hover**: border → Tiffany at 45%, background → faint Tiffany diagonal tint over `{colors.surface-2}`, soft glow `0 12px 40px -16px {colors.primary-glow}`, translateY(-4px), 250ms.
- **Primary button shine**: a white highlight sweeps across on hover (600ms).
- **Hero atmosphere** (night touge): drifting tire-smoke blobs (blurred Tiffany radials, 18–30s alternate loop), perspective telemetry grid "road" scrolling toward viewer, film grain, headlight streaks, outlined kanji ドリフト, gradient-shine on the accent word, angle gauge with needle sweep + gentle sway.
- **Ticker**: skewed broadcast-style marquee strip under the hero (mono, uppercase, Tiffany).
- **Live dot**: pulsing Tiffany ring for live/active status chips.
- **Links**: Tiffany underline grows from left (scaleX 0 → 1, 250ms ease-out).
- **Focus**: Tiffany ring fades in over 150ms.
- **Modals/dropdowns**: fade + scale 0.96 → 1, 250ms ease-out; backdrop fades to `{colors.semantic-overlay}`.
- **Nav**: sticky, transparent at top; gains blur (`backdrop-filter: blur(12px)`) and bottom hairline after scroll.

### Rules
- Animate only `transform` and `opacity` (and colors) — never width/height/top/left.
- Looping ambient motion is allowed only in the hero, the ticker and live indicators — slow, low-contrast, never behind body text or data tables. No parallax overload, no bounce on large elements.
- Always honour reduced motion:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
  ```

## Shapes

| Token | Value | Use |
|---|---|---|
| `sm` | 6px | Tags, small chips |
| `md` | 10px | Buttons, inputs |
| `lg` | 14px | Cards |
| `xl` | 20px | Modals, large panels |
| `pill` | 9999px | Badges, toggles, avatars |

## Components

- **`button-primary`** — Tiffany fill, black text, rounded md, 10px 18px. Hover/pressed per tokens + motion patterns above.
- **`button-secondary`** — surface-1 fill, ink text, 1px hairline border.
- **`button-ghost`** — transparent, ink-muted text; hover → ink text + surface-1 fill.
- **`card` / `card-featured`** — surface-1 / surface-2, rounded lg, 28px padding, hairline border. Featured card may carry a 1px Tiffany top border.
- **`text-input`** — surface-1, hairline border; focus → Tiffany border + glow ring. Placeholder in ink-subtle.
- **`badge`** — Tiffany-soft fill, Tiffany text, pill.
- **`top-nav`** — 64px sticky, logo left, links center (ink-muted, active = ink with Tiffany dot/underline), primary CTA right.
- **`footer`** — black, ink-subtle links, hairline top border.

## Do's and Don'ts

### Do
- Keep Tiffany scarce: CTA, links, focus, active state.
- Put black text on Tiffany.
- Use whitespace generously; one idea per section.
- Make every interactive element respond (hover, press, focus) with the motion tokens.
- Keep contrast AA: body text ≥ 4.5:1 on its surface.

### Don't
- Don't use a second accent color.
- Don't fill sections or large areas with Tiffany.
- Don't use gradients outside atmosphere (hero, ticker, card hover tint, accent word); no heavy shadows; glass blur only on nav and chips.
- Don't put white text on Tiffany.
- Don't animate layout properties or ignore `prefers-reduced-motion`.
- Don't ship a light theme unless asked.

## Responsive Behavior

| Name | Width | Changes |
|---|---|---|
| Desktop | ≥1200px | Full layout |
| Tablet | 768–1199px | Grids 3-up → 2-up |
| Mobile | <768px | 1-up, nav → burger, display-xl 72px → 40px, section spacing 64px |

- Touch targets ≥ 44px.
- No horizontal scroll at 320px width.

## Iteration Guide

1. Reference components by token name (`button-primary`, `card`).
2. Decide the surface level first, then add the accent only if the element is interactive or key.
3. Add motion from the Motion patterns — don't invent new easings.
4. Run `npx @google/design.md lint DESIGN.md` after edits.
