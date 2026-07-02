import { escapeHtml } from "./utils/html";
import { svgIcons } from "./utils/icons";

export interface DropdownOption {
  name: string;
  value: string;
}

export class Dropdown {
  private options: DropdownOption[] = [];
  private selectedOption: number = 0;
  private selectedOptions: Set<number> = new Set([0]);
  private dropdownVisible: boolean = false;
  private readonly showInfo: boolean;
  private readonly multiple: boolean;
  private readonly changeCallback: ((value: string) => void) | ((values: string[]) => void);

  private readonly elem: HTMLElement;
  private readonly currentValueElem: HTMLDivElement;
  private readonly menuElem: HTMLDivElement;
  private readonly optionsElem: HTMLDivElement;
  private readonly noResultsElem: HTMLDivElement;
  private readonly filterInput: HTMLInputElement;

  constructor(
    id: string,
    showInfo: boolean,
    dropdownType: string,
    changeCallback: (value: string) => void
  );
  constructor(
    id: string,
    showInfo: boolean,
    dropdownType: string,
    changeCallback: (values: string[]) => void,
    multiple: true
  );
  constructor(
    id: string,
    showInfo: boolean,
    dropdownType: string,
    changeCallback: ((value: string) => void) | ((values: string[]) => void),
    multiple = false
  ) {
    this.showInfo = showInfo;
    this.multiple = multiple;
    this.changeCallback = changeCallback;
    const elem = document.getElementById(id);
    if (elem === null) throw new Error(`Missing dropdown element: ${id}`);
    this.elem = elem;

    const filter = document.createElement("div");
    filter.className = "dropdownFilter";
    this.filterInput = document.createElement("input");
    this.filterInput.className = "dropdownFilterInput";
    this.filterInput.placeholder = l10n.filterPlaceholder.replace("{0}", dropdownType);
    filter.appendChild(this.filterInput);
    this.menuElem = document.createElement("div");
    this.menuElem.className = "dropdownMenu";
    this.menuElem.appendChild(filter);
    this.optionsElem = document.createElement("div");
    this.optionsElem.className = "dropdownOptions";
    this.menuElem.appendChild(this.optionsElem);
    this.noResultsElem = document.createElement("div");
    this.noResultsElem.className = "dropdownNoResults";
    this.noResultsElem.innerHTML = l10n.noResultsFound;
    this.menuElem.appendChild(this.noResultsElem);
    this.currentValueElem = document.createElement("div");
    this.currentValueElem.className = "dropdownCurrentValue";
    this.elem.appendChild(this.currentValueElem);
    this.elem.appendChild(this.menuElem);

    document.addEventListener("click", (e) => this.handleDocumentClick(e), true);
    document.addEventListener("contextmenu", () => this.close(), true);
    document.addEventListener(
      "keyup",
      (e) => {
        if (e.key === "Escape") this.close();
      },
      true
    );
    this.filterInput.addEventListener("keyup", () => this.filter());
  }

  private handleDocumentClick(e: Event) {
    if (!(e.target instanceof HTMLElement)) return;
    if (e.target === this.currentValueElem) {
      this.toggle();
      return;
    }

    if (!this.dropdownVisible) return;
    if (e.target.closest(".dropdown") !== this.elem) {
      this.close();
      return;
    }

    this.selectClickedOption(e.target);
  }

  private toggle() {
    this.dropdownVisible = !this.dropdownVisible;
    if (this.dropdownVisible) {
      this.filterInput.value = "";
      this.filter();
    }
    this.elem.classList.toggle("dropdownOpen");
    if (this.dropdownVisible) this.filterInput.focus();
  }

