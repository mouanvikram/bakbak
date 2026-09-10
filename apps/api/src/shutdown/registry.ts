export type ShutdownHook = () => void | Promise<void>;

const hooks: ShutdownHook[] = [];

export function registerShutdownHook(hook: ShutdownHook): void {
  hooks.push(hook);
}
// shutdown hooks run in reverse order (LIFO)
export async function runShutdownHooks(): Promise<void> {
  for (const hook of hooks.slice().reverse()) {
    await hook();
  }
}