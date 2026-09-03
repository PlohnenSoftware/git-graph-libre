/**
 * Ingest URL — the switch that turns telemetry on.
 *
 * Kept in its own module, deliberately free of any `vscode` import, so the
 * shipped value can be asserted by the backend unit tests; `index.ts` pulls in
 * the extension host API and cannot be imported there.
 *
 * An empty string makes the reporter a total no-op, which is how this shipped
 * while the backend did not exist yet. Emptying it again is the one-line way to
 * switch every event off without touching feature code.
 */
export const TELEMETRY_ENDPOINT = "https://t.plohnensoftware.download/v1/events";
