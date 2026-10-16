import type { ComponentType } from "react";
import { DEFAULT_TEMPLATE, type FontId, type TemplateId } from "@/lib/design";
import type { Invoice } from "@/lib/schemas/invoice";
import { BOLD_DEFAULTS, BoldTemplate } from "./bold";
import { CLASSIC_DEFAULTS, ClassicTemplate } from "./classic";
import { MINIMAL_DEFAULTS, MinimalTemplate } from "./minimal";
import { MODERN_DEFAULTS, ModernTemplate } from "./modern";
import { SKY_DEFAULTS, SkyTemplate } from "./sky";

export type TemplateInfo = {
  label: string;
  description: string;
  /** The accent colour used when the invoice does not choose one. */
  defaultAccent: string;
  /** The font used when the invoice does not choose one. */
  defaultFont: FontId;
  Component: ComponentType<{ invoice: Invoice }>;
};

/**
 * Registry of invoice templates. Adding a template means: add its id to TEMPLATE_IDS in
 * src/lib/design.ts, write the component, and register it here (the type forces all three).
 */
export const templates: Record<TemplateId, TemplateInfo> = {
  classic: {
    label: "Classic",
    description: "Traditional layout with a bold title and ruled table",
    defaultAccent: CLASSIC_DEFAULTS.accent,
    defaultFont: CLASSIC_DEFAULTS.font,
    Component: ClassicTemplate,
  },
  modern: {
    label: "Modern",
    description: "Coloured header band and tinted table",
    defaultAccent: MODERN_DEFAULTS.accent,
    defaultFont: MODERN_DEFAULTS.font,
    Component: ModernTemplate,
  },
  minimal: {
    label: "Minimal",
    description: "Light and spacious, with hairline rules",
    defaultAccent: MINIMAL_DEFAULTS.accent,
    defaultFont: MINIMAL_DEFAULTS.font,
    Component: MinimalTemplate,
  },
  bold: {
    label: "Bold",
    description: "Huge title in a thin frame, with ruled rows",
    defaultAccent: BOLD_DEFAULTS.accent,
    defaultFont: BOLD_DEFAULTS.font,
    Component: BoldTemplate,
  },
  sky: {
    label: "Sky",
    description: "Tinted header and footer with an italic serif title",
    defaultAccent: SKY_DEFAULTS.accent,
    defaultFont: SKY_DEFAULTS.font,
    Component: SkyTemplate,
  },
};

export { DEFAULT_TEMPLATE };
export type { TemplateId };
