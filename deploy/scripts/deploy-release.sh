#!/usr/bin/env bash
set -Eeuo pipefail

readonly DOCS_ROOT="${WORKBAR_DOCS_ROOT:-/srv/workbar-docs}"
readonly DOCS_GROUP="${WORKBAR_DOCS_GROUP:-www-data}"
readonly RELEASES_DIR="${DOCS_ROOT}/releases"
readonly CURRENT_LINK="${DOCS_ROOT}/current"

usage() {
  printf 'Usage: sudo bash %s <dist-directory> [release-id]\n' "$0" >&2
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

if [[ "${EUID}" -ne 0 ]]; then
  fail "run this script with sudo"
fi

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 2
fi

[[ -d "$1" ]] || fail "dist directory does not exist: $1"
SOURCE_DIR="$(realpath -- "$1")"
RELEASE_ID="${2:-$(date -u +%Y%m%dT%H%M%SZ)}"

[[ "${RELEASE_ID}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail "invalid release id: ${RELEASE_ID}"

for required_path in index.html 404.html robots.txt sitemap.xml assets; do
  [[ -e "${SOURCE_DIR}/${required_path}" ]] || fail "missing required dist path: ${required_path}"
done

[[ -d "${SOURCE_DIR}/assets" ]] || fail "assets must be a directory"

if [[ -n "$(find "${SOURCE_DIR}" -type l -print -quit)" ]]; then
  fail "dist must not contain symbolic links"
fi

if [[ -n "$(find "${SOURCE_DIR}" \( -name '.env' -o -name '.env.*' -o -name '.git' \) -print -quit)" ]]; then
  fail "dist contains an environment or Git metadata path"
fi

# 仅拦截长度足以疑似真实 API Key 的 sk- 字符串；文档中的短占位符不受影响。
if grep -RIEq --exclude='*.map' 'sk-[A-Za-z0-9_-]{32,}' "${SOURCE_DIR}"; then
  fail "dist contains a string that looks like a real API key"
fi

getent group "${DOCS_GROUP}" >/dev/null 2>&1 || fail "server group does not exist: ${DOCS_GROUP}"

install -d -o root -g "${DOCS_GROUP}" -m 0755 "${DOCS_ROOT}" "${RELEASES_DIR}"

TARGET_DIR="${RELEASES_DIR}/${RELEASE_ID}"
STAGING_DIR="${RELEASES_DIR}/.${RELEASE_ID}.staging.$$"
NEXT_LINK="${DOCS_ROOT}/.current.next.$$"

[[ ! -e "${TARGET_DIR}" && ! -L "${TARGET_DIR}" ]] || fail "release already exists: ${RELEASE_ID}"

cleanup() {
  rm -rf -- "${STAGING_DIR}" 2>/dev/null || true
  rm -f -- "${NEXT_LINK}" 2>/dev/null || true
}
trap cleanup EXIT

install -d -o root -g "${DOCS_GROUP}" -m 0755 "${STAGING_DIR}"
cp -a --no-preserve=ownership "${SOURCE_DIR}/." "${STAGING_DIR}/"
find "${STAGING_DIR}" -type d -exec chmod 0755 {} +
find "${STAGING_DIR}" -type f -exec chmod 0644 {} +
chown -R root:"${DOCS_GROUP}" "${STAGING_DIR}"

printf '%s\n' "${RELEASE_ID}" > "${STAGING_DIR}/.release-id"
chmod 0644 "${STAGING_DIR}/.release-id"
chown root:"${DOCS_GROUP}" "${STAGING_DIR}/.release-id"

mv -- "${STAGING_DIR}" "${TARGET_DIR}"
ln -s -- "${TARGET_DIR}" "${NEXT_LINK}"
mv -Tf -- "${NEXT_LINK}" "${CURRENT_LINK}"

trap - EXIT
printf 'Published workbar docs release: %s\n' "${RELEASE_ID}"
printf 'Current release: %s\n' "$(readlink -f -- "${CURRENT_LINK}")"
