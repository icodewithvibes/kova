# Kova — UI System

Original identity. Apple-quality principles (clarity, deference, depth, restraint) as inspiration only — no copied UI, assets, or brand elements from any company.

## 1. Color

Dark-only in v1. Base is **near-black graphite, not pure #000** — pure black kills elevation layering and causes OLED text halos; a near-black base keeps most of the OLED battery benefit while allowing surface lightening for depth.

### Core palette

| Token | Hex | Use |
|---|---|---|
| `bg/base` | `#0B0C0E` | App background (obsidian) |
| `bg/raised` | `#141519` | Cards, sheets (elevation 1) |
| `bg/raised-2` | `#1B1D22` | Modals, popovers (elevation 2) |
| `bg/raised-3` | `#22252B` | Menus, tooltips (elevation 3) |
| `stroke/subtle` | `#2A2D34` | Hairline borders, dividers |
| `text/primary` | `#E8EAED` | Primary text (not pure white — avoids vibration) |
| `text/secondary` | `#9BA0A8` | Labels, captions |
| `text/tertiary` | `#5F646D` | Disabled, placeholders |
| `accent/mint` | `#7FD4B4` | Primary accent: confirmed money, positive deltas, CTAs |
| `accent/mint-dim` | `#3E6B5B` | Accent fills, progress tracks |
| `accent/silver` | `#C5C9D1` | Metallic highlight: logo mark, premium moments, hairline gradients |
| `signal/attention` | `#D9B36C` | Warm amber: low-confidence fields, needs-review (never red-shaming) |
| `signal/error` | `#D98A80` | Muted terracotta: true errors only |

Rules: max **one accent per screen region**. Mint means "money is right." Amber means "look at this," never "you failed." No blue-pink gradients, no neon, no saturated fintech blue.

### Elevation

Depth via **surface lightening, not shadows** (shadows are near-invisible on dark). Each raised level lightens the surface one token step. Optional 1px `stroke/subtle` top border on cards for crispness.

## 2. Typography

- **UI type:** system stack (SF Pro on iOS, Roboto/system on Android) — fast, native feel, zero licensing risk. Weights: 400 / 500 / 600 only.
- **Numerals:** always **tabular lining figures** (`font-variant-numeric: tabular-nums`) for every money value — amounts must align and never jitter when updating.
- Scale (pt): Display 34, Title 28, Heading 22, Body 17, Caption 13, Micro 11. Line-height ≥ 1.3.
- Money display: dollars in 600 weight, cents in 400 at 70% size, currency symbol in `text/secondary`.
- Contrast: WCAG AA minimum — 4.5:1 body text, 3:1 large text/icons. All palette tokens above pass on their intended surfaces.

## 3. Spacing, shape, layout

- 4pt base grid; standard paddings 16 / 20 / 24.
- Corner radii: cards 20, buttons 14, inputs 12, sheets 28 top.
- One primary action per screen. Generous negative space — calm comes from restraint, not decoration.
- Bottom-tab navigation, 4 tabs: **Home · Paychecks · Goals · Space** (settings via profile).

## 4. Key screen patterns

### Paycheck review (the signature screen)
- Split view: paystub image (top, zoomable) / extracted fields (bottom sheet).
- Tapping a field highlights its source region on the image (bounding-box link) — industry HITL best practice.
- Confidence rendering: high-confidence fields render normally; below threshold (~90% for critical money fields) the field gets an amber underline + "verify" chip. **Never hide uncertainty.**
- One-tap edit; numeric keypad pre-opened for money fields; "Confirm paycheck" is the single primary CTA and is disabled until flagged fields are visited.
- Cross-field validation runs before confirm (gross − deductions ≈ net; pay date ≥ period end).

### Home
- Hero: current safe-to-spend figure (large tabular numerals) + days until next paycheck.
- Below: this-paycheck allocation bars (mint progress on `accent/mint-dim` tracks).

### Kova Space quick capture
- Opens from tab or lock-screen/long-press shortcut straight into an empty note, keyboard up, **< 1s cold**. Save is implicit. Organization happens later, never at capture time (the anti-Obsidian-mobile pattern).

### Empty states
- Quiet abstract mark + one sentence + one action. No cartoon illustrations.

## 5. Motion

- Purposeful and brief: 150–250ms, standard ease-out. Money value changes animate with a subtle count-up; never bouncy.
- Confidence chips fade in staggered (30ms) to draw the eye down the review list.
- Respect `prefers-reduced-motion`.

## 6. Voice & tone

Calm, precise, nonjudgmental. "3 fields need a quick look" — never "We couldn't read your document." "You're $40 over on dining" → "Dining used $40 from next paycheck's buffer." No exclamation marks in financial contexts.

## 7. Accessibility

- AA contrast throughout; amber/mint signals always paired with an icon or label (never color-only).
- Dynamic Type support up to accessibility sizes on money screens.
- All review-screen actions reachable by screen reader with field + confidence announced ("Net pay, $2,145.30, low confidence, double-tap to verify").
