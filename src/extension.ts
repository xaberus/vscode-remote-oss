import * as vscode from "vscode";
import { RemotesDataProvider, FolderItem, HostBase } from "./remotesView";
import { RemoteResolver } from "./resolver";

const getOutputChannel: () => vscode.OutputChannel = (function () {
  let outputChannel: vscode.OutputChannel | undefined = undefined;
  return () => {
    if (!outputChannel)
      outputChannel = vscode.window.createOutputChannel("Remote OSS");
    return outputChannel;
  };
})();

function registerExplorer(
  context: vscode.ExtensionContext
): RemotesDataProvider {
  let treeDataProvider = new RemotesDataProvider(context);
  const view = vscode.window.createTreeView("remoteHosts", {
    treeDataProvider: treeDataProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(view);
  return treeDataProvider;
}

export function activate(context: vscode.ExtensionContext) {
  let remotesProvider = registerExplorer(context);
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("remote.OSS.hosts")) {
        await remotesProvider.readTree();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("remote-oss.configureHosts", async () => {
      vscode.commands.executeCommand("workbench.action.openSettingsJson");
    })
  );

  async function doResolve(
    label: string,
    progress: vscode.Progress<{ message?: string; increment?: number }>
  ): Promise<vscode.ResolvedAuthority> {
    const output = getOutputChannel();
    const host = await remotesProvider.getHost(label);
    const resolver = new RemoteResolver(host, progress, output);
    await resolver.initialize();
    const result = await resolver.resolveAuthority();
    context.subscriptions.push(resolver);
    context.subscriptions.push(
      vscode.workspace.registerResourceLabelFormatter({
        scheme: "vscode-remote",
        authority: "remote-oss+*",
        formatting: {
          label: "${path}",
          separator: "/",
          tildify: true,
          workspaceSuffix: label,
        },
      })
    );
    // Enable ports view
    vscode.commands.executeCommand(
      "setContext",
      "forwardedPortsViewEnabled",
      true
    );
    return result;
  }

  const authorityResolverDisposable =
    vscode.workspace.registerRemoteAuthorityResolver("remote-oss", {
      async getCanonicalURI(uri: vscode.Uri): Promise<vscode.Uri> {
        return vscode.Uri.file(uri.path);
      },
      resolve(authority: string): Thenable<vscode.ResolvedAuthority> {
        const match = authority.match(/remote-oss\+(.*)/);
        if (match) {
          return vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `connecting to ${match[1]} ([details](command:remote-oss.showLog))`,
              cancellable: false,
            },
            (progress) => doResolve(match[1], progress)
          );
        }
        throw vscode.RemoteAuthorityResolverError.NotAvailable("Invalid", true);
      },
    });
  context.subscriptions.push(authorityResolverDisposable);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "remote-oss.openEmptyWindowInCurrentWindow",
      async (host?: HostBase) => {
        var label: string | undefined = undefined;
        if (!host) {
          label = await remotesProvider.pickHost();
        } else {
          label = `remote-oss+${host.name}`;
        }
        if (label) {
          vscode.window.showInformationMessage("resolving remote");
          vscode.commands.executeCommand("vscode.newWindow", {
            remoteAuthority: label,
            reuseWindow: true,
          });
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "remote-oss.openFolderInCurrentWindow",
      async (folder: FolderItem) => {
        const uri = vscode.Uri.parse(
          `vscode-remote://remote-oss+${folder.host}${folder.path}`
        );
        vscode.commands.executeCommand("vscode.openFolder", uri);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("remote-oss.showLog", () => {
      getOutputChannel().show();
    })
  );
}

export function deactivate() {}
