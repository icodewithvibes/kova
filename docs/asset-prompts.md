# Kova — Asset Prompts

All assets original. No copyrighted logos, product photos, likenesses, or trademarks. No neon gradients, blue-pink palettes, cartoon cash/coins/rockets, crypto imagery, or fake charts. Direction: obsidian-black + graphite base, metallic silver + muted mint highlights, premium/minimal/calm/intelligent.

**Format policy:** decorative raster assets → WebP (AVIF where supported); marks and icons → SVG wherever possible; every asset gets alt text; no decorative image where clean CSS/SVG/native UI does the job.

---

## 1. App icon explorations (generate 4–6 variants, pick 1)

**Prompt A — the facet:**
> Minimal app icon, a single abstract geometric "K" formed by two overlapping angular facets like cut obsidian stone, matte near-black background #0B0C0E, the facet edges catch a thin metallic silver light, one facet holds a barely-visible muted mint tint #7FD4B4, no text, no gradient washes, no glow, flat premium finish, centered, iOS app icon style, studio lighting, ultra minimal

**Prompt B — the seam:**
> Minimal dark app icon, matte graphite square, a single thin diagonal seam of light crossing it like a hairline crack in dark stone, the seam shifts from silver to muted mint, extremely restrained, premium, no text, no symbols, no neon

**Prompt C — the ingot:**
> Abstract minimal app icon, a small dark rounded monolith shape floating over a near-black background, soft top light giving one silver edge highlight, muted mint reflection beneath, calm and premium, sculptural, no text, no coins, no money symbols

**Alt text (final icon):** "Kova app icon: dark angular K mark with a silver edge and mint accent on near-black."

## 2. Final logo mark

> Vector-style minimal logotype mark, abstract geometric letter K constructed from three straight strokes of even weight, the middle stroke slightly separated to suggest a paycheck being split into planned parts, monochrome silver #C5C9D1 on transparent background, flat, no gradient, no bevel, works at 16px, timeless and premium

**Deliverables:** SVG master; monochrome silver, monochrome mint, and single-color black variants. Wordmark "kova" set lowercase in a geometric grotesque, tracked slightly wide, silver on dark.
**Alt text:** "Kova logo: a minimal geometric K mark."

## 3. Background textures (2–3, used sparingly)

**Prompt — obsidian grain:**
> Ultra-dark abstract background texture, matte volcanic obsidian surface photographed extremely close, subtle tonal variation between #0B0C0E and #141519, faint silver micro-highlights on stone grain, no visible objects, no light rays, calm and premium, seamless-tile friendly, very low contrast

**Prompt — graphite drift:**
> Very dark minimal abstract background, slow smooth graphite smoke barely visible against near-black, a single soft area of muted mint luminance in one lower corner at 5% opacity, matte, elegant, no neon, no particles, no stars

**Usage:** hero/onboarding only, exported WebP ≤ 150 KB at target resolution, never behind body text.
**Alt text:** decorative, `alt=""` with `role="presentation"`.

## 4. Goal-category placeholders (abstract, not illustrative)

One prompt template, swap the shape word (arch, stack, orbit, vessel, path, summit):

> Minimal abstract 3D form, a small matte dark {shape} with one polished silver edge and a faint mint inner glow, floating on near-black background, sculptural and calm, premium product-render style, no text, no money imagery, no cartoon style, centered, generous negative space

Categories → shapes: Savings=stack, Travel=path, Home=arch, Emergency=vessel, Debt payoff=summit, Custom=orbit.
**Alt text pattern:** "Abstract dark {shape} sculpture marking the {category} goal."

## 5. Empty-state illustrations (quiet, near-monochrome)

**No paychecks yet:**
> Tiny minimal spot illustration, a single folded sheet of dark paper with one silver edge, resting flat, near-black background, one small mint dot beside it, extreme restraint, premium, no characters, no clutter

**Empty Kova Space:**
> Tiny minimal spot illustration, an open dark notebook rendered as two simple graphite planes with a faint silver spine line, near-black background, calm, abstract, no text, no pencils, no clutter

**Alt text:** "An empty dark folder awaiting the first paycheck." / "An open dark notebook, ready for a first note."
**Note:** if these render busy, replace with pure SVG line marks (preferred).

## 6. Landing-page visuals

**Hero:**
> Wide cinematic dark hero image, a smooth obsidian-black landscape of faceted stone planes receding into darkness, a thin horizon line of silver light, one distant soft mint glow, no devices, no people, no text, premium and quiet, high resolution

**Feature-band texture:** reuse §3 textures.
**Device mockups:** screenshots composited into neutral generic device frames built in-house (no branded device imagery).
**Alt text (hero):** "Dark faceted stone landscape with a thin silver horizon and a distant mint glow."

## 7. Production checklist

- [ ] Convert raster exports to WebP/AVIF; cap decorative images (hero ≤ 300 KB, textures ≤ 150 KB, spots ≤ 40 KB)
- [ ] SVG for logo/icon marks; test icon legibility at 16/29/60 px
- [ ] Alt text recorded next to every asset in this file
- [ ] Contrast-check any text placed over textures (AA)
- [ ] Delete any generated asset that reads as stock-fintech; prefer CSS/SVG
