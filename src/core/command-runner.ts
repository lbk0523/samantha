export interface CommandRunResult {
  command: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}

const WORKER_ENV_KEYS = [
  "PATH",
  "HOME",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
] as const;

function workerSubprocessEnv(source: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of WORKER_ENV_KEYS) {
    const value = source[key];
    if (value) env[key] = value;
  }
  env.PATH ??= "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
  return env;
}

export async function runCommand(
  command: string[],
  options: { cwd?: string } = {},
): Promise<CommandRunResult> {
  const child = Bun.spawn(command, {
    cwd: options.cwd,
    env: workerSubprocessEnv(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  return { command, exitCode, stdout, stderr };
}
