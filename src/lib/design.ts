/**
 * The choices that control how an invoice looks. Kept free of React so the invoice schema, the
 * forms and the templates can all share them.
 */

export const TEMPLATE_IDS = ["classic", "modern", "minimal", "bold", "sky"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export const DEFAULT_TEMPLATE: TemplateId = "classic";

export const FONT_IDS = ["sans", "serif", "mono"] as const;
export type FontId = (typeof FONT_IDS)[number];
export const FONT_LABELS: Record<FontId, string> = {
  sans: "Sans-serif",
  serif: "Serif",
  mono: "Monospace",
};

/** Generic fallbacks last, so a missing font never breaks the layout. */
export const FONT_STACKS: Record<FontId, string> = {
  sans: 'Helvetica, Arial, "Liberation Sans", sans-serif',
  serif: 'Georgia, "Times New Roman", "Liberation Serif", serif',
  mono: '"Courier New", Courier, "Liberation Mono", monospace',
};

/**
 * Accent colours are written into CSS, so only a plain 6-digit hex colour is accepted. Anything
 * else (for example `red;background:url(...)`) is rejected by the schema.
 */
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const ACCENT_PRESETS = [
  "#1f2937", // slate
  "#2563eb", // blue
  "#059669", // green
  "#d97706", // amber
  "#dc2626", // red
  "#7c3aed", // violet
] as const;
