import * as fs from "node:fs";
import * as path from "node:path";

// Load English translations from bundle.l10n.json
const l10nPath = path.resolve(__dirname, "../../../l10n/bundle.l10n.json");
const translations: Record<string, string> = JSON.parse(fs.readFileSync(l10nPath, "utf8"));

export const l10n = {
  t: (
    key: string,
    ...args: Array<string | number | boolean | Record<string, string | number | boolean>>
  ): string => {
    const template = translations[key] || key;

    // Handle object arguments (named parameters)
    if (args.length === 1 && typeof args[0] === "object" && !Array.isArray(args[0])) {
      return template.replace(/\{(\w+)\}/g, (_, name: string) => {
        const value = (args[0] as Record<string, string | number | boolean>)[name];
        return value !== undefined ? String(value) : `{${name}}`;
      });
    }

    // Handle positional arguments {0}, {1}, etc.
    if (args.length > 0) {
      return template.replace(/\{(\d+)\}/g, (_, index) => {
        const value = args[parseInt(index, 10)];
        return value !== undefined ? String(value) : `{${index}}`;
      });
    }

    return template;
  },
  uri: undefined
};

export const version = "1.98.0";

export const Uri = {
  file: (fsPath: string) => ({ fsPath }),
  parse: (value: string) => {
    const [schemeAndPath, query = ""] = value.split("?");
    return {
      path: schemeAndPath.replace(/^[^:]+:/, ""),
      query,
      value,
      toString: () => value
    };
  }
};

export const executedCommands: unknown[][] = [];
export const openedTextDocuments: Array<{ fsPath: string }> = [];
export const openedExternalUris: Array<{ toString: () => string; value?: string }> = [];
export const shownTextDocuments: Array<{
  document: { uri: { fsPath: string } };
  options: unknown;
}> = [];
export const createdTerminals: Array<{
  options: unknown;
  shown: boolean;
  sentText: string[];
}> = [];

export const commands = {
  executeCommand: async (...args: unknown[]) => {
    executedCommands.push(args);
  }
};

export const env = {
  openExternal: async (uri: { toString: () => string; value?: string }) => {
    openedExternalUris.push(uri);
    return true;
  }
};

export const workspace = {
  openTextDocument: async (uri: { fsPath: string }) => {
    openedTextDocuments.push(uri);
    return { uri };
  }
};

export const window = {
  createTerminal: (options: unknown) => {
    const terminal = {
      options,
      shown: false,
      sentText: [] as string[]
    };
    createdTerminals.push(terminal);
    return {
      show: () => {
        terminal.shown = true;
      },
      sendText: (text: string) => {
        terminal.sentText.push(text);
      }
    };
  },
  showTextDocument: async (document: { uri: { fsPath: string } }, options: unknown) => {
    shownTextDocuments.push({ document, options });
  }
};

export function resetVscodeMock() {
  executedCommands.splice(0);
  openedTextDocuments.splice(0);
  openedExternalUris.splice(0);
  shownTextDocuments.splice(0);
  createdTerminals.splice(0);
}
