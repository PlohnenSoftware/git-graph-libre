---
summary: >-
  Two settings: `repository.stashDisplay` (`table`/`graph`/`both`, under
  `repository.showStashes`) and `dialog.createBranch.checkout` (default
  `true`; branch and checkout run as two separate steps).
---

# Follow-up — where stashes appear, and a checkout default

Two additions on top of the four slices, both through the standard setting
plumbing (manifest, five `package.nls*.json`, `src/config.ts`,
`src/types.ts`, `webviewHtml.ts`, `global.d.ts`, the webview config switch
plus constructor literal, README):

- `repository.stashDisplay` (`"table"` / `"graph"` / `"both"`, default
  `"both"`) chooses which stash surface is shown. It is **scoped by**
  `repository.showStashes` rather than replacing it: the boolean still gates
  whether stashes load at all, so switching it off hides both surfaces
  regardless of this value. Keep that nesting — a three-way display mode that
  could resurrect stashes a user had switched off would be a surprise.
- `dialog.createBranch.checkout` (default `true`) pre-checks "Check out" in
  the create-branch dialog. The backend does the create and the checkout as
  two steps (`branch` then `checkout`) rather than `checkout -b`, so a failed
  checkout still leaves the branch created — which is the recoverable
  outcome, and the one the dialog's own error path already reports.
