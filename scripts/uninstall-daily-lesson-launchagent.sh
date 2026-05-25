#!/usr/bin/env bash
set -eu
set -o pipefail

REMOVE_NOW="false"
TARGET_PLIST="${HOME}/Library/LaunchAgents/com.samantha.daily-lessons.plist"

usage() {
  printf '%s\n' "usage: scripts/uninstall-daily-lesson-launchagent.sh [--remove-now]"
}

for arg in "$@"; do
  case "${arg}" in
    --remove-now)
      REMOVE_NOW="true"
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

printf '%s\n' "LaunchAgent plist path: ~/Library/LaunchAgents/com.samantha.daily-lessons.plist"
printf '%s\n' "To unload and remove later, run:"
printf '%s\n' 'launchctl bootout gui/$(id -u) "${HOME}/Library/LaunchAgents/com.samantha.daily-lessons.plist"'
printf '%s\n' 'rm -f "${HOME}/Library/LaunchAgents/com.samantha.daily-lessons.plist"'

if [[ "${REMOVE_NOW}" != "true" ]]; then
  printf '%s\n' "Default behavior is instructions-only; no launchctl or remove command was run."
  exit 0
fi

launchctl bootout gui/$(id -u) "${TARGET_PLIST}"
rm -f "${TARGET_PLIST}"
