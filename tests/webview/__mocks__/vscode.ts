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
export const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3
} as const;

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
type MockUri = {
  fsPath?: string;
  path?: string;
  query?: string;
  value?: string;
  toString?: () => string;
};

export const openedTextDocuments: MockUri[] = [];
export const openedExternalUris: Array<{ toString: () => string; value?: string }> = [];
export const shownTextDocuments: Array<{
  document: { uri: MockUri };
  options: unknown;
}> = [];
export const shownOpenDialogs: unknown[] = [];
export const openDialogResults: Array<MockUri[] | undefined | Error> = [];
export const shownSaveDialogs: unknown[] = [];
export const saveDialogResults: Array<MockUri | undefined | Error> = [];
export const shownWarningMessages: unknown[][] = [];
export const warningMessageResults: Array<string | undefined | Error> = [];
export const configurationGlobalValues = new Map<string, unknown>();
export const configurationWorkspaceValues = new Map<string, unknown>();
export const configurationWorkspaceFolderValues = new Map<string, unknown>();
export const configurationUpdates: Array<{
  section: string;
  key: string;
  value: unknown;
  target: unknown;
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
  language: "en",
  openExternal: async (uri: { toString: () => string; value?: string }) => {
    openedExternalUris.push(uri);
    return true;
  }
};

export const workspace = {
  getConfiguration: (section = "") => ({
    get: <T>(key: string, defaultValue?: T) => {
      const fullKey = configurationKey(section, key);
      if (configurationWorkspaceFolderValues.has(fullKey)) {
        return configurationWorkspaceFolderValues.get(fullKey) as T;
      }
      if (configurationWorkspaceValues.has(fullKey))
        return configurationWorkspaceValues.get(fullKey) as T;
      if (configurationGlobalValues.has(fullKey))
        return configurationGlobalValues.get(fullKey) as T;
      return defaultValue as T;
    },
    inspect: <T>(key: string) => {
      const fullKey = configurationKey(section, key);
      return {
        globalValue: configurationGlobalValues.get(fullKey) as T | undefined,
        workspaceValue: configurationWorkspaceValues.get(fullKey) as T | undefined,
        workspaceFolderValue: configurationWorkspaceFolderValues.get(fullKey) as T | undefined
      };
    },
    update: async (key: string, value: unknown, target: unknown) => {
      configurationUpdates.push({ section, key, value, target });
      const fullKey = configurationKey(section, key);
      if (target === ConfigurationTarget.WorkspaceFolder) {
        setMapValue(configurationWorkspaceFolderValues, fullKey, value);
      } else if (target === ConfigurationTarget.Workspace) {
        setMapValue(configurationWorkspaceValues, fullKey, value);
      } else {
        setMapValue(configurationGlobalValues, fullKey, value);
      }
    }
  }),
  openTextDocument: async (uri: MockUri) => {
    openedTextDocuments.push(uri);
    return { uri };
  }
};

export const window = {
  showOpenDialog: async (options: unknown) => {
    shownOpenDialogs.push(options);
    const next = openDialogResults.shift();
    if (next instanceof Error) throw next;
    return next;
  },
  showSaveDialog: async (options: unknown) => {
    shownSaveDialogs.push(options);
    const next = saveDialogResults.shift();
    if (next instanceof Error) throw next;
    return next;
  },
  showWarningMessage: async (...args: unknown[]) => {
    shownWarningMessages.push(args);
    const next = warningMessageResults.shift();
    if (next instanceof Error) throw next;
    return next;
  },
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

export function setConfigurationValue(
  section: string,
  key: string,
  value: unknown,
  scope: "global" | "workspace" | "workspaceFolder" = "global"
) {
  const fullKey = configurationKey(section, key);
  if (scope === "workspaceFolder") {
    setMapValue(configurationWorkspaceFolderValues, fullKey, value);
  } else if (scope === "workspace") {
    setMapValue(configurationWorkspaceValues, fullKey, value);
  } else {
    setMapValue(configurationGlobalValues, fullKey, value);
  }
}

export function resetVscodeMock() {
  executedCommands.splice(0);
  openedTextDocuments.splice(0);
  openedExternalUris.splice(0);
  shownTextDocuments.splice(0);
  shownOpenDialogs.splice(0);
  openDialogResults.splice(0);
  shownSaveDialogs.splice(0);
  saveDialogResults.splice(0);
  shownWarningMessages.splice(0);
  warningMessageResults.splice(0);
  configurationGlobalValues.clear();
  configurationWorkspaceValues.clear();
  configurationWorkspaceFolderValues.clear();
  configurationUpdates.splice(0);
  createdTerminals.splice(0);
}

function configurationKey(section: string, key: string) {
  return section === "" ? key : `${section}.${key}`;
}

function setMapValue(map: Map<string, unknown>, key: string, value: unknown) {
  if (value === undefined) {
    map.delete(key);
  } else {
    map.set(key, value);
  }
}
