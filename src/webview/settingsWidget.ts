import type { GitRemote, GitRepoConfig } from "@/backend/types";
import type { GitRepoState, RepoBooleanOverride } from "@/types";

import { escapeHtml } from "./utils/html";

export const REPO_BOOLEAN_OVERRIDES = ["default", "enabled", "disabled"] as const;
export type RepoBooleanSettingKey =
  | "includeReflog"
  | "onlyFollowFirstParent"
  | "showRemoteBranches"
  | "showStashes"
  | "showTags";

type SettingsLabels = {
  title: string;
  close: string;
  general: string;
  repositoryName: string;
  edit: string;
  clear: string;
  showRemoteBranches: string;
  showStashes: string;
  showTags: string;
  includeReflog: string;
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
};

export type SettingsWidgetModel = {
  repo: string;
  repoState: GitRepoState;
  config: GitRepoConfig;
  remotes: GitRemote[];
  defaults: Record<RepoBooleanSettingKey, boolean>;
  labels: SettingsLabels;
};

const booleanSettingOrder: Array<{ key: RepoBooleanSettingKey; label: keyof SettingsLabels }> = [
  { key: "showRemoteBranches", label: "showRemoteBranches" },
  { key: "showStashes", label: "showStashes" },
  { key: "showTags", label: "showTags" },
  { key: "includeReflog", label: "includeReflog" },
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

export function renderSettingsWidget(model: SettingsWidgetModel) {
  const labels = model.labels;
  const repoName = getRepoDisplayName(model.repo, model.repoState);
  const hasDetails = hasUserDetails(model.config);
  return `<div class="settingsWidgetHeader">
      <h2>${escapeHtml(labels.title)}</h2>
      <button id="settingsCloseBtn" class="settingsCloseButton" type="button" title="${escapeHtml(labels.close)}" aria-label="${escapeHtml(labels.close)}">&times;</button>
    </div>
    <section class="settingsSection">
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
