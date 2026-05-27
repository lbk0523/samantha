import { performance } from "node:perf_hooks";

export interface OperationTiming {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface OperationTimingStart {
  startedAt: string;
  startedAtMs: number;
}

const COMMAND_TIMEOUT_EXIT_CODE = 124;
const COMMAND_TIMEOUT_SIGNAL = "SIGTERM";
const COMMAND_TIMEOUT_CLEANUP_SIGNAL = "SIGKILL";
const COMMAND_TIMEOUT_CLEANUP_GRACE_MS = 100;

export interface CommandTimeoutDetails {
  reason: "command-timeout";
  signal: typeof COMMAND_TIMEOUT_SIGNAL;
  cleanupSignal?: typeof COMMAND_TIMEOUT_CLEANUP_SIGNAL;
}

export interface CommandRunResult {
  command: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
  timeoutMs?: number;
  timeoutDetails?: CommandTimeoutDetails;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
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

export function startOperationTiming(): OperationTimingStart {
  return {
    startedAt: new Date().toISOString(),
    startedAtMs: performance.now(),
  };
}

export function finishOperationTiming(start: OperationTimingStart): OperationTiming {
  return {
    startedAt: start.startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Math.max(0, Math.round(performance.now() - start.startedAtMs)),
  };
}

export async function runCommand(
  command: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<CommandRunResult> {
  const timing = startOperationTiming();
  const child = Bun.spawn(command, {
    cwd: options.cwd,
    env: workerSubprocessEnv(),
    stdout: "pipe",
    stderr: "pipe",
    ...(options.timeoutMs === undefined ? {} : { detached: true }),
  });
  const stdout = new Response(child.stdout).text();
  const stderr = new Response(child.stderr).text();

  if (options.timeoutMs === undefined) {
    const [stdoutText, stderrText, exitCode] = await Promise.all([stdout, stderr, child.exited]);
    return { command, exitCode, stdout: stdoutText, stderr: stderrText, ...finishOperationTiming(timing) };
  }

  let timedOut = false;
  let cleanupSignalSent = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let cleanupId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      killCommandProcess(child, COMMAND_TIMEOUT_SIGNAL);
      cleanupId = setTimeout(() => {
        cleanupSignalSent = true;
        killCommandProcess(child, COMMAND_TIMEOUT_CLEANUP_SIGNAL);
      }, COMMAND_TIMEOUT_CLEANUP_GRACE_MS);
      resolve("timeout");
    }, options.timeoutMs);
  });

  const exitOrTimeout = await Promise.race([child.exited, timeout]);
  if (timeoutId) clearTimeout(timeoutId);
  if (exitOrTimeout === "timeout") {
    await child.exited;
  }
  if (cleanupId) clearTimeout(cleanupId);

  const [stdoutText, stderrText] = await Promise.all([stdout, stderr]);

  return {
    command,
    exitCode: timedOut
      ? COMMAND_TIMEOUT_EXIT_CODE
      : typeof exitOrTimeout === "number"
        ? exitOrTimeout
        : COMMAND_TIMEOUT_EXIT_CODE,
    stdout: stdoutText,
    stderr: stderrText,
    ...(timedOut
      ? {
          timedOut: true,
          timeoutMs: options.timeoutMs,
          timeoutDetails: {
            reason: "command-timeout" as const,
            signal: COMMAND_TIMEOUT_SIGNAL,
            ...(cleanupSignalSent ? { cleanupSignal: COMMAND_TIMEOUT_CLEANUP_SIGNAL } : {}),
          },
        }
      : {}),
    ...finishOperationTiming(timing),
  };
}

function killCommandProcess(
  child: Bun.Subprocess<"ignore", "pipe", "pipe">,
  signal: NodeJS.Signals,
): void {
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}
