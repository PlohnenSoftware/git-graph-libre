import { escapeHtml } from "@/webview/utils/html";
import type { LocalizedStrings } from "./webviewL10n";

export function buildStartupScreen(strings: LocalizedStrings, styleVars: string): string {
  return `<body class="unableToLoad repositoryStartup" style="${styleVars}">
    <main>
      <h2 id="startupTitle">${escapeHtml(strings.startupChecking)}</h2>
      <p id="startupSummary" role="status" aria-live="polite"></p>
      <div id="startupRepositories"></div>
      <form id="startupSearchDepth" hidden>
        <label for="repoSearchDepth">${escapeHtml(strings.startupSearchDepth)}</label>
        <input id="repoSearchDepth" type="number" min="0" max="20" step="1" required aria-describedby="searchDepthHint">
        <button type="submit">${escapeHtml(strings.startupSearchAgain)}</button>
        <p id="searchDepthHint">${escapeHtml(strings.startupSearchDepthHint)}</p>
      </form>
      <div class="startupActions">
        <button id="retryRepositories" type="button">${escapeHtml(strings.startupRetry)}</button>
        <button id="openGitSettings" type="button">${escapeHtml(strings.startupGitSettings)}</button>
        <button id="showOutput" type="button">${escapeHtml(strings.startupShowOutput)}</button>
      </div>
      <section id="startupComponents" class="startupComponents"></section>
    </main>
  </body>`;
}
