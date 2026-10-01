#!/usr/bin/env node
/**
 * build-tokens.js
 *
 * Converts the Awari Design System from `design-tokens.tokens.json` to CSS variables.
 *
 * ARCHITECTURAL PRINCIPLES:
 * 1. Single Source of Truth: All primitive values, typography metrics, and elevation
 *    effects originate strictly from `design-tokens.tokens.json`.
 * 2. 2-Tier Color System Practice:
 *    - TIER 1 (Primitives): Raw tonal palettes and key colors (--color-primitive-*).
 *      These are internal variables and MUST NEVER be referenced directly in UI components.
 *    - TIER 2 (Semantic Color Rules): Standard role-based tokens (--color-*).
 *      These map directly to primitive tones (supporting Light & Dark modes) and are
 *      the ONLY colors to be consumed by UI markup and component stylesheets.
 */

const fs = require('fs');
const path = require('path');

/**
 * Standard tone indices used in Material 3 / Tonal Palette design systems.
 */
const STANDARD_TONES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98, 99, 100];

/**
 * Normalizes an 8-character hex string (#rrggbbaa) to 6-char hex when alpha is 0xFF,
 * or returns rgba(...) format if partially transparent.
 *
 * @param {string} hex - e.g. "#800080ff" or "#8000801f"
 * @returns {string} - Clean CSS color string
 */
function normalizeColor(hex) {
  if (!hex || typeof hex !== 'string') return hex;
  const clean = hex.trim().replace(/^#/, '');

  if (clean.length === 8) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const a = parseInt(clean.slice(6, 8), 16) / 255;

    if (a === 1) {
      return `#${clean.slice(0, 6)}`;
    }
    // Rounded alpha for clean CSS output
    const roundedAlpha = Math.round(a * 100) / 100;
    return `rgba(${r}, ${g}, ${b}, ${roundedAlpha})`;
  }

  return `#${clean}`;
}

/**
 * Extracts a numeric tone level from a Figma token shade name.
 * Handles Figma token export quirks and typos (e.g. "neutra130", "secondary" with no digits).
 *
 * @param {string} shadeKey - Token key name (e.g. "primary40", "neutra10", "secondary")
 * @param {number} fallbackTone - Fallback tone if no number found
 * @returns {number} - Extracted tone (e.g. 0, 10, 40, 100)
 */
