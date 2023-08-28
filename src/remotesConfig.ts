export enum HostKind {
  Manual = "manual",
  Script = "script",
}

export interface ExtendedHostFolder {
  name: string;
  path: string;
}

export type HostFolder = string | ExtendedHostFolder;
export interface HostConfigBase {
  type: string;
  name: string;
  folders?: [HostFolder];
}

export interface ManualHostConfig extends HostConfigBase {
  type: HostKind.Manual;
  host: string;
  port: number;
  connectionToken?: string | boolean;
}

export interface ScriptHostConfig extends HostConfigBase {
  type: HostKind.Script;
  host: string;
  port: number;
  connectionToken?: string | boolean;
  localDirectory: string;
  listenScript: string;
  listenScriptReady?: string;
}

export type HostConfig = ManualHostConfig | ScriptHostConfig;
