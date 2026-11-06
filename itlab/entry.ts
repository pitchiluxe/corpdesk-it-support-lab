/**
 * The IT support lab layer for CORP Desk: Windows 11 Start, dark mode, full
 * screen, the real-world tools (Microsoft 365 admin, Entra admin, Outlook,
 * Services, Print Management, Pwd), randomized graded incidents, and the
 * career path with certificate. Built into dist/itlab.js by
 * `npm run build:itlab`; loaded last.
 */
import { G, checkLabPassword, lab, setLabPassword, welcomeMail, writePwdFile, save } from './corp.ts';
import './theme.ts';
import './fullscreen.ts';
import './tools/m365.ts';
import './tools/entra.ts';
import './tools/outlook.ts';
import './tools/services.ts';
import './tools/pwd.ts';
import './tools/jam.ts';
import './pen.ts';
import './ribbons.ts';
import './labs.ts';
import { applyResetKeep } from './pathway.ts';
import './start.ts';
import { refreshShortcuts } from './host.ts';
import { ensureServices } from './tools/services.ts';

lab();
applyResetKeep();
ensureServices();
welcomeMail();
writePwdFile();
save();
Object.assign((G.CorpDesk ||= {}), { setLabPassword, checkLabPassword });
refreshShortcuts();
