---
description: Apply the ui-ux-pro-max design & UX guidelines to a screen/component and implement the fixes
argument-hint: [screen or component, e.g. "מסך הבית" / "EventCard"]
---

Load the **ui-ux-pro-max** skill guidelines first:
- Read `C:\Users\LENOVO\.claude\skills\ui-ux-pro-max\SKILL.md` (the Quick Reference, "Common Rules for Professional UI", and the Pre-Delivery Checklist).
- If a specific palette/font/style decision is needed, also read the relevant CSV under `C:\Users\LENOVO\.claude\skills\ui-ux-pro-max\data\` (colors.csv, typography.csv, styles.csv, ux-guidelines.csv, stacks/react-native.csv).

Then apply them to: **$ARGUMENTS**

If `$ARGUMENTS` is empty, ask the user which screen/component to work on before proceeding.

Rules for this project (FOMO):
- Brand color is **orange** `#F97316` → `#EA580C` (defined in `tailwind.config.js`). Never introduce teal/green as an accent.
- Use **Lucide SVG icons**, never emoji as structural icons.
- Touch targets ≥ 44px, text contrast ≥ 4.5:1, press feedback on interactive elements, honor `prefers-reduced-motion`.
- Match existing style: Tailwind + `brand-*` tokens, Heebo/Rubik fonts, **RTL** (`dir="rtl"`).

Deliver: a short prioritized list of concrete improvements, then implement the high-confidence ones, and finish by running `npm run typecheck` to confirm the touched files are clean.
