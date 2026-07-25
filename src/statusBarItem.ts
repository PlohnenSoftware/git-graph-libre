import * as vscode from "vscode";

import type { Config } from "./config";
import type { Logger } from "./extension/utils/logger";
import * as l10n from "./l10n";

export class StatusBarItem {
  private readonly statusBarItem: vscode.StatusBarItem;
  private numRepos: number = 0;
  private readonly config: Config;
  private readonly logger: Logger | undefined;

  constructor(context: vscode.ExtensionContext, config: Config, logger?: Logger) {
    this.config = config;
    this.logger = logger;
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
    this.statusBarItem.name = l10n.t("statusBar.text");
    this.statusBarItem.command = "git-graph-libre.view";
    context.subscriptions.push(this.statusBarItem);
    this.refresh();
  }

  public setNumRepos(numRepos: number) {
    this.numRepos = numRepos;
    this.refresh();
  }

  public refresh() {
    const name = l10n.t("statusBar.text");
    if (!this.config.showStatusBarItem()) {
      this.logger?.log(`[statusBar] hide (showStatusBarItem=false, numRepos=${this.numRepos})`);
      this.statusBarItem.hide();
      return;
    }

    // Stay visible with no repository, so the extension does not simply vanish
    // in a non-Git folder. The eye says it is still watching for one.
    if (this.numRepos === 0) {
      this.statusBarItem.text = `$(eye) ${name}`;
      this.statusBarItem.tooltip = l10n.t("statusBar.tooltipWatching");
    } else {
      this.statusBarItem.text = `$(type-hierarchy) ${name}`;
      this.statusBarItem.tooltip = l10n.t("statusBar.tooltip");
    }
    this.logger?.log(`[statusBar] show (numRepos=${this.numRepos})`);
    this.statusBarItem.show();
  }
}
