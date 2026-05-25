import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const wrapperPath = "scripts/daily-lesson-review.sh";
const plistPath = "references/launchagents/com.samantha.daily-lessons.plist.template";
const installPath = "scripts/install-daily-lesson-launchagent.sh";
const uninstallPath = "scripts/uninstall-daily-lesson-launchagent.sh";

async function readText(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("daily lesson LaunchAgent MVP files", () => {
  test("wrapper runs the daily review from the Samantha repo with loud dirty-repo, lock, and log guards", async () => {
    const wrapper = await readText(wrapperPath);

    expect(wrapper).toContain('REPO_ROOT="/Users/byung/Documents/samantha"');
    expect(wrapper).toContain("git status --short");
    expect(wrapper).toContain("Samantha repo is dirty; refusing daily lesson review");
    expect(wrapper).toContain('LOCK_DIR="${TMPDIR:-/tmp}/samantha-daily-lesson-review.lock"');
    expect(wrapper).toContain("mkdir \"${LOCK_DIR}\"");
    expect(wrapper).toContain("trap cleanup EXIT INT TERM");
    expect(wrapper).toContain('LOG_DIR="${HOME}/Library/Logs/samantha/daily-lessons"');
    expect(wrapper).toContain('exec >>\"${LOG_FILE}\" 2>&1');
    expect(wrapper).toContain("bun run samantha lessons:daily-review --repo-root=\"${REPO_ROOT}\"");
    expect(wrapper.indexOf("git status --short")).toBeLessThan(
      wrapper.indexOf("bun run samantha lessons:daily-review"),
    );
    expect(wrapper.indexOf("git status --short")).toBeLessThan(wrapper.indexOf('mkdir "${LOCK_DIR}"'));
  });

  test("plist template schedules the wrapper at 03:00 without RunAtLoad", async () => {
    const plist = await readText(plistPath);

    expect(plist).toContain("<key>Label</key>");
    expect(plist).toContain("<string>com.samantha.daily-lessons</string>");
    expect(plist).toContain("<key>StartCalendarInterval</key>");
    expect(plist).toContain("<key>Hour</key>");
    expect(plist).toContain("<integer>3</integer>");
    expect(plist).toContain("<key>Minute</key>");
    expect(plist).toContain("<integer>0</integer>");
    expect(plist).toContain("<key>RunAtLoad</key>");
    expect(plist).toContain("<false/>");
    expect(plist).toContain("<string>/Users/byung/Documents/samantha/scripts/daily-lesson-review.sh</string>");
    expect(plist).toContain("<string>${HOME}/Library/Logs/samantha/daily-lessons/stdout.log</string>");
    expect(plist).toContain("<string>${HOME}/Library/Logs/samantha/daily-lessons/stderr.log</string>");
  });

  test("install script defaults to render/copy-only instructions and gates launchctl behind an explicit flag", async () => {
    const install = await readText(installPath);

    expect(install).toContain('LOAD_NOW="false"');
    expect(install).toContain('--load-now');
    expect(install).toContain('rendered_line="${line//\\$\\{HOME\\}/${HOME}}"');
    expect(install).toContain('done <"${TEMPLATE_PATH}" >"${TARGET_PLIST}"');
    expect(install).toContain('~/Library/LaunchAgents/com.samantha.daily-lessons.plist');
    expect(install).toContain('launchctl bootstrap gui/$(id -u) "${TARGET_PLIST}"');
    expect(install).toContain('launchctl enable gui/$(id -u)/com.samantha.daily-lessons');
    expect(install).toContain('if [[ "${LOAD_NOW}" != "true" ]]');
    expect(install.indexOf('if [[ "${LOAD_NOW}" != "true" ]]')).toBeLessThan(
      install.indexOf('launchctl bootstrap gui/$(id -u) "${TARGET_PLIST}"'),
    );
  });

  test("uninstall script defaults to instructions and gates unload/remove behind an explicit flag", async () => {
    const uninstall = await readText(uninstallPath);

    expect(uninstall).toContain('REMOVE_NOW="false"');
    expect(uninstall).toContain('--remove-now');
    expect(uninstall).toContain('launchctl bootout gui/$(id -u) "${TARGET_PLIST}"');
    expect(uninstall).toContain('rm -f "${TARGET_PLIST}"');
    expect(uninstall).toContain('if [[ "${REMOVE_NOW}" != "true" ]]');
    expect(uninstall.indexOf('if [[ "${REMOVE_NOW}" != "true" ]]')).toBeLessThan(
      uninstall.indexOf('launchctl bootout gui/$(id -u) "${TARGET_PLIST}"'),
    );
  });

  test("scheduler files do not automate forbidden lifecycle or learning behavior", async () => {
    const contents = await Promise.all([
      readText(wrapperPath),
      readText(plistPath),
      readText(installPath),
      readText(uninstallPath),
    ]);
    const combined = contents.join("\n");

    expect(combined).not.toMatch(/\bgit\s+(commit|push)\b/);
    expect(combined).not.toMatch(/\blessons:promote\b/);
    expect(combined).not.toMatch(/\bprivate transcript\b/i);
    expect(combined).not.toMatch(/\bhidden memory\b/i);
    expect(combined).not.toMatch(/\bcodex\b/i);
    expect(combined).not.toMatch(/\bwhile\s+true\b/);
  });
});
