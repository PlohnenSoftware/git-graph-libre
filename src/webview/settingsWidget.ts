import type { GitRemote, GitRepoConfig } from "@/backend/types";
import { octicon } from "@/octicons";
import type {
  ExtensionSetting,
  GitRepoState,
  RepoBooleanOverride,
  SettingsWidgetTab
} from "@/types";

import { escapeHtml } from "./utils/html";
import { toOklch } from "./utils/oklchColor";

export const REPO_BOOLEAN_OVERRIDES = ["default", "enabled", "disabled"] as const;
export type RepoBooleanSettingKey =
  | "includeReflog"
  | "includeUnreachableCommits"
  | "onlyFollowFirstParent"
  | "showRemoteBranches"
  | "showStashes"
  | "showTags";

type SettingsLabels = {
  title: string;
  close: string;
  repositoryTab: string;
  extensionTab: string;
  general: string;
  repositoryName: string;
  edit: string;
  clear: string;
  showRemoteBranches: string;
  showStashes: string;
  showTags: string;
  includeReflog: string;
  includeUnreachableCommits: string;
  onlyFollowFirstParent: string;
  defaultOn: string;
  defaultOff: string;
  enabled: string;
  disabled: string;
  userDetails: string;
  userName: string;
  userEmail: string;
  local: string;
  global: string;
  notSet: string;
  addUserDetails: string;
  editUserDetails: string;
  removeUserDetails: string;
  remoteConfiguration: string;
  remoteFetchUrl: string;
  remotePushUrl: string;
  remoteHidden: string;
  remoteVisible: string;
  addRemote: string;
  editRemote: string;
  deleteRemote: string;
  fetchRemote: string;
  pruneRemote: string;
  hideRemote: string;
  showRemote: string;
  noRemotes: string;
  issueLinking: string;
  issuePattern: string;
  issueUrlTemplate: string;
  noIssueLinking: string;
  addIssueLinking: string;
  removeIssueLinking: string;
  pullRequestCreation: string;
  pullRequestRemote: string;
  pullRequestBaseBranch: string;
  pullRequestUrlTemplate: string;
  pullRequestPushBeforeCreate: string;
  noPullRequestCreation: string;
  configurePullRequest: string;
  removePullRequest: string;
  repositoryConfiguration: string;
  exportRepositoryConfiguration: string;
  importRepositoryConfiguration: string;
  extensionSettings: string;
  extensionSettingsLoading: string;
  extensionScopeDefault: string;
  extensionScopeGlobal: string;
  extensionScopeWorkspace: string;
  extensionScopeWorkspaceFolder: string;
  extensionJsonEdit: string;
  extensionGraphColors: string;
  extensionGraphColorsPreview: string;
  extensionGraphColorsLightness: string;
  extensionGraphColorsChroma: string;
  exportExtensionSettings: string;
  importExtensionSettings: string;
};

export type SettingsWidgetModel = {
  repo: string;
  repoState: GitRepoState;
  config: GitRepoConfig;
  remotes: GitRemote[];
  defaults: Record<RepoBooleanSettingKey, boolean>;
  activeTab: SettingsWidgetTab;
  extensionSettings: ExtensionSetting[] | null;
  labels: SettingsLabels;
};

const booleanSettingOrder: Array<{ key: RepoBooleanSettingKey; label: keyof SettingsLabels }> = [
  { key: "showRemoteBranches", label: "showRemoteBranches" },
  { key: "showStashes", label: "showStashes" },
  { key: "showTags", label: "showTags" },
  { key: "includeReflog", label: "includeReflog" },
  { key: "includeUnreachableCommits", label: "includeUnreachableCommits" },
  { key: "onlyFollowFirstParent", label: "onlyFollowFirstParent" }
];

export function normalizeRepoBooleanOverride(value: unknown): RepoBooleanOverride {
  return (REPO_BOOLEAN_OVERRIDES as readonly unknown[]).includes(value)
    ? (value as RepoBooleanOverride)
    : "default";
}

export function resolveRepoBooleanOverride(
  value: RepoBooleanOverride | undefined,
  defaultValue: boolean
): boolean {
  const normalized = normalizeRepoBooleanOverride(value);
  if (normalized === "default") return defaultValue;
  return normalized === "enabled";
}

