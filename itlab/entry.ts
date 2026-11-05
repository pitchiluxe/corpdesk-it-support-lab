/**
 * The IT support lab layer for CORP Desk: Windows 11 Start, dark mode, the
 * real-world tools (Microsoft 365 admin, Entra admin, Outlook, Services,
 * Print Management), seven graded real-world incidents, and the career path.
 * Built into dist/itlab.js by `npm run build:itlab`; loaded last.
 */
import { lab } from './corp.ts';
import './theme.ts';
import './tools/m365.ts';
import './tools/entra.ts';
import './tools/outlook.ts';
import './tools/services.ts';
import './labs.ts';
import './pathway.ts';
import './start.ts';
import { refreshShortcuts } from './host.ts';
import { ensureServices } from './tools/services.ts';

lab();
ensureServices();
refreshShortcuts();
