---
summary: >-
  Consent rules for `consentPrompt.ts`: dismissal is not an answer, no latch
  (a past bug), the "Reject and Don't Show Again" label; the banner reversed
  into the `webviewConsentScreen.ts` gate; GDPR/Marketplace research.
---

# Consent prompt (`2026-09-02`)

`src/telemetry/consentPrompt.ts` asks the question the `unset` default leaves
open: once from `activate()`, and again from `openGraphView()` on every graph
open while the answer is still missing. Rules worth keeping:

- **Dismissal is not an answer.** Closing the notification leaves the state
  `unset`, so nothing is sent and the next graph open asks again. Recording a
  dismissal either way would collect data nobody agreed to, or bury the
  question forever.
- **No "one question at a time" latch — this was a real bug (`2026-09-02`).**
  The first version held a `pending` flag cleared in the `finally` of the
  `showInformationMessage` promise. That promise often never resolves: the
  workbench's `get sticky()` treats a notification with buttons as sticky only
  at `Severity.Error`, so an Info prompt is non-sticky and
  `PURGE_TIMEOUT[Info]` (10 seconds) calls `removeToast()`, which removes the
  *toast* and leaves the notification in the model — `onDidClose` never fires.
  The flag therefore latched for the rest of the session and silently blocked
  every later prompt, which is what the maintainer hit as "reopening a
  notification some time after it was closed doesn't work": **Set now** and the
  per-graph-open prompt were both dead once the toast had aged out. The guard
  was also unnecessary — `NotificationsModel.addNotification()` closes an
  identical notification before adding the new one, so at most one of these
  prompts exists no matter how many times it is requested. Do not reintroduce
  a latch here; a regression test pins the unresolved-promise case.
- **Expect the toast to vanish by itself after ~10 seconds.** That is why the
  gate screen persists behind it and why its hint text points at **Set now**:
  the notification is recoverable, not permanent.
- **The refusal button is labelled "Reject and Don't Show Again"** (`2026-09-03`)
  because that is what it does — `disabled` is both silent and no longer
  pending, so neither the notification nor the gate screen returns. VS Code's
  notification guidelines ask for a **Do not show again** option on every
  notification; rather than adding a third button that silences without
  answering, the refusal *is* that option and the label says so. Keep the label
  and the written state in agreement: a rename that no longer promises silence,
  or a state that leaves the question pending, would each make the other a lie.
- **Accepting while VS Code's global switch is off** gets a follow-up saying
  that switch wins, with a button running `workbench.action.openSettings` on
  `telemetry.telemetryLevel`. The consent is still stored as `enabled` — it is
  a valid preference that cannot take effect yet, and silently storing it
  without a word would leave the user believing data is flowing.
- **A failed settings write is swallowed and logged**, never allowed to take
  activation or a graph open down with it. The state stays `unset`, so the
  question comes back rather than being lost.
- **No endpoint compiled in, no question.** Asking permission for something
  that cannot happen is noise.

**Maintainer reversal of `2026-09-02`: the banner became a gate.** The first
implementation put a standing notice in `#topBar` above the graph
(`webviewTelemetryNotice.ts`, `#telemetryNotice`, a `telemetryConsentChanged`
push, `renderTelemetryNotice()` in `main.ts`, and `telemetryConsent` on
`GitGraphViewState`). The maintainer rejected it as too easy to read past: an
unanswered question must **replace the whole graph**, not decorate it. All of
those surfaces were removed in the same slice rather than left in place — do
not reintroduce a banner.

What replaces it is `src/extension/webviewConsentScreen.ts`, a third body
variant in `buildWebviewHtml()` alongside the graph and the no-repository
placeholder:

- **It is a document, not an overlay.** No toolbar, no `web.min.js`, no
  `viewState`; nothing is mounted, so nothing has to be torn down when the
  answer arrives. `isGraphLoaded` is therefore `false` for it, which is what
  keeps `syncRetainedView()` and the repo callback from posting messages into
  a document with no listener.
