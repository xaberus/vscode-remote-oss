import * as vscode from "vscode";
import type { Host, HostBase } from "./remotesView";
import { ScriptHostItem } from "./remotesView";
import { type CustomScript, runScript } from "./script";

async function pickToken(): Promise<string | undefined> {
  const raw = await vscode.window.showInputBox({
    placeHolder: "enter the connection token",
    password: true,
  });
  return raw;
}

export class RemoteResolver {
  private listener: CustomScript | undefined = undefined;

  constructor(
    private host: Host,
    private progress: vscode.Progress<{ message?: string; increment?: number }>,
    private output: vscode.OutputChannel
  ) {}

  initialize(): Promise<void> {
    return this._startListener();
    this.progress.report({ message: "connecting", increment: 50 });
    this.output.appendLine(`connecting to ${this.host.name}...`);
  }

  dispose() {
    this.listener?.terminate();
    this.listener = undefined;
  }

  async resolveAuthority(): Promise<vscode.ResolvedAuthority> {
    if (this.host.connectionToken === true) {
      const token = await pickToken();
      if (!token) {
        throw new Error("no token specified");
      }
      return new vscode.ResolvedAuthority(
        this.host.host,
        this.host.port,
        token
      );
    } else {
      return new vscode.ResolvedAuthority(
        this.host.host,
        this.host.port,
        this.host.connectionToken || undefined
      );
    }
  }

  _startListener(): Promise<void> {
    if (this.host instanceof ScriptHostItem) {
      this.progress.report({ message: "running listen script", increment: 0 });
      const host: ScriptHostItem = this.host;
      this.output.appendLine(`listenScript: ${host.listenScript}`);
      const listener = runScript({
        cwd: host.localDirectory,
        script: host.listenScript,
        output: this.output,
        readyRegexp: host.listenScriptReady,
      });
      this.listener = listener;
      return new Promise((resolve, reject) => {
        listener.once("ready", () => {
          this.output.appendLine("listenScript is ready");
          resolve();
        });
        listener.once("exit", (code) => {
          if (code === 0) {
            // Process exited successfully, assume that it's listening now?
            this.output.appendLine("listenScript finished without error");
            resolve();
          } else {
            reject(new Error("listenScript failed"));
          }
        });
      });
    } else {
      return Promise.resolve();
    }
  }
}
