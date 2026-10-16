import { ClassicTemplate } from "./classic";

/** Registry of invoice templates. Adding a template means adding a component here. */
export const templates = {
  classic: ClassicTemplate,
} as const;

export type TemplateId = keyof typeof templates;
export const DEFAULT_TEMPLATE: TemplateId = "classic";
