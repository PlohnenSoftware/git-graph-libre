import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "media/main.css"), "utf8");
const dropdownCss = readFileSync(join(process.cwd(), "media/dropdown.css"), "utf8");

function ruleFor(source: string, selector: string): string {
  const escaped = selector.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...source.matchAll(new RegExp(`^${escaped}\\s*\\{[^}]+\\}`, "gm"))];
  return matches.at(-1)?.[0] ?? "";
}

describe("dialog styles", () => {
  it("renders the dialog panel with editor widget theme tokens", () => {
    const dialog = ruleFor(css, "#dialog.active");

    expect(dialog).toContain("var(--vscode-editorWidget-background");
    expect(dialog).toContain("var(--vscode-editorWidget-foreground");
    expect(dialog).toContain("var(--vscode-editorWidget-border");
    expect(dialog).toContain("border-radius: 6px;");
    expect(dialog).toContain("text-align: left;");
  });

  it("dims the page behind modal dialogs", () => {
    expect(css).toContain("--ngg-backdrop: oklch(");
    expect(ruleFor(css, "#dialogBacking.active")).toContain(
      "background-color: var(--ngg-backdrop);"
    );
  });

  it("styles dialog text fields and selects with input theme tokens", () => {
    expect(css).toContain('#dialog table.dialogForm input[type="text"],');
    expect(css).toContain("#dialog table.dialogForm textarea,");
    expect(css).toContain("var(--vscode-input-background)");
    expect(css).toContain("var(--vscode-input-foreground)");
    expect(css).toContain("var(--vscode-input-border");
    expect(css).toContain("var(--vscode-input-placeholderForeground)");
    expect(ruleFor(css, "#dialog table.dialogForm select")).toContain(
      "var(--vscode-dropdown-background"
    );
    expect(css).toContain("resize: vertical;");
    expect(ruleFor(css, '#dialog.inputInvalid table.dialogForm input[type="text"]')).toContain(
      "var(--vscode-inputValidation-errorBorder"
    );
  });

  it("styles dialog buttons like VS Code buttons", () => {
    const secondary = ruleFor(css, ".dialogBtn");
    const primary = ruleFor(css, ".dialogBtn.dialogBtnPrimary");

    expect(secondary).toContain("var(--vscode-button-secondaryBackground");
    expect(secondary).toContain("var(--vscode-button-secondaryForeground");
    expect(primary).toContain("var(--vscode-button-background");
    expect(primary).toContain("var(--vscode-button-foreground");
    expect(css).toContain(".dialogBtn:hover");
    expect(css).toContain("var(--vscode-button-hoverBackground");
    expect(ruleFor(css, "#dialog .dialogActions")).toContain("justify-content: flex-end;");
  });

  it("styles dialog form notes as wrapping secondary text", () => {
    const noteCell = ruleFor(css, "#dialog table.dialogForm td.dialogFormNoteCell");
    const note = ruleFor(css, "#dialog table.dialogForm .dialogFormNote");

    // The surrounding dialogForm cells are nowrap; a note sentence must wrap.
    expect(noteCell).toContain("white-space: normal;");
    expect(note).toContain("var(--vscode-descriptionForeground, var(--ngg-neutral-icon))");
  });

  it("marks dialog errors with error tokens and a readable reason block", () => {
    expect(css).toContain("--ngg-error: oklch(");
    expect(ruleFor(css, "#dialog .dialogErrorIcon svg")).toContain("var(--vscode-errorForeground");
    const reason = ruleFor(css, "#dialog .errorReason");
    expect(reason).toContain("var(--vscode-textCodeBlock-background");
    expect(reason).toContain("word-break: break-word;");
  });

  it("themes checkboxes with the button accent color", () => {
    expect(css).toContain("--ngg-accent: oklch(");
    const dialogCheckbox = ruleFor(css, '#dialog table.dialogForm input[type="checkbox"]');
    const toolbarCheckbox = ruleFor(css, "#showRemoteBranchesCheckbox");

    expect(dialogCheckbox).toContain("accent-color: var(--vscode-button-background");
    expect(toolbarCheckbox).toContain("accent-color: var(--vscode-button-background");
  });

  it("keeps repository settings as a viewport popup above graph chrome", () => {
    const backing = ruleFor(css, "#settingsWidgetBacking");
    const popup = ruleFor(css, "#settingsWidget");
    const dialog = ruleFor(css, "#dialog.active");

    expect(backing).toContain("position: fixed;");
    expect(backing).toContain("z-index: 300;");
    expect(popup).toContain("position: fixed;");
    expect(popup).toContain("height: min(760px, calc(100vh - 32px));");
    expect(popup).toContain("z-index: 301;");
    expect(dialog).toContain("z-index: 401;");
  });

  it("styles settings tabs and graph color editors with stable dimensions", () => {
    const tabs = ruleFor(css, ".settingsTabs");
    const tab = ruleFor(css, ".settingsTab");
    const selectedTab = ruleFor(css, '.settingsTab[aria-selected="true"]');
    const extensionRow = ruleFor(css, ".settingsExtensionRow");
    const swatch = ruleFor(css, ".settingsColorSwatch");

    expect(tabs).toContain("display: flex;");
    expect(tabs).toContain("var(--vscode-panel-border");
    expect(tab).toContain("min-width: 96px;");
    expect(tab).toContain("height: 30px;");
    expect(selectedTab).toContain("var(--vscode-panelTitle-activeBorder");
    expect(extensionRow).toContain("grid-template-columns: minmax(220px, 360px) minmax(0, 1fr);");
    expect(css).toContain(".settingsTabPanel[hidden]");
    expect(css).toContain(".settingsGraphColorsEditor");
    expect(swatch).toContain("width: 18px;");
    expect(swatch).toContain("height: 18px;");
    expect(swatch).toContain("background-color: var(--settings-swatch);");
  });

  it("keeps the context menu on menu theme tokens with rounded grouping", () => {
    const menu = ruleFor(css, "#contextMenu");

    expect(menu).toContain("var(--vscode-menu-background)");
    expect(menu).toContain("var(--vscode-menu-border");
    expect(menu).toContain("border-radius: 5px;");
    expect(ruleFor(css, "#contextMenu li.contextMenuItem")).toContain("border-radius: 3px;");
    expect(ruleFor(css, "#contextMenu li.contextMenuDivider")).toContain(
      "var(--vscode-menu-separatorBackground"
    );
  });

  it("styles dropdowns with dropdown, list, and input theme tokens", () => {
    expect(ruleFor(dropdownCss, ".dropdownCurrentValue")).toContain(
      "var(--vscode-dropdown-background"
    );
    expect(ruleFor(dropdownCss, ".dropdownMenu")).toContain("var(--vscode-dropdown-listBackground");
    expect(ruleFor(dropdownCss, ".dropdownOption.selected")).toContain(
      "var(--vscode-list-activeSelectionBackground"
    );
    const filterInput = ruleFor(dropdownCss, ".dropdownFilterInput");
    expect(filterInput).toContain("var(--vscode-input-background)");
    expect(filterInput).toContain("var(--vscode-input-foreground)");
    expect(dropdownCss).toContain(".dropdownFilterInput:focus");
    expect(dropdownCss).toContain("var(--vscode-focusBorder)");
  });

  it("keeps the details row free of the legacy bottom separator", () => {
    expect(css).not.toContain("#commitDetails td:after");
  });

  it("shows the commit dot hue on the details resize grip line hover", () => {
    const gripHover =
      css.match(
        /#commitDetailsResizeHandle:hover:before,\s*#commitDetailsResizeHandle:focus-visible:before \{[^}]+\}/
      )?.[0] ?? "";

    expect(gripHover).toContain(
      "background-color: var(--git-graph-color, var(--vscode-focusBorder, var(--ngg-neutral-border-heavy)));"
    );
    // The grab area itself stays transparent; only the grip line takes the hue
    expect(css).not.toMatch(
      /#commitDetailsResizeHandle:hover,\s*#commitDetailsResizeHandle:focus-visible \{/
    );
  });

  it("tints selected commit rows with their own graph dot color", () => {
    const selectedRow = css.match(
      /#commitTable tr\.commit\.commitDetailsOpen td,\s*#commitTable tr\.commit\.commitSelected td \{[^}]+color-mix\([^}]+\}/
    )?.[0];

    expect(selectedRow).toBeDefined();
    expect(selectedRow).toContain("var(--git-graph-color");
    expect(selectedRow).toContain("var(--ngg-transparent)");
  });

  it("lays out the tag details popup as a structured, non-squeezed grid", () => {
    const variant = ruleFor(css, "#dialog.tagDetails");
    const fields = ruleFor(css, "dl.tagDetailsFields");

    // The variant replaces the generic shrink-to-fit width with a predictable
    // budget so hashes and messages are not squeezed into a narrow column.
    expect(variant).toContain("width: min(460px, 90vw);");
    // The fields are a two-column label/value grid, not inline <b>/<br> flow.
    expect(fields).toContain("display: grid;");
    expect(fields).toContain("grid-template-columns: max-content 1fr;");
    // Labels use the description-foreground token like other secondary text.
    expect(ruleFor(css, "dl.tagDetailsFields dt")).toContain(
      "var(--vscode-descriptionForeground, var(--ngg-neutral-icon))"
    );
    // Values wrap long hashes/emails instead of overflowing the panel.
    expect(ruleFor(css, "dl.tagDetailsFields dd")).toContain("word-break: break-word;");
    // The message row spans the full grid width and preserves line breaks.
    expect(ruleFor(css, ".tagDetailsMessage")).toContain("grid-column: 1 / -1;");
    expect(ruleFor(css, ".tagDetailsMessage")).toContain("white-space: pre-wrap;");
    // Copy actions sit in a wrapping flex row.
    expect(ruleFor(css, ".tagDetailsActions")).toContain("display: flex;");
    expect(ruleFor(css, ".tagDetailsActions")).toContain("flex-wrap: wrap;");
  });

  it("uses the default ref border for signed tags while the tag icon keeps commit color", () => {
    const signedRef = ruleFor(css, ".gitRef.tag.signed");

    // The signed tag shares the default neutral border with every other ref so
    // all tags read consistently; only the green verified badge distinguishes it.
    expect(signedRef).toContain("border-color: var(--ngg-neutral-border-heavy);");
    expect(signedRef).not.toContain("border-color: var(--ngg-signed-ref);");
    // The tag icon background must NOT be overridden for signed tags, so it
    // keeps the commit color like every other ref icon. The only signed > svg
    // rule zeroes the right margin so the verified badge sits flush.
    const signedSvg = ruleFor(css, ".gitRef.tag.signed > svg");
    expect(signedSvg).not.toContain("background-color");
    expect(signedSvg).toContain("margin-right: 0;");
    // The verified badge carries the signature distinction on the green fill.
    // It is square (no border-radius) so there is no gap where it meets the
    // tag icon's commit-color background and the badge reads consistently.
    const badge = ruleFor(css, ".gitRefSignedBadge");
    expect(badge).toContain("background-color: var(--ngg-signed-ref);");
    expect(badge).toContain("border-radius: 0;");
    expect(badge).toContain("border-radius: 0;");
  });

  it("renders the valid signature as a filled green circle with the glyph", () => {
    const valid = ruleFor(css, ".commitSignature-valid");

    // A filled signature-status green circle (not the old faint tint).
    expect(valid).toContain("background: var(--ngg-signed-ref);");
    expect(valid).not.toContain("color-mix");
  });
});
