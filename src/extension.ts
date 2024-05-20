import * as vscode from 'vscode';
import { RemotesDataProvider, FolderItem, HostBase, encode_remote_host, decode_remote_host } from './remotesView';

let outputChannel: vscode.OutputChannel;


function registerExplorer(context: vscode.ExtensionContext): RemotesDataProvider {
    let treeDataProvider = new RemotesDataProvider(context);
    const view = vscode.window.createTreeView('remoteHosts', {
        treeDataProvider: treeDataProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(view);
    return treeDataProvider;
}

export async function activate(context: vscode.ExtensionContext) {
    let remotesProvider = registerExplorer(context);
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('remote.OSS.hosts')) {
            await remotesProvider.readTree();
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('remote-oss.configureHosts', async () => {
        vscode.commands.executeCommand("workbench.action.openSettingsJson");
    }));

    outputChannel = vscode.window.createOutputChannel('Remote OSS');

    async function doResolve(
        label: string,
        progress: vscode.Progress<{ message?: string; increment?: number }>,
        legacy: boolean,
    ): Promise<vscode.ResolvedAuthority> {
        if (legacy) {
            await vscode.window.showWarningMessage(
                `The the format of remote host links in the Remote OSS extension changed.
                This change will make links in the recently visited list invalid
                in future version of this extension. Clear the recent list and/or
                reopen the workspace.`,
                "OK",
            );

        }
        const authority = remotesProvider.resolveAuthority(label, outputChannel, legacy);
        context.subscriptions.push(vscode.workspace.registerResourceLabelFormatter({
            scheme: "vscode-remote",
            authority: "remote-oss+*",
            formatting: {
                label: "${path}",
                separator: "/",
                tildify: true,
                normalizeDriveLetter: false,
                workspaceSuffix: label,
            }
        }));
        // Enable ports view
        vscode.commands.executeCommand("setContext", "forwardedPortsViewEnabled", true);
        return authority;
    }

    const authorityResolverDisposable = vscode.workspace.registerRemoteAuthorityResolver('remote-oss', {
        async getCanonicalURI(uri: vscode.Uri): Promise<vscode.Uri> {
            return vscode.Uri.file(uri.path);
        },
        resolve(authority: string): Thenable<vscode.ResolvedAuthority> {
            outputChannel.appendLine(`resolving authority: ${authority}`)
            const [host, legacy] = decode_remote_host(authority);
            if (host) {
                return vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `connecting to ${host} ([details](command:remote-oss.showLog))`,
                    cancellable: false
                }, (progress) => doResolve(host, progress, legacy));
            }
            throw vscode.RemoteAuthorityResolverError.NotAvailable('Invalid', true);
        },
        // tunnelFactory,
        // showCandidatePort
    });
    context.subscriptions.push(authorityResolverDisposable);


    context.subscriptions.push(vscode.commands.registerCommand('remote-oss.openEmptyWindowInCurrentWindow',
        async (host?: HostBase) => {
            var label: string | undefined = undefined;
            if (!host) {
                label = await remotesProvider.pickHostLabel();
            } else {
                label = encode_remote_host(host.name);
            }
            if (label) {
                vscode.window.showInformationMessage('resolving remote');
                vscode.commands.executeCommand("vscode.newWindow", {
                    remoteAuthority: label,
                    reuseWindow: true
                });
            }
        }));

    context.subscriptions.push(vscode.commands.registerCommand('remote-oss.openFolderInCurrentWindow',
        async (folder?: FolderItem) => {
            if (folder) {
                const encoded = encode_remote_host(folder.host)
                const uri = vscode.Uri.parse(`vscode-remote://${encoded}${folder.path}`);
                vscode.commands.executeCommand("vscode.openFolder", uri);
            }
        }));

    context.subscriptions.push(vscode.commands.registerCommand('remote-oss.showLog', () => {
        if (outputChannel) {
            outputChannel.show();
        }
    }));
}

export function deactivate() { }