export function getRepoBasename(repo: string) {
  const normalized = repo.replaceAll("\\", "/");
  const parts = normalized.split("/").filter((part) => part !== "");
  return parts.at(-1) ?? repo;
}

export function getRepoDisplayName(repo: string, repoState: GitRepoState) {
  const displayName = repoState.displayName?.trim();
  return displayName === undefined || displayName === "" ? getRepoBasename(repo) : displayName;
}

function selectedAttr(value: string, selected: string) {
  return value === selected ? " selected" : "";
}

function renderOverrideSelect(model: SettingsWidgetModel, key: RepoBooleanSettingKey) {
  const labels = model.labels;
  const current = normalizeRepoBooleanOverride(model.repoState[key]);
  const defaultLabel = model.defaults[key] ? labels.defaultOn : labels.defaultOff;
  return `<select class="settingsOverrideSelect" data-setting="${key}">
    <option value="default"${selectedAttr("default", current)}>${escapeHtml(defaultLabel)}</option>
    <option value="enabled"${selectedAttr("enabled", current)}>${escapeHtml(labels.enabled)}</option>
    <option value="disabled"${selectedAttr("disabled", current)}>${escapeHtml(labels.disabled)}</option>
  </select>`;
}

function renderBooleanSettingRows(model: SettingsWidgetModel) {
  return booleanSettingOrder
    .map(
      (setting) => `<div class="settingsRow">
        <span>${escapeHtml(String(model.labels[setting.label]))}</span>
        ${renderOverrideSelect(model, setting.key)}
      </div>`
    )
    .join("");
}

function configValueText(
  value: { local: string | null; global: string | null },
  labels: SettingsLabels
) {
  if (value.local !== null) return { text: value.local, scope: labels.local };
  if (value.global !== null) return { text: value.global, scope: labels.global };
  return { text: labels.notSet, scope: "" };
}

function renderConfigValue(
  value: { local: string | null; global: string | null },
  labels: SettingsLabels
) {
  const details = configValueText(value, labels);
  const scope =
    details.scope === "" ? "" : `<span class="settingsScope">${escapeHtml(details.scope)}</span>`;
  return `<span class="settingsValue" title="${escapeHtml(details.text)}">${escapeHtml(details.text)}</span>${scope}`;
}

function hasUserDetails(config: GitRepoConfig) {
  return (
    config.userName.local !== null ||
    config.userName.global !== null ||
    config.userEmail.local !== null ||
    config.userEmail.global !== null
  );
}

function firstRemoteUrl(urls: string[]) {
  return urls[0] ?? "";
}

function renderRemoteUrl(value: string, labels: SettingsLabels) {
  const text = value === "" ? labels.notSet : value;
  return `<span class="settingsValue" title="${escapeHtml(text)}">${escapeHtml(text)}</span>`;
}

function isRemoteHidden(remote: GitRemote, repoState: GitRepoState) {
  return (repoState.hiddenRemotes ?? []).includes(remote.name);
}

function renderRemoteRows(model: SettingsWidgetModel) {
  if (model.remotes.length === 0) {
    return `<div class="settingsRow settingsRowFull">${escapeHtml(model.labels.noRemotes)}</div>`;
  }

  return model.remotes
    .map((remote) => {
      const hidden = isRemoteHidden(remote, model.repoState);
      return `<div class="settingsRemoteRow" data-remote="${escapeHtml(remote.name)}">
        <div class="settingsRemoteSummary">
          <span class="settingsValue" title="${escapeHtml(remote.name)}">${escapeHtml(remote.name)}</span>
          <span class="settingsScope">${escapeHtml(hidden ? model.labels.remoteHidden : model.labels.remoteVisible)}</span>
        </div>
        <div class="settingsRemoteUrls">
          <span>${escapeHtml(model.labels.remoteFetchUrl)}</span>
          ${renderRemoteUrl(firstRemoteUrl(remote.fetchUrls), model.labels)}
          <span>${escapeHtml(model.labels.remotePushUrl)}</span>
          ${renderRemoteUrl(firstRemoteUrl(remote.pushUrls), model.labels)}
        </div>
        <div class="settingsActions">
          <button class="settingsTextButton settingsToggleRemoteVisibility" type="button" data-remote="${escapeHtml(remote.name)}">${escapeHtml(hidden ? model.labels.showRemote : model.labels.hideRemote)}</button>
          <button class="settingsTextButton settingsFetchRemote" type="button" data-remote="${escapeHtml(remote.name)}">${escapeHtml(model.labels.fetchRemote)}</button>
          <button class="settingsTextButton settingsPruneRemote" type="button" data-remote="${escapeHtml(remote.name)}">${escapeHtml(model.labels.pruneRemote)}</button>
          <button class="settingsTextButton settingsEditRemote" type="button" data-remote="${escapeHtml(remote.name)}">${escapeHtml(model.labels.editRemote)}</button>
          <button class="settingsTextButton danger settingsDeleteRemote" type="button" data-remote="${escapeHtml(remote.name)}">${escapeHtml(model.labels.deleteRemote)}</button>
        </div>
      </div>`;
    })
    .join("");
}

