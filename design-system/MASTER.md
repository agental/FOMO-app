# FOMO — Design System (MASTER)

Single source of truth for colours, typography, spacing, radius, and elevation.
Generated with the `design-system` + `ui-ux-pro-max` skills.

Tokens live in two mirrored places:
- **`src/index.css` `:root`** — CSS variables, for inline styles & raw CSS.
- **`tailwind.config.js`** — the same semantic values as Tailwind classes.

Architecture: **Primitive → Semantic → Component** (never use a raw hex in a component — reference a token).

## Colour

| Semantic token | CSS var | Tailwind class | Value |
|---|---|---|---|
| Primary (brand) | `--color-primary` | `bg-primary` `text-primary` | `#F97316` |
| Primary dark | `--color-primary-dark` | `bg-primary-dark` | `#EA580C` |
| Primary darker | `--color-primary-darker` | `bg-primary-darker` | `#C2410C` |
| Primary tint | `--color-primary-tint` | `bg-primary-tint` | `#FFF7ED` |
| Primary gradient | `--gradient-primary` | — | `135deg #F97316→#EA580C` |
| Surface (card) | `--color-surface` | `bg-surface` | `#FFFFFF` |
| App background | `--color-surface-app` | `bg-surface-app` | `#F8FAFB` |
| Dark surface (hero) | `--color-surface-dark` | `bg-surface-dark` | `#0C0C10` |
| Text | `--color-text` | `text-content` | `#0A122A` |
| Heading | `--color-text-heading` | `text-content-heading` | `#111827` |
| Secondary text | `--color-text-secondary` | `text-content-secondary` | `#374151` |
| Muted text (AA on white) | `--color-text-muted` | `text-content-muted` | `#6B7280` |
| Border | `--color-border` | `border-[#EBEBEB]` | `#EBEBEB` |
| Success / Danger / Warning | `--color-success/-danger/-warning` | `text-success` `bg-danger` `text-warning` | `#10B981 / #EF4444 / #F59E0B` |

> The brand is **orange** — never reintroduce teal/green as an accent (green is allowed only as the semantic *success* colour).

## Typography
- Headings: **Heebo** — `var(--font-heading)` / `font-heading`
- Body: **Rubik** — `var(--font-body)` / `font-body`
- Scale: 11 · 12 · 13 · 14 · 16(base) · 17 · 19 · 24 · 30
- Weights: heading 700–900, label 600–800, body 400–500

## Spacing (4/8 rhythm)
`--space-1..12` → 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 px

## Radius
`--radius-sm` 11 · `--radius-md` 16 · `--radius-lg` 22 · `--radius-pill` 9999

## Elevation
- `--shadow-card` — cards
- `--shadow-pop` — floating nav / popovers
- `--shadow-primary` — primary CTAs

## Component tokens (examples)
`--btn-primary-bg`, `--btn-primary-fg`, `--card-bg`, `--card-radius`, `--card-shadow`, `--nav-active`, `--nav-idle`

## How to use
```tsx
// Tailwind (preferred for new code)
<button className="bg-primary text-white rounded-[var(--radius-lg)]">…</button>
<p className="text-content-muted font-body">…</p>

// Inline style (existing pattern in this app)
<div style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }} />
```

## Migration (incremental)
Existing screens use raw hex inline styles. New/edited code should use tokens.
Migrate opportunistically — replace `#F97316`→`var(--color-primary)`, `#6B7280`→`var(--color-text-muted)`, etc. — when touching a file. No big-bang refactor required.
