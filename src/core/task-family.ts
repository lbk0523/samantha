export function taskFamily(taskId: string): string {
  return taskId.replace(/-v\d+$/, "");
}