  private selectClickedOption(target: HTMLElement) {
    const option = <HTMLElement | null>target.closest(".dropdownOption");
    if (option?.parentNode !== this.optionsElem || option.dataset.id === undefined) {
      return;
    }

    const selectedOption = Number.parseInt(option.dataset.id, 10);
    if (this.multiple) {
      if (this.toggleSelectedOption(selectedOption)) {
        this.render();
        this.emitMultiValue();
      }
      return;
    }

    this.close();
    if (this.selectedOption === selectedOption) return;
    this.selectedOption = selectedOption;
    this.render();
    (this.changeCallback as (value: string) => void)(this.options[this.selectedOption].value);
  }

  public setOptions(options: DropdownOption[], selected: string | readonly string[] | null) {
    this.options = options;
    if (this.multiple) {
      this.setSelectedOptions(this.normalizeMultiSelectedValues(selected));
      if (options.length <= 1) this.close();
      this.render();
      return;
    }

    let selectedOption = 0;
    for (let i = 0; i < options.length; i++) {
      if (options[i].value === selected) {
        selectedOption = i;
      }
    }
    this.selectedOption = selectedOption;
    if (options.length <= 1) this.close();
    this.render();
  }

  public refresh() {
    if (this.options.length > 0) this.render();
  }

  public isOpen() {
    return this.dropdownVisible;
  }

  public isSelected(value: string) {
    const optionIndex = this.findOptionIndex(value);
    if (optionIndex < 0) return false;
    return this.multiple
      ? this.selectedOptions.has(optionIndex)
      : this.selectedOption === optionIndex;
  }

  public isShowAllSelected() {
    return this.multiple ? this.selectedOptions.has(0) : this.selectedOption === 0;
  }

  public selectOption(value: string) {
    const optionIndex = this.findOptionIndex(value);
    if (optionIndex < 0) return;

    if (this.multiple) {
      if (optionIndex === 0) {
        this.selectedOptions = new Set([0]);
      } else {
        this.selectedOptions.delete(0);
        this.selectedOptions.add(optionIndex);
      }
      this.render();
      this.emitMultiValue();
      return;
    }

    if (this.selectedOption === optionIndex) return;
    this.selectedOption = optionIndex;
    this.render();
    (this.changeCallback as (value: string) => void)(this.options[this.selectedOption].value);
  }

  public unselectOption(value: string) {
    const optionIndex = this.findOptionIndex(value);
    if (optionIndex < 0) return;

    if (this.multiple) {
      this.selectedOptions.delete(optionIndex);
      if (this.selectedOptions.size === 0) this.selectedOptions.add(0);
      this.render();
      this.emitMultiValue();
      return;
    }

    if (this.selectedOption === optionIndex) this.selectOption(this.options[0]?.value ?? "");
  }

  private findOptionIndex(value: string) {
    return this.options.findIndex((option) => option.value === value);
  }

  private normalizeMultiSelectedValues(selected: string | readonly string[] | null) {
    if (Array.isArray(selected)) return selected;
    if (selected === null) return [];
    return [selected];
  }

  private setSelectedOptions(selectedValues: readonly string[]) {
    const selected = new Set<number>();
    if (selectedValues.length === 0 || selectedValues.includes(this.options[0]?.value ?? "")) {
      selected.add(0);
    } else {
      for (let i = 0; i < this.options.length; i++) {
        if (selectedValues.includes(this.options[i].value)) selected.add(i);
      }
      if (selected.size === 0) selected.add(0);
    }
    this.selectedOptions = selected;
  }

  private toggleSelectedOption(optionIndex: number) {
    const before = this.selectedValueKey();
    if (optionIndex === 0) {
      this.selectedOptions = new Set([0]);
    } else if (this.selectedOptions.has(optionIndex)) {
      this.selectedOptions.delete(optionIndex);
      if (this.selectedOptions.size === 0) this.selectedOptions.add(0);
    } else {
      this.selectedOptions.delete(0);
      this.selectedOptions.add(optionIndex);
    }
    return before !== this.selectedValueKey();
  }

  private selectedValueKey() {
    return this.selectedValues().join("\0");
  }

