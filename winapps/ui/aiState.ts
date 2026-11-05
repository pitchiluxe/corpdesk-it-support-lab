/** Whether local Ollama is answering, from CORP Desk's own probe (desktop app) or the assistant settings. */
declare const state: any;
const g = globalThis as any;
export const ai = {
  get status(): 'online' | 'offline' { return state?.nativeOllama?.available || state?.assistant?.mode === 'ollama' ? 'online' : 'offline'; },
};
