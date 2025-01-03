#!/usr/bin/env bash

set -uexo pipefail

function die {
    echo "$1" >&2
    exit 1
}

RELEASE_URL="$(curl -Ls -o /dev/null -w '%{url_effective}' 'https://github.com/VSCodium/vscodium/releases/latest')"
VERSION="${RELEASE_URL##*/}"

VSCODIUM_DIR="${HOME}/.vscodium-server"

mkdir -p "${VSCODIUM_DIR}"

kernel="$(uname -s)"
case $kernel in
    Darwin)
        PLATFORM="darwin"
        ;;
    Linux)
        PLATFORM="linux"
        ;;
    *)
        die "Error platform not supported: $kernel"
        ;;
esac

arch="$(uname -m)"
case $arch in
    x86_64 | amd64)
        ARCH="x64"
        ;;
    armv7l | armv8l)
        ARCH="armhf"
        ;;
    arm64 | aarch64)
        ARCH="arm64"
        ;;
    ppc64le)
        ARCH="ppc64le"
        ;;
    riscv64)
        ARCH="riscv64"
        ;;
    loongarch64)
        ARCH="loong64"
        ;;
    s390x)
        ARCH="s390x"
        ;;
    *)
        die "Error architecture not supported: $ARCH"
        ;;
esac


package_base="vscodium-reh-${PLATFORM}-${ARCH}"
package="${package_base}-${VERSION}.tar.gz"
DOWNLOAD_URL="https://github.com/VSCodium/vscodium/releases/download/${VERSION}/${package}"

pushd "${VSCODIUM_DIR}"

if test ! -f ${package}; then
  echo "using URL: ${DOWNLOAD_URL}"
  if wget --tries=3 "${DOWNLOAD_URL}" -O "${package}"; then
    PACKAGE="${package}"
  fi
fi

if test -z "${PACKAGE}"; then
  for package in $(ls -1 -t "${package_base}-"*".tar.gz" 2>/dev/null); do
    PACKAGE="${package}"
    break
  done
fi

echo "using package: ${PACKAGE}"

if test -z "${PACKAGE}"; then
  die "no REH package found! put the `${package_base}-*.tar.gz` package next to this script."
fi

COMMIT=$(tar -xf "${PACKAGE}" ./product.json -O | jq ".commit" -r)

if test -z "${COMMIT}"; then
  die "could not get COMMIT from package."
fi

BIN_DIR="${VSCODIUM_DIR}/bin/${COMMIT}"

echo "PACKAGE: ${PACKAGE}"
echo "COMMIT: ${COMMIT}"
echo "VSCODIUM_DIR: ${VSCODIUM_DIR}"
echo "BIN_DIR: ${BIN_DIR}"

if test -d "${BIN_DIR}"; then
  rm -rf "${BIN_DIR}"
fi

mkdir -p "${BIN_DIR}"
pushd  "${BIN_DIR}"

tar -xf "${VSCODIUM_DIR}/${PACKAGE}"
rm -f "${VSCODIUM_DIR}/bin/current"
ln -sf "${BIN_DIR}" "${VSCODIUM_DIR}/bin/current"
