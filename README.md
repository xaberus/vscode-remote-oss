# remote-oss README

This extension allows you to use the existing remote extension host (REH) machinery of
VSCode for OSS builds. The machinery is the same as in the proprietary remote development
extension like `ms-vscode-remote.remote-ssh`. That is, it uses the same RPC protocol as VSCode
as it is part of the OSS release of VSCode.

As of writing this, there is right now no other way to utilize this remote development code
without violating the license, hence the need for this extension.

The remote development pack provided by Microsoft includes several domain specific extensions
(ssh, docker, WSL2, etc.). These extensions contains shell scripts that are used to start up
a REH instance on the remote host. The remaining part is some glue code to direct the local editor
to a local port that has been forwarded in some way to the remote part on which the REH
instance is listening. (And some fancy GUI of course...)

In this first version we delegate the REH startup and port forwarding to the user to keep the scope
simple. Therefore, if you want to use this extension then you are responsible for starting up the
**correct** version of the REH instance and creating the necessary tunnel to forward the traffic
(using for example SSH, see the examples below.) For now, this extension just allows you to connect
to a local port. (This is actually something the original remote extensions do not allow you to
do for some reason.)

## Requirements

VSCode defines the connection to remote hosts though special URIs of the shape:
```
    vscode-remote://<resolver>+<label><path>
```
In our case `<resolver>` is `remote-oss`, label is the name of the host defined in the settings and `<path>` is the absolute path on the remote host.

In order to hook into this mechanism this extension needs to enable several API proposals. Normally these are blocked so you have to explicitly enable them in your `argv.json`

```json
{
    ...
    "enable-proposed-api": [
        ...,
        "xaberus.remote-oss",
    ]
    ...
}
```

With this out of the way we can register our own "remote authority resolver" that will resolve
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

Then, on the remote machine download the REH build and put it in some folder:

```bash
export COMMIT=c3511e6c69bb39013c4a4b7b9566ec1ca73fc4d5
export REH_DIR=~/.vscode-server-oss/${COMMIT}
export CONNECTION_TOKEN=...
export REMOTE_PORT=11111
mkdir -p ${REH_DIR}
cd ${REH_DIR}
curl https:/... | tar -xvf-
```

(The above folder structure is inspired by how the remote-ssh extension but is not strictly necessary.)

Start the REH instance:

```bash
~/.vscode-server-oss/bin/${COMMIT}/bin/code-server-oss \
    --host localhost \
    --port ${REMOTE_PORT} \
    --telemetry-level off \
    --connection-token ${CONNECTION_TOKEN}
```

Note, that in the above command line we specified the host to be `localhost`. This is important
because the default setting is to listen on `0:0:0:0`. This will expose our REH instance to
outside internet, which you definitely want to avoid. With the localhost setting only local
processes can connect (i.e., the SSH server).

The `CONNECTION_TOKEN` serves as a password that you will be asked every time you connect
to the REH instance.

You have to keep the SSH session running as long as you using the REH. Alternatively you can use
tools like tmux to create persistent sessions.

Now, to connect your local editor install the extension and add the following section to your `settings.json`:

```json
    "remote.OSS.hosts": [
        {
            "type": "manual",
            "name": "local",
            "host": "127.0.0.1",
            "port": 8000,
            "folders": [
                {
                    "name": "project",
                    "path": "/home/user/project",
                },
            ],
        }
    ]
```

Now you should be able to trigger a connection from the "Remote Explorer" tree view. You should see a tree that allows you to connect either to the REH instance directly or to a folder you specified in the config.

Trigger either one and you will be asked for the connection token you specified above.

Have fun!

## Release Notes

...

### 0.0.1

Initial release of Remote OSS
