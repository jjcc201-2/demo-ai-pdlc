export * from "./schema.js";
export * from "./render.js";

export const DEFAULT_BRD_TEMPLATE_PATH = new URL(
  "../templates/default.brd.md",
  import.meta.url,
).pathname;
