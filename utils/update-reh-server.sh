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
