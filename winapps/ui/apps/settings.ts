/** Saving Mouse Properties (the only appearance Control Panel changes) into CORP Desk's preferences. */
import { appearance, applyPointer, type Appearance } from '../theme.ts';
declare const state: any;
const g = globalThis as any;
export function setAppearance(patch: Partial<Appearance>): void {
  const prefs = (state.preferences ||= {});
  prefs.pointer = { ...appearance(), ...patch };
  g.save();
  applyPointer();
}
