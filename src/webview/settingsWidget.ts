import type { GitRepoConfig } from "@/backend/types";
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
};

export type SettingsWidgetModel = {
  repo: string;
  repoState: GitRepoState;
  config: GitRepoConfig;
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

export function renderSettingsWidget(model: SettingsWidgetModel) {
  const labels = model.labels;
  const repoName = getRepoDisplayName(model.repo, model.repoState);
  const hasDetails = hasUserDetails(model.config);
  return `<div class="settingsWidgetHeader">
      <h2>${escapeHtml(labels.title)}</h2>
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
    </section>`;
}
