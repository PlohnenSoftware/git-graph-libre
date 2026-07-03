import { beforeEach, describe, expect, it } from "vitest";
import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import { Dropdown } from "@/webview/dropdown";

describe("Dropdown", () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="repoSelect" class="dropdown"></div><div id="outside"></div>';
    (global as unknown as { l10n: ReturnType<typeof getWebviewLocalizedStrings> }).l10n =
      getWebviewLocalizedStrings();
  });

  it("shows full-value tooltips on info dropdowns", () => {
    const dropdown = new Dropdown("repoSelect", true, "repo", () => {});

    dropdown.setOptions(
      [
        { name: "alpha", value: "/workspace/alpha" },
        { name: "beta", value: "/workspace/beta" }
      ],
      "/workspace/alpha"
    );

    expect(document.querySelector<HTMLElement>(".dropdownCurrentValue")?.title).toBe(
      "/workspace/alpha"
    );
    const options = document.querySelectorAll<HTMLElement>(".dropdownOption");
    expect(options[0]?.getAttribute("title")).toBe("/workspace/alpha");
    expect(options[1]?.getAttribute("title")).toBe("/workspace/beta");
  });

  it("does not write inline widths from menu content", () => {
    const dropdown = new Dropdown("repoSelect", false, "branch", () => {});

    dropdown.setOptions(
      [
        { name: "main", value: "main" },
        { name: "feature/very-long-branch-name", value: "feature/very-long-branch-name" }
      ],
      "main"
    );

    expect(document.querySelector<HTMLElement>(".dropdownCurrentValue")?.style.width).toBe("");
    expect(document.querySelector<HTMLElement>(".dropdownMenu")?.style.cssText).toBe("");
  });

  it("truncates ref display names while keeping full names selectable and filterable", () => {
    const selectedValues: string[][] = [];
    const dropdown = new Dropdown(
      "repoSelect",
      false,
      "branches",
      (values) => {
        selectedValues.push(values);
      },
      true,
      { maxDisplayChars: 40, truncation: "ref" }
    );

    const checkout = "origin/dependabot/github_actions/actions/checkout-7";
    const setupNode = "origin/dependabot/github_actions/actions/setup-node-6";
    dropdown.setOptions(
      [
        { name: "Show All", value: "" },
        { name: checkout, value: checkout },
        { name: setupNode, value: setupNode }
      ],
      null
    );

    const currentValue = document.querySelector<HTMLElement>(".dropdownCurrentValue");
    currentValue?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const options = document.querySelectorAll<HTMLElement>(".dropdownOption");
    expect(options[1]?.textContent).toContain("origin/\u2026/actions/checkout-7");
    expect(options[2]?.textContent).toContain("origin/\u2026/actions/setup-node-6");
    expect(options[1]?.getAttribute("title")).toBe(checkout);
    expect(options[2]?.getAttribute("title")).toBe(setupNode);

    const filterInput = document.querySelector<HTMLInputElement>(".dropdownFilterInput");
    if (filterInput === null) throw new Error("Missing dropdown filter input");
    filterInput.value = "setup-node";
    filterInput.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));

    expect(options[1]?.style.display).toBe("none");
    expect(options[2]?.style.display).toBe("block");

    options[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(selectedValues.at(-1)).toEqual([setupNode]);
    expect(currentValue?.textContent).toBe("origin/\u2026/actions/setup-node-6");
    expect(currentValue?.title).toBe(setupNode);
  });

  it("middle-truncates multi-select summaries independently", () => {
    const dropdown = new Dropdown("repoSelect", false, "authors", () => {}, true, {
      maxDisplayChars: 18,
      truncation: "middle"
    });

    dropdown.setOptions(
      [
        { name: "Show All", value: "" },
        { name: "averyverylongauthor@example.test", value: "averyverylongauthor@example.test" },
        { name: "anotherverylongauthor@example.test", value: "anotherverylongauthor@example.test" }
      ],
      ["averyverylongauthor@example.test", "anotherverylongauthor@example.test"]
    );

    const currentValue = document.querySelector<HTMLElement>(".dropdownCurrentValue");
    expect(currentValue?.textContent).toBe("averyvery\u2026ple.test, anotherve\u2026ple.test");
    expect(currentValue?.title).toBe(
      "averyverylongauthor@example.test, anotherverylongauthor@example.test"
    );
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

  it("keeps multi-select dropdowns open and emits selected values", () => {
    const selectedValues: string[][] = [];
    const dropdown = new Dropdown(
      "repoSelect",
      false,
      "branches",
      (values) => {
        selectedValues.push(values);
      },
      true
    );

    dropdown.setOptions(
      [
        { name: "Show All", value: "" },
        { name: "HEAD", value: "HEAD" },
        { name: "feature/menu", value: "feature/menu" }
      ],
      null
    );

    const root = document.getElementById("repoSelect");
    const currentValue = document.querySelector<HTMLElement>(".dropdownCurrentValue");
    currentValue?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    document
      .querySelectorAll<HTMLElement>(".dropdownOption")[1]
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document
      .querySelectorAll<HTMLElement>(".dropdownOption")[2]
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(root?.classList.contains("dropdownOpen")).toBe(true);
    expect(selectedValues).toEqual([["HEAD"], ["HEAD", "feature/menu"]]);
    expect(currentValue?.textContent).toContain("HEAD");
    expect(currentValue?.textContent).toContain("feature/menu");

    dropdown.unselectOption("HEAD");
    expect(selectedValues.at(-1)).toEqual(["feature/menu"]);

    dropdown.selectOption("");
    expect(selectedValues.at(-1)).toEqual([""]);
    expect(dropdown.isShowAllSelected()).toBe(true);
  });
});
