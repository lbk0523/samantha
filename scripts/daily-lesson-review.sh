#!/usr/bin/env bash
set -eu
set -o pipefail

REPO_ROOT="/Users/byung/Documents/samantha"
BUN_BIN="${BUN_BIN:-/opt/homebrew/bin/bun}"
LOCK_DIR="${TMPDIR:-/tmp}/samantha-daily-lesson-review.lock"
LOG_DIR="${HOME}/Library/Logs/samantha/daily-lessons"
LOG_FILE="${LOG_DIR}/daily-review.log"

mkdir -p "${LOG_DIR}"
exec >>"${LOG_FILE}" 2>&1

cd "${REPO_ROOT}"

dirty_status="$(git status --short)"
if [[ -n "${dirty_status}" ]]; then
  printf '%s\n' "Samantha repo is dirty; refusing daily lesson review" >&2
  printf '%s\n' "${dirty_status}" >&2
  exit 1
fi

cleanup() {
  rmdir "${LOCK_DIR}" 2>/dev/null || true
}

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  printf '%s\n' "Daily lesson review is already running" >&2
  exit 1
fi
trap cleanup EXIT INT TERM

if [[ ! -x "${BUN_BIN}" ]]; then
  printf '%s\n' "Bun binary is not executable at ${BUN_BIN}; set BUN_BIN to an absolute executable path" >&2
  exit 1
fi

printf '%s\n' "Starting daily lesson review"
"${BUN_BIN}" run samantha lessons:daily-review --repo-root="${REPO_ROOT}"
printf '%s\n' "Finished daily lesson review"