function renderIssueLinkingSection(model: SettingsWidgetModel) {
  const labels = model.labels;
  const config = model.repoState.issueLinking ?? null;
  const body =
    config === null
      ? `<div class="settingsRow settingsRowFull">${escapeHtml(labels.noIssueLinking)}</div>
        <div class="settingsActions">
          <button id="settingsEditIssueLinking" class="settingsTextButton" type="button">${escapeHtml(labels.addIssueLinking)}</button>
        </div>`
      : `<div class="settingsRow">
          <span>${escapeHtml(labels.issuePattern)}</span>
          <span class="settingsValue" title="${escapeHtml(config.pattern)}">${escapeHtml(config.pattern)}</span>
        </div>
        <div class="settingsRow">
          <span>${escapeHtml(labels.issueUrlTemplate)}</span>
          <span class="settingsValue" title="${escapeHtml(config.urlTemplate)}">${escapeHtml(config.urlTemplate)}</span>
        </div>
        <div class="settingsActions">
          <button id="settingsEditIssueLinking" class="settingsTextButton" type="button">${escapeHtml(labels.edit)}</button>
          <button id="settingsRemoveIssueLinking" class="settingsTextButton danger" type="button">${escapeHtml(labels.removeIssueLinking)}</button>
        </div>`;

  return `<section class="settingsSection">
    <h3>${escapeHtml(labels.issueLinking)}</h3>
    ${body}
  </section>`;
}

function renderPullRequestSection(model: SettingsWidgetModel) {
  const labels = model.labels;
  const config = model.repoState.pullRequest ?? null;
  let pushBeforeCreateLabel = "";
  if (config !== null) {
    pushBeforeCreateLabel = config.pushBeforeCreate ? labels.enabled : labels.disabled;
  }
  const body =
    config === null
      ? `<div class="settingsRow settingsRowFull">${escapeHtml(labels.noPullRequestCreation)}</div>
        <div class="settingsActions">
          <button id="settingsEditPullRequest" class="settingsTextButton" type="button">${escapeHtml(labels.configurePullRequest)}</button>
        </div>`
      : `<div class="settingsRow">
          <span>${escapeHtml(labels.pullRequestRemote)}</span>
          <span class="settingsValue" title="${escapeHtml(config.remoteName)}">${escapeHtml(config.remoteName)}</span>
        </div>
        <div class="settingsRow">
          <span>${escapeHtml(labels.pullRequestBaseBranch)}</span>
          <span class="settingsValue" title="${escapeHtml(config.baseBranch)}">${escapeHtml(config.baseBranch)}</span>
        </div>
        <div class="settingsRow">
          <span>${escapeHtml(labels.pullRequestUrlTemplate)}</span>
          <span class="settingsValue" title="${escapeHtml(config.urlTemplate)}">${escapeHtml(config.urlTemplate)}</span>
        </div>
        <div class="settingsRow">
          <span>${escapeHtml(labels.pullRequestPushBeforeCreate)}</span>
          <span class="settingsValue">${escapeHtml(pushBeforeCreateLabel)}</span>
        </div>
        <div class="settingsActions">
          <button id="settingsEditPullRequest" class="settingsTextButton" type="button">${escapeHtml(labels.edit)}</button>
          <button id="settingsRemovePullRequest" class="settingsTextButton danger" type="button">${escapeHtml(labels.removePullRequest)}</button>
        </div>`;

  return `<section class="settingsSection">
    <h3>${escapeHtml(labels.pullRequestCreation)}</h3>
    ${body}
  </section>`;
}

