#!/usr/bin/env bash
set -Eeuo pipefail

readonly DOCS_ROOT="${WORKBAR_DOCS_ROOT:-/srv/workbar-docs}"
readonly RELEASES_DIR="${DOCS_ROOT}/releases"
readonly CURRENT_LINK="${DOCS_ROOT}/current"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

if [[ "${EUID}" -ne 0 ]]; then
  fail "run this script with sudo"
fi

if [[ $# -ne 1 ]]; then
  printf 'Usage: sudo bash %s <release-id>\n' "$0" >&2
  exit 2
fi

RELEASE_ID="$1"
[[ "${RELEASE_ID}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail "invalid release id: ${RELEASE_ID}"

TARGET_DIR="${RELEASES_DIR}/${RELEASE_ID}"
NEXT_LINK="${DOCS_ROOT}/.current.next.$$"

[[ -d "${TARGET_DIR}" ]] || fail "release does not exist: ${RELEASE_ID}"
[[ -f "${TARGET_DIR}/index.html" ]] || fail "release is incomplete: ${RELEASE_ID}"

cleanup() {
  rm -f -- "${NEXT_LINK}" 2>/dev/null || true
}
trap cleanup EXIT

ln -s -- "${TARGET_DIR}" "${NEXT_LINK}"
mv -Tf -- "${NEXT_LINK}" "${CURRENT_LINK}"

trap - EXIT
printf 'Rolled back workbar docs to: %s\n' "${RELEASE_ID}"
printf 'Current release: %s\n' "$(readlink -f -- "${CURRENT_LINK}")"
