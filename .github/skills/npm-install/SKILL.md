---
name: npm-install
description: "Use when you need to install or refresh npm dependencies, verify the Vite React TypeScript project setup, and resolve common install issues."
---

# npm install

This skill guides the agent through installing project dependencies and validating the workspace after a fresh checkout or dependency update.

Use when:
- the user asks for `npm install`
- the repository needs dependency setup or repair
- you want a repeatable install/checklist workflow for this workspace

## Workflow

1. Confirm the repository root contains `package.json` and the expected lockfile.
2. Run `npm install` from the workspace root where `package.json` lives.
3. If the install fails:
   - inspect the error message
   - delete `node_modules` and retry
   - optionally delete and regenerate `package-lock.json` if lockfile corruption is suspected
4. After a successful install, verify the setup by running one of these commands:
   - `npm run dev` (for local development startup)
   - `npm run build` (for production build verification)

## Validation

- Ensure dependencies are installed under `node_modules`
- Confirm there are no installation errors
- Recommend a follow-up check with `npm run dev` or `npm run build`