function renderRepositoryConfigurationSection(model: SettingsWidgetModel) {
  const labels = model.labels;
  return `<section class="settingsSection">
    <h3>${escapeHtml(labels.repositoryConfiguration)}</h3>
    <div class="settingsActions">
      <button id="settingsExportRepoConfig" class="settingsTextButton" type="button">${escapeHtml(labels.exportRepositoryConfiguration)}</button>
      <button id="settingsImportRepoConfig" class="settingsTextButton" type="button">${escapeHtml(labels.importRepositoryConfiguration)}</button>
    </div>
  </section>`;
}

function renderRepositoryTab(model: SettingsWidgetModel) {
  const labels = model.labels;
  const repoName = getRepoDisplayName(model.repo, model.repoState);
  const hasDetails = hasUserDetails(model.config);
  return `<section class="settingsSection">
      <h3>${escapeHtml(labels.general)}</h3>
      <div class="settingsRow">
        <span>${escapeHtml(labels.repositoryName)}</span>
        <span class="settingsNameCell">
          <span class="settingsValue" title="${escapeHtml(model.repo)}">${escapeHtml(repoName)}</span>
          <button id="settingsEditRepoName" class="settingsTextButton" type="button">${escapeHtml(labels.edit)}</button>
          ${
            model.repoState.displayName === undefined || model.repoState.displayName === null
              ? ""
              : `<button id="settingsClearRepoName" class="settingsTextButton" type="button">${escapeHtml(labels.clear)}</button>`
          }
        </span>
      </div>
      ${renderBooleanSettingRows(model)}
    </section>
    <section class="settingsSection">
      <h3>${escapeHtml(labels.userDetails)}</h3>
      <div class="settingsRow">
        <span>${escapeHtml(labels.userName)}</span>
        <span>${renderConfigValue(model.config.userName, labels)}</span>
      </div>
      <div class="settingsRow">
        <span>${escapeHtml(labels.userEmail)}</span>
        <span>${renderConfigValue(model.config.userEmail, labels)}</span>
      </div>
      <div class="settingsActions">
        <button id="settingsEditUserDetails" class="settingsTextButton" type="button">${escapeHtml(hasDetails ? labels.editUserDetails : labels.addUserDetails)}</button>
        ${
          hasDetails
            ? `<button id="settingsRemoveUserDetails" class="settingsTextButton danger" type="button">${escapeHtml(labels.removeUserDetails)}</button>`
            : ""
        }
      </div>
    </section>
    <section class="settingsSection">
      <h3>${escapeHtml(labels.remoteConfiguration)}</h3>
      ${renderRemoteRows(model)}
      <div class="settingsActions">
        <button id="settingsAddRemote" class="settingsTextButton" type="button">${escapeHtml(labels.addRemote)}</button>
      </div>
    </section>
    ${renderIssueLinkingSection(model)}
    ${renderPullRequestSection(model)}
    ${renderRepositoryConfigurationSection(model)}`;
}

function renderExtensionTab(model: SettingsWidgetModel) {
  const labels = model.labels;
  if (model.extensionSettings === null) {
    return `<section class="settingsSection">
      <h3>${escapeHtml(labels.extensionSettings)}</h3>
      <div class="settingsRow settingsRowFull">${escapeHtml(labels.extensionSettingsLoading)}</div>
    </section>`;
  }

  return `<section class="settingsSection settingsExtensionActionsSection">
      <h3>${escapeHtml(labels.extensionSettings)}</h3>
      <div class="settingsActions">
        <button id="settingsExportExtensionSettings" class="settingsTextButton" type="button">${escapeHtml(labels.exportExtensionSettings)}</button>
        <button id="settingsImportExtensionSettings" class="settingsTextButton" type="button">${escapeHtml(labels.importExtensionSettings)}</button>
      </div>
    </section>
    <section class="settingsSection settingsExtensionList">
      <h3>${escapeHtml(labels.extensionSettings)}</h3>
      ${model.extensionSettings.map((setting) => renderExtensionSettingRow(setting, labels)).join("")}
    </section>`;
}

