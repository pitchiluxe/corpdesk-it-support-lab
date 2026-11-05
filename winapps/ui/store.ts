/** The IAM Range store, backed by CORP Desk's saved state (state.preferences, state.technician). */
declare const state: any;
const g = globalThis as any;
const prefs = (): any => (state.preferences ||= {});

export const store = {
  /** Task Manager and similar app settings live in state.preferences.winApps. */
  get settings(): { taskManager?: { startPage?: string; speed?: 'high' | 'normal' | 'low' | 'paused' } } { return (prefs().winApps ||= {}); },
  get world(): any {
    const name: string = state.technician || 'Technician';
    const sam = name.toLowerCase().replace(/\s+/g, '.');
    return {
      ad: { netbios: 'CORP', domain: 'corp.example.test' },
      player: { sam, displayName: name, adminSam: sam },
    };
  },
};
export function persist(): void { g.save(); }
