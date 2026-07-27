import type * as GGL from "@/types";

const vscode = acquireVsCodeApi();

export { vscode };

export function sendMessage(msg: GGL.RequestMessage) {
  vscode.postMessage(msg);
}
export function getVSCodeStyle(name: string) {
  return document.documentElement.style.getPropertyValue(name);
}
