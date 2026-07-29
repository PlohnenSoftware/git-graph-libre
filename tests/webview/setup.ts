import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import { buildWebviewStatusStrip } from "@/extension/webviewStatusStrip";
import { buildWebviewToolbar } from "@/extension/webviewToolbar";
import type * as GGL from "@/types";

export function createVscodeMock(initialState?: WebViewState | null) {
  const sent: GGL.RequestMessage[] = [];
  let state: WebViewState | null | undefined = initialState;

  const mock = {
    postMessage: (msg: GGL.RequestMessage) => sent.push(msg),
    getState: () => state,
    setState: (s: WebViewState) => {
      state = s;
    }
  };

  global.acquireVsCodeApi = () => mock;

  return {
    sentMessages: sent,
    clearMessages: () => sent.splice(0),
    getState: () => state
  };
}

export function setupHtml(viewState: GGL.GitGraphViewState) {
  const l10nStrings = getWebviewLocalizedStrings();
  document.body.innerHTML = `
    <div id="topBar">
    ${buildWebviewStatusStrip(l10nStrings, "1.2.0")}
    ${buildWebviewToolbar(l10nStrings)}
    </div>
    <div id="settingsWidgetBacking" hidden></div>
    <aside id="settingsWidget" role="dialog" aria-modal="true" tabindex="-1" aria-label="${l10nStrings.repositorySettings}" hidden></aside>
    <div id="content">
      <div id="commitGraph"></div>
      <div id="commitTable"></div>
    </div>
    <div id="footer"></div>
    <ul id="contextMenu" role="menu"></ul>
    <div id="dialogBacking"></div>
    <div id="dialog"></div>
  `;

  (global as unknown as { viewState: GGL.GitGraphViewState }).viewState = viewState;
  (global as unknown as { l10n: ReturnType<typeof getWebviewLocalizedStrings> }).l10n = l10nStrings;
}

export function receive(msg: GGL.ResponseMessage) {
  window.dispatchEvent(new MessageEvent("message", { data: msg, origin: window.location.origin }));
}
