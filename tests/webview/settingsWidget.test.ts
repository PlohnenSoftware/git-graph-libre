import { describe, expect, it } from "vitest";

import type { GitRepoConfig } from "@/backend/types";
import type { ExtensionSetting, GitRepoState } from "@/types";
import { renderSettingsWidget, type SettingsWidgetModel } from "@/webview/settingsWidget";

const repoState: GitRepoState = { columnWidths: null };
const config: GitRepoConfig = {
  userName: { local: null, global: "Ada" },
  userEmail: { local: null, global: "ada@example.test" }
};

const labels: SettingsWidgetModel["labels"] = {
  title: "Repository Settings",
  close: "Close settings",
  repositoryTab: "Repository",
  extensionTab: "Extension",
  general: "General",
  repositoryName: "Repository name",
  edit: "Edit",
  clear: "Clear",
  showRemoteBranches: "Show remote branches",
  showStashes: "Show stashes",
  showTags: "Show tags",
  includeReflog: "Include reflog",
  onlyFollowFirstParent: "Only follow first parent",
  defaultOn: "Default: On",
  defaultOff: "Default: Off",
  enabled: "Enabled",
  disabled: "Disabled",
  userDetails: "User Details",
  userName: "User name",
  userEmail: "User email",
  local: "Local",
  global: "Global",
  notSet: "Not set",
  addUserDetails: "Add user details",
  editUserDetails: "Edit user details",
  removeUserDetails: "Remove user details",
  remoteConfiguration: "Remote Configuration",
  remoteFetchUrl: "Fetch URL",
  remotePushUrl: "Push URL",
  remoteHidden: "Hidden",
  remoteVisible: "Visible",
  addRemote: "Add remote",
  editRemote: "Edit remote",
  deleteRemote: "Delete remote",
  fetchRemote: "Fetch",
  pruneRemote: "Prune",
  hideRemote: "Hide",
  showRemote: "Show",
  noRemotes: "No remotes",
  issueLinking: "Issue Linking",
  issuePattern: "Issue pattern",
  issueUrlTemplate: "Issue URL template",
  noIssueLinking: "No issue linking",
  addIssueLinking: "Add issue linking",
  removeIssueLinking: "Remove issue linking",
  pullRequestCreation: "Pull Request Creation",
  pullRequestRemote: "Remote",
  pullRequestBaseBranch: "Base branch",
  pullRequestUrlTemplate: "URL template",
  pullRequestPushBeforeCreate: "Push before create",
  noPullRequestCreation: "No pull request creation",
  configurePullRequest: "Configure pull request",
  removePullRequest: "Remove pull request",
  repositoryConfiguration: "Repository Configuration",
  exportRepositoryConfiguration: "Export Repository Configuration",
  importRepositoryConfiguration: "Import Repository Configuration",
  extensionSettings: "Extension Settings",
  extensionSettingsLoading: "Loading extension settings...",
  extensionScopeDefault: "Default",
  extensionScopeGlobal: "Global",
  extensionScopeWorkspace: "Workspace",
  extensionScopeWorkspaceFolder: "Workspace Folder",
  extensionJsonEdit: "Edit JSON",
  extensionGraphColors: "Graph colors",
  extensionGraphColorsPreview: "Graph colors preview",
  extensionGraphColorsLightness: "Lightness",
  extensionGraphColorsChroma: "Chroma",
  exportExtensionSettings: "Export Extension Settings",
  importExtensionSettings: "Import Extension Settings"
};

function setting(partial: Partial<ExtensionSetting> & Pick<ExtensionSetting, "key" | "configKey">) {
  return {
    title: partial.configKey,
    description: "",
    type: "string" as const,
    value: "",
    defaultValue: "",
    scope: "default" as const,
    ...partial
  };
}

function render(extensionSettings: ExtensionSetting[] | null) {
  return renderSettingsWidget({
    repo: "/workspace/project",
    repoState,
    config,
    remotes: [],
    defaults: {
      includeReflog: false,
      onlyFollowFirstParent: false,
      showRemoteBranches: true,
      showStashes: true,
      showTags: true
    },
    activeTab: "extension",
    extensionSettings,
    labels
  });
}

describe("settings widget rendering", () => {
  it("renders the extension tab loading state", () => {
    const html = render(null);

    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("Loading extension settings...");
    expect(html).toContain("settingsRepositoryPanel");
  });

  it("renders generic extension editors without object stringification", () => {
    const html = render([
      setting({
        key: "git-graph-libre.repository.showTags",
        configKey: "repository.showTags",
        type: "boolean",
        value: true,
        defaultValue: true,
        scope: "global"
      }),
      setting({
        key: "git-graph-libre.graph.fontSize",
        configKey: "graph.fontSize",
        type: "number",
        value: 17,
        defaultValue: 13,
        minimum: 8,
        maximum: 24
      }),
      setting({
        key: "git-graph-libre.dateType",
        configKey: "dateType",
        type: "string",
        value: "Commit Date",
        defaultValue: "Author Date",
        enum: ["Author Date", "Commit Date"],
        enumDescriptions: ["Author date", "Commit date"]
      }),
      setting({
        key: "git-graph-libre.invalidString",
        configKey: "invalidString",
        type: "string",
        value: { nested: true },
        defaultValue: ""
      }),
      setting({
        key: "git-graph-libre.customBranchGlobPatterns",
        configKey: "customBranchGlobPatterns",
        type: "array",
        value: [{ name: "Feature", glob: "--glob=heads/feature/*" }],
        defaultValue: []
      }),
      setting({
        key: "git-graph-libre.graphColors",
        configKey: "graphColors",
        type: "array",
        value: ["oklch(63% 0.2 245)", "#ff0000"],
        defaultValue: []
      })
    ]);

    expect(html).toContain('type="checkbox"');
    expect(html).toContain('value="17" min="8" max="24"');
    expect(html).toContain('<option value="Commit Date" selected>Commit date</option>');
    expect(html).toContain("Edit JSON");
    expect(html).toContain("--glob=heads&#x2F;feature&#x2F;*");
    expect(html).toContain("settingsColorSwatch");
    expect(html).toContain('data-channel="lightness"');
    expect(html).not.toContain("[object Object]");
  });
});