  private selectedValues() {
    if (!this.multiple) return [this.options[this.selectedOption]?.value ?? ""];
    return this.sortedSelectedOptionIndexes()
      .map((index) => this.options[index]?.value ?? "")
      .filter((value) => value !== undefined);
  }

  private selectedNames() {
    if (!this.multiple) return this.options[this.selectedOption]?.name ?? "";
    return this.sortedSelectedOptionIndexes()
      .map((index) => this.options[index]?.name ?? "")
      .filter((name) => name !== "")
      .join(", ");
  }

  private sortedSelectedOptionIndexes() {
    return [...this.selectedOptions].sort((left, right) => left - right);
  }

  private emitMultiValue() {
    (this.changeCallback as (values: string[]) => void)(this.selectedValues());
  }

  private render() {
    this.elem.classList.add("loaded");
    this.currentValueElem.innerHTML = escapeHtml(this.selectedNames());
    if (this.showInfo) {
      this.currentValueElem.title = this.selectedValues().join(", ");
    }
    this.optionsElem.className = this.showInfo ? "dropdownOptions showInfo" : "dropdownOptions";
    this.optionsElem.innerHTML = this.options
      .map((option, index) => this.renderOption(option, index))
      .join("");
    this.filterInput.style.display = "none";
    this.noResultsElem.style.display = "none";
    // min-width is cleared during measurement so the control width cannot feed
    // back into the menu width and grow on every render
    this.menuElem.style.cssText = "opacity:0; display:block; min-width:0;";
    // Width must be at least 130px for the filter elements. Max height for the dropdown is [filter (31px) + 9.5 * dropdown item (28px) = 297px]
    // Don't need to add 12px if showing info icons and scrollbar isn't needed. The scrollbar isn't needed if: menuElem height + filter input (25px) < 297px
    this.currentValueElem.style.width = `${this.measuredCurrentValueWidth()}px`;
    this.menuElem.style.cssText = "right:0; overflow-y:auto; max-height:297px;";
    if (this.dropdownVisible) this.filter();
  }

  private renderOption(option: DropdownOption, index: number) {
    const isSelected = this.isOptionIndexSelected(index);
    const className = isSelected ? "dropdownOption selected" : "dropdownOption";
    const title = this.showInfo ? ` title="${escapeHtml(option.value)}"` : "";
    return `<div class="${className}" data-id="${index}"${title}>${this.renderOptionCheck(
      isSelected
    )}${escapeHtml(option.name)}${this.renderOptionInfo(option.value)}</div>`;
  }

  private isOptionIndexSelected(index: number) {
    if (this.multiple) return this.selectedOptions.has(index);
    return this.selectedOption === index;
  }

  private renderOptionCheck(isSelected: boolean) {
    if (!this.multiple) return "";
    const check = isSelected ? "&#10003;" : "";
    return `<span class="dropdownOptionCheck">${check}</span>`;
  }

  private renderOptionInfo(value: string) {
    if (!this.showInfo) return "";
    const escapedValue = escapeHtml(value);
    return `<div class="dropdownOptionInfo" title="${escapedValue}">${svgIcons.info}</div>`;
  }

  private measuredCurrentValueWidth() {
    const needsScrollbarPadding = !this.showInfo || this.menuElem.offsetHeight >= 272;
    const scrollbarPadding = needsScrollbarPadding ? 12 : 0;
    return Math.max(this.menuElem.offsetWidth + scrollbarPadding, 130);
  }

  private filter() {
    const val = this.filterInput.value.toLowerCase();
    let matches = false;
    for (let i = 0; i < this.options.length; i++) {
      const match = this.options[i].name.toLowerCase().includes(val);
      (<HTMLElement>this.optionsElem.children[i]).style.display = match ? "block" : "none";
      if (match) matches = true;
    }
    this.filterInput.style.display = "block";
    this.noResultsElem.style.display = matches ? "none" : "block";
  }

  public close() {
    this.elem.classList.remove("dropdownOpen");
    this.dropdownVisible = false;
  }
}