function renderExtensionSettingRow(setting: ExtensionSetting, labels: SettingsLabels) {
  const description =
    setting.description === ""
      ? ""
      : `<div class="settingsDescription">${escapeHtml(setting.description)}</div>`;
  return `<div class="settingsExtensionRow" data-setting-key="${escapeHtml(setting.key)}">
    <div class="settingsExtensionMeta">
      <span class="settingsValue" title="${escapeHtml(setting.key)}">${escapeHtml(setting.title)}</span>
      <span class="settingsScope">${escapeHtml(scopeLabel(setting.scope, labels))}</span>
      ${description}
    </div>
    <div class="settingsExtensionEditor">
      ${renderExtensionSettingEditor(setting, labels)}
    </div>
  </div>`;
}

function renderExtensionSettingEditor(setting: ExtensionSetting, labels: SettingsLabels) {
  if (setting.key === "git-graph-libre.graphColors")
    return renderGraphColorsEditor(setting, labels);
  if (setting.key === "git-graph-libre.revealHighlightColor")
    return renderColorStringEditor(setting);
  if (setting.enum !== undefined) return renderEnumEditor(setting);
  if (setting.type === "boolean") return renderBooleanEditor(setting);
  if (setting.type === "number") return renderNumberEditor(setting);
  if (setting.type === "string") return renderStringEditor(setting);
  return renderJsonEditor(setting, labels);
}

function renderBooleanEditor(setting: ExtensionSetting) {
  const checked = setting.value === true ? " checked" : "";
  return `<input class="settingsExtensionInput" type="checkbox" data-setting-key="${escapeHtml(setting.key)}" data-setting-type="boolean"${checked}>`;
}

function renderNumberEditor(setting: ExtensionSetting) {
  const minimum = setting.minimum === undefined ? "" : ` min="${setting.minimum}"`;
  const maximum = setting.maximum === undefined ? "" : ` max="${setting.maximum}"`;
  return `<input class="settingsExtensionInput settingsNumberInput" type="number" data-setting-key="${escapeHtml(setting.key)}" data-setting-type="number" value="${escapeHtml(scalarSettingValue(setting.value))}"${minimum}${maximum}>`;
}

function renderStringEditor(setting: ExtensionSetting) {
  return `<input class="settingsExtensionInput settingsStringInput" type="text" data-setting-key="${escapeHtml(setting.key)}" data-setting-type="string" value="${escapeHtml(scalarSettingValue(setting.value))}">`;
}

function renderColorStringEditor(setting: ExtensionSetting) {
  const value = scalarSettingValue(setting.value);
  return `<span class="settingsColorStringEditor">
    ${renderColorSwatch(value)}
    ${renderStringEditor(setting)}
  </span>`;
}

function renderEnumEditor(setting: ExtensionSetting) {
  const value = scalarSettingValue(setting.value);
  const options = setting.enum ?? [];
  return `<select class="settingsExtensionInput settingsEnumInput" data-setting-key="${escapeHtml(setting.key)}" data-setting-type="string">
    ${options
      .map((option, index) => {
        const selected = option === value ? " selected" : "";
        const label = setting.enumDescriptions?.[index] ?? option;
        return `<option value="${escapeHtml(option)}"${selected}>${escapeHtml(label)}</option>`;
      })
      .join("")}
  </select>`;
}

function renderJsonEditor(setting: ExtensionSetting, labels: SettingsLabels) {
  const value = JSON.stringify(setting.value, null, 2);
  return `<span class="settingsValue settingsJsonValue" title="${escapeHtml(value)}">${escapeHtml(value)}</span>
    <button class="settingsTextButton settingsEditJsonSetting" type="button" data-setting-key="${escapeHtml(setting.key)}">${escapeHtml(labels.extensionJsonEdit)}</button>`;
}

