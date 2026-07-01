export type StatusStripState = "ready" | "loading" | "action" | "error";

export function setStatusStrip(state: StatusStripState, message: string): void {
  const strip = document.getElementById("statusStrip");
  const text = document.getElementById("statusText");
  if (strip === null || text === null) return;

  strip.dataset.state = state;
  strip.setAttribute("aria-busy", state === "loading" || state === "action" ? "true" : "false");
  text.textContent = message;
}
