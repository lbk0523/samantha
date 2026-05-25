#!/usr/bin/env bash
set -eu
set -o pipefail

LOAD_NOW="false"
REPO_ROOT="/Users/byung/Documents/samantha"
TEMPLATE_PATH="${REPO_ROOT}/references/launchagents/com.samantha.daily-lessons.plist.template"
TARGET_DIR="${HOME}/Library/LaunchAgents"
TARGET_PLIST="${TARGET_DIR}/com.samantha.daily-lessons.plist"

usage() {
  printf '%s\n' "usage: scripts/install-daily-lesson-launchagent.sh [--load-now]"
}

render_plist() {
  while IFS= read -r line || [[ -n "${line}" ]]; do
    rendered_line="${line//\$\{HOME\}/${HOME}}"
    printf '%s\n' "${rendered_line}"
  done <"${TEMPLATE_PATH}" >"${TARGET_PLIST}"
}

for arg in "$@"; do
  case "${arg}" in
    --load-now)
      LOAD_NOW="true"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
done

mkdir -p "${TARGET_DIR}"
render_plist

printf '%s\n' "Rendered LaunchAgent plist to ~/Library/LaunchAgents/com.samantha.daily-lessons.plist"
printf '%s\n' "To load later, run:"
printf '%s\n' 'launchctl bootstrap gui/$(id -u) "${HOME}/Library/LaunchAgents/com.samantha.daily-lessons.plist"'
printf '%s\n' 'launchctl enable gui/$(id -u)/com.samantha.daily-lessons'

if [[ "${LOAD_NOW}" != "true" ]]; then
  printf '%s\n' "Default behavior is copy-only; no launchctl command was run."
  exit 0
fi

launchctl bootstrap gui/$(id -u) "${TARGET_PLIST}"
launchctl enable gui/$(id -u)/com.samantha.daily-lessons
