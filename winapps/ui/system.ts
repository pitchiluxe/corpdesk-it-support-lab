/** Startup apps and connectivity, as the IAM Range's system settings describe them, kept in CORP Desk's state. */
declare const state: any;
const g = globalThis as any;
const prefs = (): any => (state.preferences ||= {});

/** Apps that can open when you sign in (CORP Desk app ids). */
export const STARTUP_APPS: [string, string][] = [
  ['tickets', 'Service Desk'],
  ['mentor', 'IT Assistant'],
  ['chrome', 'Google Chrome'],
  ['notepadpp', 'Notepad++'],
  ['terminal', 'Windows PowerShell'],
];

export function sys(): { airplane: boolean; startupApps: string[] } {
  return { airplane: false, startupApps: [...(prefs().startupApps ?? [])] };
}
export function setSys(patch: { startupApps?: string[] }): void {
  if (patch.startupApps) prefs().startupApps = patch.startupApps;
  g.save();
}
