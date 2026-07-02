import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import { Dropdown } from "@/webview/dropdown";
import { beforeEach, describe, expect, it } from "vitest";

describe("Dropdown", () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="repoSelect" class="dropdown"></div><div id="outside"></div>';
    (global as unknown as { l10n: ReturnType<typeof getWebviewLocalizedStrings> }).l10n =
      getWebviewLocalizedStrings();
  });

  it("opens, filters, selects an option, and closes on outside clicks", () => {
    const selectedValues: string[] = [];
    const dropdown = new Dropdown("repoSelect", true, "repo", (value) => {
      selectedValues.push(value);
    });

    dropdown.setOptions(
      [
        { name: "Alpha", value: "/alpha" },
        { name: "Beta", value: "/beta" }
      ],
      "/alpha"
    );

    const root = document.getElementById("repoSelect");
    const currentValue = document.querySelector<HTMLElement>(".dropdownCurrentValue");
    currentValue?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(root?.classList.contains("dropdownOpen")).toBe(true);

    const filterInput = document.querySelector<HTMLInputElement>(".dropdownFilterInput");
    if (filterInput === null) throw new Error("Missing dropdown filter input");
    filterInput.value = "bet";
    filterInput.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));

    const options = document.querySelectorAll<HTMLElement>(".dropdownOption");
    expect(options[0].style.display).toBe("none");
    expect(options[1].style.display).toBe("block");

    options[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(selectedValues).toEqual(["/beta"]);
    expect(currentValue?.textContent).toBe("Beta");
    expect(root?.classList.contains("dropdownOpen")).toBe(false);

    currentValue?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document.getElementById("outside")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(root?.classList.contains("dropdownOpen")).toBe(false);
  });

  it("shows no-results state and closes on keyboard, context menu, and single-option reset", () => {
    const dropdown = new Dropdown("repoSelect", false, "branch", () => {});
    dropdown.setOptions(
      [
        { name: "main", value: "main" },
        { name: "release", value: "release" }
      ],
      "main"
    );

    const root = document.getElementById("repoSelect");
    const currentValue = document.querySelector<HTMLElement>(".dropdownCurrentValue");
    currentValue?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const filterInput = document.querySelector<HTMLInputElement>(".dropdownFilterInput");
    if (filterInput === null) throw new Error("Missing dropdown filter input");
    filterInput.value = "missing";
    filterInput.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));

    expect(document.querySelector<HTMLElement>(".dropdownNoResults")?.style.display).toBe("block");

    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", bubbles: true }));
    expect(root?.classList.contains("dropdownOpen")).toBe(false);

    currentValue?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(root?.classList.contains("dropdownOpen")).toBe(false);

    dropdown.setOptions([{ name: "main", value: "main" }], "main");
    dropdown.refresh();

    expect(root?.classList.contains("dropdownOpen")).toBe(false);
    expect(currentValue?.textContent).toBe("main");
  });
});
