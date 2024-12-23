# remote-oss README

This extension allows you to use the existing remote extension host (REH) machinery of
VSCode for OSS builds. The machinery is the same as in the proprietary remote development
extension like `ms-vscode-remote.remote-ssh`. That is, it uses the same RPC protocol as VSCode
as it is part of the OSS release of VSCode.


The remote development pack provided by Microsoft includes several domain specific extensions
(ssh, docker, WSL2, etc.). These extensions contain shell scripts that are used to start up
a REH instance on the remote host. The remaining part is some glue code to direct the local editor
to a local port that has been forwarded in some way to the remote port or socket on which the REH
instance is listening. (And some fancy GUI of course...)

This extension delegates the REH startup and port forwarding completely to the user to keep the
scope simple. Therefore, if you want to use this extension then you are responsible for starting
up the **correct** version of the REH instance and creating the necessary tunnel to forward the
traffic (using for example SSH, see the examples below.) For now, this extension just allows you
to connect to a local port. (This is actually something the original remote extensions do not
allow you to do for some reason.)

**Note**: If you want an alternative that is limited to either SSH tunnels or WSL, you can try the extensions [open-remote-ssh](https://open-vsx.org/extension/jeanp413/open-remote-ssh) or [open-remote-wsl](https://open-vsx.org/extension/jeanp413/open-remote-wsl) instead.

## Requirements

VSCode defines the connection to remote hosts though special URIs of the shape:
```
    vscode-remote://<resolver>+<label><path>
```
In our case `<resolver>` is `remote-oss`, label is the name of the host defined in the settings
and `<path>` is the absolute path on the remote host.

In order to hook into this mechanism, this extension needs to enable several API proposals.
Normally these are blocked so you have to explicitly enable them in your `argv.json`. This
file is usually located in `~/.vscode-oss/argv.json` on Linux and you can  open by it by
running the `Preferences: Configure Runtime Arguments` command.


```json
{
    ...
    "enable-proposed-api": [
        ...,
        "xaberus.remote-oss"
    ],
    ...
}
```

With this out of the way, we can register our own "remote authority resolver" that will resolve
`vscode-remote://` URIs to whatever is configured in the corresponding settings section.

## Extension Settings

This extension contributes the following settings:

* `remote.OSS.hosts`: A list of remote hosts an their corresponding settings.

## Known Issues

The RPC protocol follows a strict versioning using the commit hash of the VSCode build as the version.
This is mostly useful, because different version might have incompatible changes. Unfortunately,
this also means that you have to upgrade the REH instance every time you upgrade your main editor.
If you are seeing "authentication" errors, the most probable reason is that your REH instance and
your editor have different versions.

## Examples

In this example we are going to connect to a remote host `rem` as declared in our SSH `config`.
We are going to use 8000 as the local port and 11111 as the remote port. (We are assuming that these ports are free.) In summary:

```
local port: 8000
remote port: 11111
commit: c3511e6c69bb39013c4a4b7b9566ec1ca73fc4d5
```

Log in to the remote port and simultaneously setup port forwarding:

```bash
ssh rem -L 8000:localhost:11111
```

Then, on the remote machine download the REH build and put it in some folder. You can use the following update script:

```bash
#!/usr/bin/env bash
set -uexo pipefail

VSCODIUM_DIR="${HOME}/.vscodium-server"
RELEASE_URL="$(curl -Ls -o /dev/null -w '%{url_effective}' 'https://github.com/VSCodium/vscodium/releases/latest')"
RELEASE="${RELEASE_URL##*/}"
PACKAGE="vscodium-reh-linux-x64-${RELEASE}.tar.gz"
DOWNLOAD_URL="https://github.com/VSCodium/vscodium/releases/download/${RELEASE}/${PACKAGE}"

mkdir -p "${VSCODIUM_DIR}"
pushd "${VSCODIUM_DIR}"
curl -Ls -o "${VSCODIUM_DIR}/${PACKAGE}" "${DOWNLOAD_URL}"
COMMIT_ID=$(tar -xf "${VSCODIUM_DIR}/${PACKAGE}" ./product.json -O | jq ".commit" -r)
BIN_DIR="${VSCODIUM_DIR}/bin/${COMMIT_ID}"
mkdir -p "${BIN_DIR}"
pushd "${BIN_DIR}"
tar -xf "${VSCODIUM_DIR}/${PACKAGE}"
popd
ln -sfT "${BIN_DIR}" "${VSCODIUM_DIR}/bin/current"
rm "${VSCODIUM_DIR}/${PACKAGE}"
popd
```

(The above folder structure is inspired by how the remote-ssh extension but is not strictly necessary.)

Create a connection token and save it in a file. This is a password, so it must be kept secret, otherwise other
users of the same remote machine can connect to your Remote Host Extension and perform arbitrary actions in
your name! For example, to create a random 24-character connection token and save it, you can do:

```bash
tr -dc A-Za-z0-9 </dev/urandom | head -c 24 > .vscodium-server/connection-token
chmod 600 .vscodium-server/connection-token  # prevent access by others!
```

Start the REH instance:

```bash
export REMOTE_PORT=11111

~/.vscodium-server/bin/current/bin/codium-server \
    --host localhost \
    --port ${REMOTE_PORT} \
    --telemetry-level off \
    --connection-token-file ~/.vscodium-server/connection-token
```

Note, that in the above command line we specified the host to be `localhost`. This is important
because the default setting is to listen on `0:0:0:0`. This will expose your REH instance to
outside internet, which you definitely want to avoid. With the localhost setting only local
processes can connect (i.e., the SSH server). Also, if others than you can access your server,
you should not use the option `--connection-token (....)` because all other users can see the
full command you execute and thus you would reveal your connection token. Use 
`--connection-token-file` like shown above. To avoid the use of a dedicated file, you can 
make use of bash's [process substitution](https://tldp.org/LDP/abs/html/process-sub.html)
feature, e.g. (`--connection-token-file <(printenv CONNECTION_TOKEN)`) when you set 
`export CONNECTION_TOKEN="<secret>"`) earlier in your script.

You have to keep the SSH session running as long as you using the REH. Alternatively, you can use
tools like tmux to create persistent sessions.

Now, to connect your local editor install the extension and add the following section to your `settings.json`:

```json
    "remote.OSS.hosts": [
        {
            "type": "manual",
            "name": "local",
            "host": "127.0.0.1",
            "port": 8000,
            "connectionToken": "(copy from previous step)",
            "folders": [
                {
                    "name": "project",
                    "path": "/home/user/project",
                },
            ],
        }
    ]
```

To make VSCodium ask for the connection token at each connection attempt, use `"connectionToken": true` above instead of providing the token.

Now you should be able to trigger a connection from the "Remote Explorer" tree view. You should see a tree that allows you to connect either to the REH instance directly or to a folder you specified in the config.

Trigger either one and you will be asked for the connection token you specified above.

Have fun!

## Release Notes

...

### 0.0.4
Properly encode the remote label so it survives a round-trip through the URI parser.

### 0.0.3
Enabled port view and added an example update bash script.

### 0.0.2

Added a new config option (`connectionToken`) to host configurations.
Set it to a string to provide a fixed connection token. Alternatively,
set it to boolean value `false` to completely disable connection tokens.
The default value is `true`. Be ware that by saving the token in the
config JSON you might compromise the little security might have initially
provided.

### 0.0.1

Initial release of Remote OSS
