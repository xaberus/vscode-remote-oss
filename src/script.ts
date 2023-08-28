import * as vscode from "vscode";
import * as child_process from "child_process";
import * as EventEmitter from "events";

/**
 * Events:
 * - ready: when the script is ready, varies per script.
 * - exit: ChildProcess exit event
 */
export class CustomScript extends EventEmitter {
  constructor(private signal: AbortController) {
    super();
  }

  /** Terminate the running script. */
  terminate() {
    this.signal.abort();
  }
}

export type RunScriptArgs = {
  cwd: string;
  script: string;
  env?: Record<string, string>;
  output: vscode.OutputChannel;
  readyRegexp?: string;
};

export function runScript({
  cwd,
  script,
  env,
  output,
  readyRegexp: readyRegexpStr,
}: RunScriptArgs): CustomScript {
  const readyRegexp = readyRegexpStr ? new RegExp(readyRegexpStr) : undefined;
  const abortController = new AbortController();
  const child = child_process.spawn(script, {
    cwd,
    env,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    signal: abortController.signal,
  } as child_process.SpawnOptionsWithStdioTuple<
    child_process.StdioNull,
    child_process.StdioPipe,
    child_process.StdioPipe
  >);
  const customScript = new CustomScript(abortController);
  child.stdout.on("data", (data) => {
    output.append(data.toString("utf-8"));
    if (readyRegexp && readyRegexp.test(data.toString("utf-8"))) {
      customScript.emit("ready");
    }
  });
  child.stderr.on("data", (data) => {
    output.append(data.toString("utf-8"));
    if (readyRegexp && readyRegexp.test(data.toString("utf-8"))) {
      customScript.emit("ready");
    }
  });
  child.on("error", (err) => {
    output.appendLine(`Failed to run script: ${err}`);
  });
  child.on("exit", (code, signal) => {
    if (code !== 0) {
      output.appendLine(
        `Script failed with exit code ${code} ${signal ? ` (${signal})` : ""}`
      );
    }
    customScript.emit("exit", code, signal);
  });
  return customScript;
}
