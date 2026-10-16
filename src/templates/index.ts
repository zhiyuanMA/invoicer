import { ClassicTemplate } from "./classic";

/** Registry of invoice templates. Adding a template means adding a component here. */
export const templates = {
  classic: ClassicTemplate,
} as const;

export type TemplateId = keyof typeof templates;
export const DEFAULT_TEMPLATE: TemplateId = "classic";

/** Maps a stored template id to a known template, falling back to the default. */
export function resolveTemplateId(id: string): TemplateId {
  return id in templates ? (id as TemplateId) : DEFAULT_TEMPLATE;
}