function extractTone(shadeKey, fallbackTone = 0) {
  const match = shadeKey.match(/(100|99|98|95|90|80|70|60|50|40|30|20|10|0)$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return fallbackTone;
}

/**
 * Normalizes a palette name to kebab-case (e.g. "neutral variant" -> "neutral-variant").
 *
 * @param {string} name
 * @returns {string}
 */
function normalizeName(name) {
  return name.toLowerCase().trim().replace(/[\s_]+/g, '-');
}

/**
 * Standard Semantic Color System Rules
 *
 * Maps semantic UI roles to primitive tonal steps for both Light and Dark themes.
 * Components strictly use these roles:
 * - primary, on-primary, primary-container, on-primary-container
 * - secondary, on-secondary, secondary-container, on-secondary-container
 * - tertiary, on-tertiary, tertiary-container, on-tertiary-container
 * - error, on-error, error-container, on-error-container
 * - warning, on-warning, warning-container, on-warning-container
 * - background, on-background, surface, on-surface, surface-variant, on-surface-variant
 * - surface-dim, surface-bright, surface-container-lowest ... highest
 * - outline, outline-variant, inverse-surface, inverse-on-surface, inverse-primary
 */
const COLOR_RULES = {
  light: {
    // Primary Roles
    '--color-primary': 'var(--color-primitive-primary-40)',
    '--color-on-primary': 'var(--color-primitive-primary-100)',
    '--color-primary-container': 'var(--color-primitive-primary-90)',
    '--color-on-primary-container': 'var(--color-primitive-primary-10)',
    '--color-primary-fixed': 'var(--color-primitive-primary-90)',
    '--color-primary-fixed-dim': 'var(--color-primitive-primary-80)',
    '--color-on-primary-fixed': 'var(--color-primitive-primary-10)',
    '--color-on-primary-fixed-variant': 'var(--color-primitive-primary-30)',

    // Secondary Roles
    '--color-secondary': 'var(--color-primitive-secondary-40)',
    '--color-on-secondary': 'var(--color-primitive-secondary-100)',
    '--color-secondary-container': 'var(--color-primitive-secondary-90)',
    '--color-on-secondary-container': 'var(--color-primitive-secondary-10)',
    '--color-secondary-fixed': 'var(--color-primitive-secondary-90)',
    '--color-secondary-fixed-dim': 'var(--color-primitive-secondary-80)',
    '--color-on-secondary-fixed': 'var(--color-primitive-secondary-10)',
    '--color-on-secondary-fixed-variant': 'var(--color-primitive-secondary-30)',

    // Tertiary Roles
    '--color-tertiary': 'var(--color-primitive-tertiary-40)',
    '--color-on-tertiary': 'var(--color-primitive-tertiary-100)',
    '--color-tertiary-container': 'var(--color-primitive-tertiary-90)',
    '--color-on-tertiary-container': 'var(--color-primitive-tertiary-10)',
    '--color-tertiary-fixed': 'var(--color-primitive-tertiary-90)',
    '--color-tertiary-fixed-dim': 'var(--color-primitive-tertiary-80)',
    '--color-on-tertiary-fixed': 'var(--color-primitive-tertiary-10)',
    '--color-on-tertiary-fixed-variant': 'var(--color-primitive-tertiary-30)',

    // Error Roles
    '--color-error': 'var(--color-primitive-error-40)',
    '--color-on-error': 'var(--color-primitive-error-100)',
    '--color-error-container': 'var(--color-primitive-error-90)',
    '--color-on-error-container': 'var(--color-primitive-error-10)',

    // Warning Roles
    '--color-warning': 'var(--color-primitive-warning-40)',
    '--color-on-warning': 'var(--color-primitive-warning-100)',
    '--color-warning-container': 'var(--color-primitive-warning-90)',
    '--color-on-warning-container': 'var(--color-primitive-warning-10)',

    // Background & Surfaces
    '--color-background': 'var(--color-primitive-neutral-98)',
    '--color-on-background': 'var(--color-primitive-neutral-10)',
    '--color-surface': 'var(--color-primitive-neutral-98)',
    '--color-on-surface': 'var(--color-primitive-neutral-10)',
    '--color-surface-dim': 'var(--color-primitive-neutral-90)',
    '--color-surface-bright': 'var(--color-primitive-neutral-98)',
    '--color-surface-container-lowest': 'var(--color-primitive-neutral-100)',
    '--color-surface-container-low': 'var(--color-primitive-neutral-95)',
    '--color-surface-container': 'var(--color-primitive-neutral-90)',
    '--color-surface-container-high': 'var(--color-primitive-neutral-90)',
    '--color-surface-container-highest': 'var(--color-primitive-neutral-90)',
    '--color-surface-variant': 'var(--color-primitive-neutral-variant-90)',
    '--color-on-surface-variant': 'var(--color-primitive-neutral-variant-30)',

    // Outlines & Borders
    '--color-outline': 'var(--color-primitive-neutral-variant-50)',
    '--color-outline-variant': 'var(--color-primitive-neutral-variant-80)',

    // Inverses
    '--color-inverse-surface': 'var(--color-primitive-neutral-20)',
    '--color-inverse-on-surface': 'var(--color-primitive-neutral-95)',
    '--color-inverse-primary': 'var(--color-primitive-primary-80)',

    // Scrim / Shadow
    '--color-scrim': 'var(--color-primitive-neutral-0)',
    '--color-shadow': 'var(--color-primitive-neutral-0)',
  },

  dark: {
    // Primary Roles
    '--color-primary': 'var(--color-primitive-primary-80)',
    '--color-on-primary': 'var(--color-primitive-primary-20)',
    '--color-primary-container': 'var(--color-primitive-primary-30)',
    '--color-on-primary-container': 'var(--color-primitive-primary-90)',
    '--color-primary-fixed': 'var(--color-primitive-primary-90)',
    '--color-primary-fixed-dim': 'var(--color-primitive-primary-80)',
    '--color-on-primary-fixed': 'var(--color-primitive-primary-10)',
    '--color-on-primary-fixed-variant': 'var(--color-primitive-primary-30)',

    // Secondary Roles
    '--color-secondary': 'var(--color-primitive-secondary-80)',
    '--color-on-secondary': 'var(--color-primitive-secondary-20)',
    '--color-secondary-container': 'var(--color-primitive-secondary-30)',
    '--color-on-secondary-container': 'var(--color-primitive-secondary-90)',
    '--color-secondary-fixed': 'var(--color-primitive-secondary-90)',
    '--color-secondary-fixed-dim': 'var(--color-primitive-secondary-80)',
    '--color-on-secondary-fixed': 'var(--color-primitive-secondary-10)',
    '--color-on-secondary-fixed-variant': 'var(--color-primitive-secondary-30)',

    // Tertiary Roles
    '--color-tertiary': 'var(--color-primitive-tertiary-80)',
    '--color-on-tertiary': 'var(--color-primitive-tertiary-20)',
    '--color-tertiary-container': 'var(--color-primitive-tertiary-30)',
    '--color-on-tertiary-container': 'var(--color-primitive-tertiary-90)',
    '--color-tertiary-fixed': 'var(--color-primitive-tertiary-90)',
    '--color-tertiary-fixed-dim': 'var(--color-primitive-tertiary-80)',
    '--color-on-tertiary-fixed': 'var(--color-primitive-tertiary-10)',
    '--color-on-tertiary-fixed-variant': 'var(--color-primitive-tertiary-30)',

    // Error Roles
    '--color-error': 'var(--color-primitive-error-80)',
    '--color-on-error': 'var(--color-primitive-error-20)',
    '--color-error-container': 'var(--color-primitive-error-30)',
    '--color-on-error-container': 'var(--color-primitive-error-90)',

    // Warning Roles
    '--color-warning': 'var(--color-primitive-warning-80)',
    '--color-on-warning': 'var(--color-primitive-warning-20)',
    '--color-warning-container': 'var(--color-primitive-warning-30)',
    '--color-on-warning-container': 'var(--color-primitive-warning-90)',

    // Background & Surfaces
    '--color-background': 'var(--color-primitive-neutral-10)',
    '--color-on-background': 'var(--color-primitive-neutral-90)',
    '--color-surface': 'var(--color-primitive-neutral-10)',
    '--color-on-surface': 'var(--color-primitive-neutral-90)',
    '--color-surface-dim': 'var(--color-primitive-neutral-10)',
    '--color-surface-bright': 'var(--color-primitive-neutral-20)',
    '--color-surface-container-lowest': 'var(--color-primitive-neutral-0)',
    '--color-surface-container-low': 'var(--color-primitive-neutral-10)',
    '--color-surface-container': 'var(--color-primitive-neutral-20)',
    '--color-surface-container-high': 'var(--color-primitive-neutral-20)',
    '--color-surface-container-highest': 'var(--color-primitive-neutral-30)',
    '--color-surface-variant': 'var(--color-primitive-neutral-variant-30)',
    '--color-on-surface-variant': 'var(--color-primitive-neutral-variant-80)',

    // Outlines & Borders
    '--color-outline': 'var(--color-primitive-neutral-variant-60)',
    '--color-outline-variant': 'var(--color-primitive-neutral-variant-30)',

    // Inverses
    '--color-inverse-surface': 'var(--color-primitive-neutral-90)',
    '--color-inverse-on-surface': 'var(--color-primitive-neutral-20)',
    '--color-inverse-primary': 'var(--color-primitive-primary-40)',

    // Scrim / Shadow
    '--color-scrim': 'var(--color-primitive-neutral-0)',
    '--color-shadow': 'var(--color-primitive-neutral-0)',
  }
};

/**
 * Main conversion function. Reads token JSON data and outputs clean CSS.
 *
 * @param {object} tokens - Parsed JSON object from design-tokens.tokens.json
 * @returns {string} - Formatted CSS file content
 */
function convertTokensToCss(tokens) {
  const lines = [];

  // Header Documentation
  lines.push('/**');
  lines.push(' * AWARI DESIGN SYSTEM TOKENS');
  lines.push(' * Generated automatically from design-tokens.tokens.json');
  lines.push(' *');
  lines.push(' * STRICT COLOR ARCHITECTURE RULES:');
  lines.push(' * 1. PRIMITIVES (--color-primitive-*): Foundational raw palette values.');
  lines.push(' *    DO NOT use primitive variables directly in UI components.');
  lines.push(' * 2. COLOR RULES (--color-*): Standard semantic role-based variables.');
  lines.push(' *    ALWAYS use these semantic color rules for styling all UI elements.');
  lines.push(' *    They automatically adapt across Light and Dark themes.');
  lines.push(' */');
  lines.push('');

  // -------------------------------------------------------------
  // 1. Primitive Tokens (:root)
  // -------------------------------------------------------------
  lines.push('/* ========================================================= */');
  lines.push('/* TIER 1: PRIMITIVE COLOR PALETTES (DO NOT USE IN UI DIRECTLY) */');
  lines.push('/* ========================================================= */');
  lines.push(':root {');

  // Key Colors
  if (tokens.primitives && tokens.primitives['key colour']) {
    lines.push('  /* Primitive Key Source Colors */');
    for (const [rawKey, tokenObj] of Object.entries(tokens.primitives['key colour'])) {
      // e.g. "primary key colour" or "error key volour" -> "primary", "error"
      const cleanKey = normalizeName(rawKey.replace(/key\s+[cv]olou?r/i, '').trim());
      const val = normalizeColor(tokenObj.value);
      lines.push(`  --color-primitive-key-${cleanKey}: ${val};`);
    }
    lines.push('');
  }

  // Tonal Palettes
  if (tokens.primitives && tokens.primitives['colour palettes']) {
    const palettes = tokens.primitives['colour palettes'];
    for (const [rawPaletteName, shades] of Object.entries(palettes)) {
      const paletteName = normalizeName(rawPaletteName);
      lines.push(`  /* Palette: ${rawPaletteName} */`);

      // Collect and sort by numeric tone
      const toneEntries = [];
      let index = 0;
      for (const [shadeKey, shadeObj] of Object.entries(shades)) {
        const tone = extractTone(shadeKey, STANDARD_TONES[index] !== undefined ? STANDARD_TONES[index] : index * 10);
        toneEntries.push({ tone, value: normalizeColor(shadeObj.value) });
        index++;
      }

      // Sort ascending by tone
      toneEntries.sort((a, b) => a.tone - b.tone);

      for (const entry of toneEntries) {
        lines.push(`  --color-primitive-${paletteName}-${entry.tone}: ${entry.value};`);
      }
      lines.push('');
    }
  }

  // -------------------------------------------------------------
  // 2. Elevation / Shadow Effects (:root)
  // -------------------------------------------------------------
  if (tokens.effect) {
    lines.push('  /* Elevation / Shadow Effects */');
    for (const [effectName, effectObj] of Object.entries(tokens.effect)) {
      const varName = `--shadow-${normalizeName(effectName.replace(/shadow/i, ''))}`;
      if (effectObj.type === 'custom-shadow' && effectObj.value) {
        const { offsetX = 0, offsetY = 0, radius = 0, spread = 0, color = '#000000' } = effectObj.value;
        const x = Math.round(offsetX * 100) / 100;
        const y = Math.round(offsetY * 100) / 100;
        const r = Math.round(radius * 100) / 100;
        const s = Math.round(spread * 100) / 100;
        const colorFormatted = normalizeColor(color);
        lines.push(`  ${varName}: ${x}px ${y}px ${r}px ${s}px ${colorFormatted};`);
      }
    }
    lines.push('');
  }

  // -------------------------------------------------------------
  // 3. Typography & Font Metrics (:root)
  // -------------------------------------------------------------
  if (tokens.font || tokens.typography) {
    lines.push('  /* Typography System */');
    lines.push(`  --font-family-primary: 'Nata Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`);
    lines.push('');

    const fontStyles = tokens.font || {};
    for (const [styleName, styleObj] of Object.entries(fontStyles)) {
      const baseKey = normalizeName(styleName);
      const val = styleObj.value || {};

      if (val.fontSize) {
        lines.push(`  --typography-${baseKey}-size: ${val.fontSize / 16}rem; /* ${val.fontSize}px */`);
      }
      if (val.lineHeight) {
        lines.push(`  --typography-${baseKey}-line-height: ${val.lineHeight / 16}rem; /* ${val.lineHeight}px */`);
      }
      if (val.fontWeight) {
        lines.push(`  --typography-${baseKey}-weight: ${val.fontWeight};`);
      }
      if (val.letterSpacing !== undefined) {
        lines.push(`  --typography-${baseKey}-letter-spacing: ${val.letterSpacing}px;`);
      }
    }
  }

  lines.push('}');
  lines.push('');

  // -------------------------------------------------------------
  // 4. Semantic Color Rules (Light Theme: Default on :root)
  // -------------------------------------------------------------
  lines.push('/* ========================================================= */');
  lines.push('/* TIER 2: SEMANTIC COLOR RULES (USE THESE DIRECTLY ON UI)    */');
  lines.push('/* Theme: Light (Default)                                   */');
  lines.push('/* ========================================================= */');
  lines.push(':root, [data-theme="light"] {');
  for (const [ruleVar, primitiveRef] of Object.entries(COLOR_RULES.light)) {
    lines.push(`  ${ruleVar}: ${primitiveRef};`);
  }
  lines.push('}');
  lines.push('');

  // -------------------------------------------------------------
  // 5. Semantic Color Rules (Dark Theme: [data-theme="dark"] & prefers-color-scheme)
  // -------------------------------------------------------------
  lines.push('/* ========================================================= */');
  lines.push('/* TIER 2: SEMANTIC COLOR RULES (USE THESE DIRECTLY ON UI)    */');
  lines.push('/* Theme: Dark                                              */');
  lines.push('/* ========================================================= */');
  lines.push('[data-theme="dark"] {');
  for (const [ruleVar, primitiveRef] of Object.entries(COLOR_RULES.dark)) {
    lines.push(`  ${ruleVar}: ${primitiveRef};`);
  }
  lines.push('}');
  lines.push('');

  lines.push('@media (prefers-color-scheme: dark) {');
  lines.push('  :root:not([data-theme="light"]) {');
  for (const [ruleVar, primitiveRef] of Object.entries(COLOR_RULES.dark)) {
    lines.push(`    ${ruleVar}: ${primitiveRef};`);
  }
  lines.push('  }');
  lines.push('}');
  lines.push('');

  // -------------------------------------------------------------
  // 6. Typography Helper Utility Classes
  // -------------------------------------------------------------
  if (tokens.font) {
    lines.push('/* ========================================================= */');
    lines.push('/* TYPOGRAPHY UTILITIES                                      */');
    lines.push('/* ========================================================= */');
    for (const [styleName] of Object.entries(tokens.font)) {
      const baseKey = normalizeName(styleName);
      lines.push(`.text-${baseKey} {`);
      lines.push(`  font-family: var(--font-family-primary);`);
      lines.push(`  font-size: var(--typography-${baseKey}-size);`);
      lines.push(`  line-height: var(--typography-${baseKey}-line-height);`);
      lines.push(`  font-weight: var(--typography-${baseKey}-weight);`);
      lines.push(`  letter-spacing: var(--typography-${baseKey}-letter-spacing);`);
      lines.push('}');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * CLI execution entrypoint
 */
function run() {
  const args = process.argv.slice(2);
  const inputArg = args[0];
  const outputArg = args[1];

  const defaultCandidates = [
    path.join(process.cwd(), 'design-tokens', 'design-tokens.tokens.json'),
    path.join(__dirname, '..', 'design-tokens', 'design-tokens.tokens.json'),
    'design-tokens/design-tokens.tokens.json',
    'design-tokens.tokens.json',
    'design tokens.tokens.json',
    path.join(__dirname, '..', 'design-tokens.tokens.json'),
    path.join(__dirname, '..', 'design tokens.tokens.json')
  ];

  let inputPath = inputArg;
  if (!inputPath) {
    inputPath = defaultCandidates.find((cand) => fs.existsSync(cand));
    if (!inputPath) {
      console.error('Error: Could not locate design-tokens.tokens.json. Please specify path:');
      console.error('  node build-tokens.js <path-to-tokens.json> [output.css]');
      process.exit(1);
    }
  }

  const resolvedInput = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Error: Token file not found at ${resolvedInput}`);
    process.exit(1);
  }

  console.log(`Reading design tokens from: ${resolvedInput}`);
  const rawData = fs.readFileSync(resolvedInput, 'utf8');
  const tokens = JSON.parse(rawData);

  const cssOutput = convertTokensToCss(tokens);

  // Target output paths: writes to design-tokens/tokens.css, styles/tokens.css, and tokens.css
  const targetOutputs = outputArg
    ? [outputArg]
    : [
        path.join(process.cwd(), 'design-tokens', 'tokens.css'),
        path.join(process.cwd(), 'styles', 'tokens.css'),
        path.join(process.cwd(), 'tokens.css')
      ];

  for (const target of targetOutputs) {
    const resolvedOut = path.resolve(process.cwd(), target);
    const parentDir = path.dirname(resolvedOut);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(resolvedOut, cssOutput, 'utf8');
    console.log(`✓ Generated CSS tokens at: ${resolvedOut}`);
  }

  console.log('Design tokens successfully converted to CSS variables!');
}

if (require.main === module) {
  run();
}

module.exports = {
  run,
  convertTokensToCss,
  normalizeColor,
  extractTone,
  COLOR_RULES
};