- **Screen order: no-repository first, consent second.** A workspace with no
  repository cannot show a graph at all, so that screen states the more
  fundamental blocker.
- **Switching screens is a rebuild**, driven by
  `applyTelemetryConsentChange()` from the `telemetry.enabled` branch of the
  configuration listener. It rebuilds *only* when what is mounted contradicts
  the answer (`isGraphViewLoaded === isConsentPending(...)`); an
  `enabled` ↔ `disabled` change shows nothing new, and rebuilding then would
  reload the webview and drop the graph's live state.
- **`Set now` is load-bearing, not decoration.** Blocking the graph is only
  acceptable because there is a way back: dismissing the notification leaves
  the answer `unset`, and without the button the user would be stuck on a
  screen with nothing to click. It posts `showTelemetryConsent`, handled in
  `messageHandler.ts` outside `registerAction()` — it is not a git action, has
  no outcome to report, and telemetry is by definition off while the question
  it re-opens is unanswered.
- **`isConsentPending()` in `consentPrompt.ts` is the single predicate** behind
  both the notification and the screen, so they cannot disagree about whether
  the question is open. It also carries the empty-endpoint check: with
  telemetry compiled off there is no gate and no prompt.

**Research on the gate, `2026-09-03`** (done because an earlier note in this
file guessed that marketplace review might read the gate as coercive — that
guess was unfounded and is retracted):

- **No Marketplace rule prohibits it.** Nothing in the Visual Studio
  Marketplace Terms of Use or the Publisher Agreement addresses withholding
  functionality pending a consent answer, and no precedent of an extension
  being pulled for it was found.
- **GDPR Art. 7(4)'s bundling prohibition is not engaged.** EDPB Guidelines
  05/2020 invalidate consent when access is conditional on *consenting* to
  non-necessary processing. This gate conditions access on *answering*:
  refusing costs nothing and opens the graph, so there is no detriment to
  refusal.
- **What the guidance does bite on is prominence.** EDPB Guidelines 03/2022 on
  deceptive design name "unequal prominence" — accept visually dominant,
  refusal minimised — as non-compliant, and refusal must be as easy and
  conspicuous as acceptance. Our Accept is the accented primary because VS Code
  hard-codes `secondary: index > 0`; modal dialogs style their first button the
  same way, so **equal weighting is not achievable inside a notification at
  all** — only in our own webview. The maintainer accepted that trade-off
  knowingly; if it is ever revisited, the fix is Accept/Reject on the gate
  screen with identical styling, not a change to the notification.
- **`Don't: Send repeated notifications` does not apply**, and an earlier
  reading of this file's that said it did was wrong. The same guidelines ask for
  a **Do not show again** option on every notification; a clean refusal here
  stops the asking permanently, each prompt follows a user action (opening the
  graph) in a state where nothing else can proceed, and VS Code's own
  `addNotification()` dedupe satisfies "show one notification at a time".
- **Closest precedent**: the Julia extension defaults `julia.enableTelemetry`
  to `null`, prompts, and sends nothing until opted in — the same tri-state
  shape — but does *not* restrict functionality. The gate is this project's own
  choice, not common practice.

**Notification button styling — settled, do not re-open.** An earlier session
left this unresolved: modal dialogs clearly style their first button as
primary, and it was unclear whether plain notifications do. They do.
`renderButtons()` in `workbench.desktop.main.js` constructs each button with
`{ title: true, secondary: index > 0, ...defaultButtonStyles }`, so the
accenting comes from **argument order alone** — the first item passed to
`showInformationMessage` is the primary action and every later one is
secondary. Accept is therefore passed first, and `PROMPT_MODAL` in that module
stays `false`: modality would add nothing to the styling and would seize the
window. The flag exists as one line only because the modality choice is a
judgment call, not because the styling is in doubt.