function renderGraphColorsEditor(setting: ExtensionSetting, labels: SettingsLabels) {
  const colors = Array.isArray(setting.value)
    ? setting.value.filter((value): value is string => typeof value === "string")
    : [];
  const firstColor = colors[0] === undefined ? null : toOklch(colors[0]);
  const lightness = firstColor?.l ?? 63;
  const chroma = firstColor?.c ?? 0.2;
  return `<div class="settingsGraphColorsEditor">
    <div class="settingsColorGrid" aria-label="${escapeHtml(labels.extensionGraphColors)}">
      ${colors.map((color) => renderColorSwatch(color)).join("")}
    </div>
    <div class="settingsColorPreview" aria-label="${escapeHtml(labels.extensionGraphColorsPreview)}">
      ${colors
        .slice(0, 8)
        .map((color) => `<span style="--settings-swatch:${escapeHtml(color)}"></span>`)
        .join("")}
    </div>
    <label class="settingsPaletteSliderRow">
      <span>${escapeHtml(labels.extensionGraphColorsLightness)}</span>
      <input class="settingsPaletteSlider" type="range" min="0" max="100" step="1" value="${escapeHtml(String(Math.round(lightness)))}" data-setting-key="${escapeHtml(setting.key)}" data-channel="lightness">
    </label>
    <label class="settingsPaletteSliderRow">
      <span>${escapeHtml(labels.extensionGraphColorsChroma)}</span>
      <input class="settingsPaletteSlider" type="range" min="0" max="0.4" step="0.01" value="${escapeHtml(String(Math.round(chroma * 100) / 100))}" data-setting-key="${escapeHtml(setting.key)}" data-channel="chroma">
    </label>
    ${renderJsonEditor(setting, labels)}
  </div>`;
}

function renderColorSwatch(color: string) {
  return `<span class="settingsColorSwatch" title="${escapeHtml(color)}" style="--settings-swatch:${escapeHtml(color)}"></span>`;
}

function scalarSettingValue(value: ExtensionSetting["value"]) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function scopeLabel(scope: ExtensionSetting["scope"], labels: SettingsLabels) {
  const scopeLabels: Record<ExtensionSetting["scope"], string> = {
    default: labels.extensionScopeDefault,
    global: labels.extensionScopeGlobal,
    workspace: labels.extensionScopeWorkspace,
    workspaceFolder: labels.extensionScopeWorkspaceFolder
  };
  return scopeLabels[scope];
}

function tabSelectedAttr(activeTab: SettingsWidgetTab, tab: SettingsWidgetTab) {
  return activeTab === tab ? "true" : "false";
}

function tabHiddenAttr(activeTab: SettingsWidgetTab, tab: SettingsWidgetTab) {
  return activeTab === tab ? "" : " hidden";
}

export function renderSettingsWidget(model: SettingsWidgetModel) {
  const labels = model.labels;
  return `<div class="settingsWidgetHeader">
      <h2>${escapeHtml(labels.title)}</h2>
      <button id="settingsCloseBtn" class="settingsCloseButton" type="button" title="${escapeHtml(labels.close)}" aria-label="${escapeHtml(labels.close)}">${octicon("x")}</button>
    </div>
    <div class="settingsTabs" role="tablist" aria-label="${escapeHtml(labels.title)}">
      <button id="settingsRepositoryTab" class="settingsTab" role="tab" type="button" aria-selected="${tabSelectedAttr(model.activeTab, "repository")}" aria-controls="settingsRepositoryPanel" tabindex="${model.activeTab === "repository" ? "0" : "-1"}" data-settings-tab="repository">${escapeHtml(labels.repositoryTab)}</button>
      <button id="settingsExtensionTab" class="settingsTab" role="tab" type="button" aria-selected="${tabSelectedAttr(model.activeTab, "extension")}" aria-controls="settingsExtensionPanel" tabindex="${model.activeTab === "extension" ? "0" : "-1"}" data-settings-tab="extension">${escapeHtml(labels.extensionTab)}</button>
    </div>
    <div id="settingsRepositoryPanel" class="settingsTabPanel" role="tabpanel" aria-labelledby="settingsRepositoryTab"${tabHiddenAttr(model.activeTab, "repository")}>
      ${renderRepositoryTab(model)}
    </div>
    <div id="settingsExtensionPanel" class="settingsTabPanel" role="tabpanel" aria-labelledby="settingsExtensionTab"${tabHiddenAttr(model.activeTab, "extension")}>
      ${renderExtensionTab(model)}
    </div>`;
}
