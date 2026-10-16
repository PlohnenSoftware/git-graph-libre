import type { EngineComponentStatus } from "@/types";

export type StatusStripState = "ready" | "loading" | "action" | "error";

export function setStatusStrip(state: StatusStripState, message: string): void {
  const strip = document.getElementById("statusStrip");
  const text = document.getElementById("statusText");
  if (strip === null || text === null) return;

  strip.dataset.state = state;
  strip.setAttribute("aria-busy", state === "loading" || state === "action" ? "true" : "false");
  text.textContent = message;
}

/**
 * Record the engine's state on the strip. Styling keys off it: a ready strip
 * over an unavailable engine shows the amber indicator and the "Rust engine
 * unavailable" note, while every busy and error state keeps its own look.
 */
export function setEngineState(state: EngineComponentStatus["state"]): void {
  const strip = document.getElementById("statusStrip");
  if (strip !== null) strip.dataset.engine = state;
}
