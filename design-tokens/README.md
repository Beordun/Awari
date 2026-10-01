# Awari Design Tokens

This folder contains the complete design token specification and generated CSS variables for the Awari platform.

## Contents

- **`design-tokens.tokens.json`**: The single source of truth exported from Figma, containing:
  - Primitive key source colors (`primary`, `secondary`, `tertiary`, `neutral`, `neutral variant`, `warning`, `error`).
  - Full tonal palette steps (tones `0` through `100`).
  - Typography scales (`display`, `headline`, `title`, `body`, `label`).
  - Elevation shadow effects (`soft`, `medium`, `hard`).
- **`tokens.css`**: The generated CSS stylesheet containing custom properties (`--*`) and typography utility classes.

## Architecture: 2-Tier Color System

1. **Tier 1: Primitives (`--color-primitive-*`)**
   - Foundational raw colors and tonal palettes.
   - ⚠️ **Internal only**: Never reference primitive variables directly in UI markup or components.

2. **Tier 2: Semantic Color Rules (`--color-*`)**
   - Standard role-based variables (`--color-primary`, `--color-surface`, `--color-on-surface`, `--color-outline`, etc.).
   - Dynamically reference the primitive tones via `var(--color-primitive-...)`.
   - Automatically adapt between **Light Mode** (`:root`, `[data-theme="light"]`) and **Dark Mode** (`[data-theme="dark"]`, `@media (prefers-color-scheme: dark)`).
   - ✅ **Public contract**: Always style UI elements exclusively using these semantic variables.

## Regenerating CSS Tokens

Run the build script from the repository root whenever `design-tokens.tokens.json` is updated:

```bash
node build-tokens.js
```
