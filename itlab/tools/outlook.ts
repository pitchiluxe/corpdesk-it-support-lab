/**
 * Outlook (training), open on the shared IT Service Desk mailbox, where users
 * forward suspicious messages and managers send joiner and leaver notices.
 * Message details show the headers a technician reads to spot spoofing.
 */
import { DOMAIN, evidence, lab, log, save, toast } from '../corp.ts';
import { fmtDate, h, svg } from '../dom.ts';
import { I, dialog } from '../ui.ts';
import { registerTool } from '../host.ts';

let selected: string | null = null;
let folder: 'inbox' | 'deleted' = 'inbox';

function view(host: HTMLElement): void {
  const L = lab();
  const deleted = (m: { id: string }): boolean => L.purged.includes(`del:${m.id}`);
  const list = [...L.inbox].filter((m) => !m.hidden && (folder === 'deleted' ? deleted(m) : !deleted(m))).sort((a, b) => b.received.localeCompare(a.received));
  const m = list.find((x) => x.id === selected) ?? null;
  const unread = L.inbox.filter((x) => !x.hidden && !x.read && !deleted(x)).length;
  const open = (id: string): void => { selected = id; const x = L.inbox.find((y) => y.id === id); if (x && !x.read) { x.read = true; } if (x?.evidence) evidence(x.evidence); save(); };
  host.append(h('div', { class: 'ol' },
    h('header', { class: 'ol-top' }, svg(I.waffle, 18), h('strong', null, 'Outlook'), h('label', { class: 'ol-search' }, svg(I.search, 14), h('input', { placeholder: 'Search', 'aria-label': 'Search mail' }))),
    h('div', { class: 'ol-main' },
      h('nav', { class: 'ol-folders' },
        h('div', { class: 'ol-acct' }, 'IT Service Desk', h('small', null, `servicedesk@${DOMAIN}`)),
        h('button', { class: `ol-folder ${folder === 'inbox' ? 'on' : ''}`, type: 'button', onClick: () => { folder = 'inbox'; selected = null; save(); } }, svg(I.mail, 16), 'Inbox', unread ? h('b', null, String(unread)) : null),
        h('button', { class: `ol-folder ${folder === 'deleted' ? 'on' : ''}`, type: 'button', onClick: () => { folder = 'deleted'; selected = null; save(); } }, svg(I.trash, 16), 'Deleted Items')),
      h('section', { class: 'ol-list', 'data-scroll': 'ol' }, h('div', { class: 'ol-list-head' }, folder === 'inbox' ? 'Focused' : 'Deleted Items'),
        list.length ? list.map((x) => h('button', { class: `ol-item ${x.id === selected ? 'on' : ''} ${x.read ? '' : 'unread'}`, type: 'button', onClick: () => open(x.id) },
          h('span', { class: 'ol-from' }, x.fromName), h('span', { class: 'ol-subj' }, x.subject), h('span', { class: 'ol-prev' }, x.body.replace(/\s+/g, ' ').slice(0, 80)), h('span', { class: 'ol-time' }, new Date(x.received).toLocaleDateString()))) : h('p', { class: 'ad2-muted', style: 'padding:16px' }, 'Nothing here.')),
      h('article', { class: 'ol-read', 'data-scroll': 'olr' }, m ? [
        h('div', { class: 'ol-actions' },
          h('button', { class: 'ad2-cmdbtn', type: 'button', onClick: () => { L.purged.push(`del:${m.id}`); selected = null; save(); } }, svg(I.trash, 16), 'Delete'),
          h('button', { class: 'ad2-cmdbtn', type: 'button', disabled: !!m.reported, onClick: () => {
            dialog('Report phishing', h('p', null, 'This message will be sent to Microsoft and your security team, and moved to Deleted Items for this mailbox. It will still be in other people\'s mailboxes until it is removed with Explorer.'), [['Report', () => { m.reported = true; log(6042, `Message "${m.subject}" from ${m.from} reported as phishing`); evidence('phish-report'); save(); toast('Reported. Now find and remove every copy in Microsoft 365 > Explorer.'); }, 'primary'], ['Cancel', () => undefined]]);
          } }, svg(I.flag, 16), m.reported ? 'Reported' : 'Report phishing'),
          h('button', { class: 'ad2-cmdbtn', type: 'button', onClick: () => {
            evidence('phish-headers');
            dialog('Message details', h('pre', { class: 'ol-headers' }, m.headers), [['Close', () => undefined, 'primary']]);
          } }, svg(I.info, 16), 'View message details')),
        h('h2', { class: 'ol-subject' }, m.subject),
        h('div', { class: 'ol-sender' }, h('span', { class: 'ol-avatar' }, m.fromName.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()), h('div', null, h('b', null, m.fromName), h('small', null, ` <${m.from}>`), h('div', null, h('small', null, `To: ${m.to} · ${fmtDate(m.received)}`)))),
        m.phishing && !m.reported ? h('div', { class: 'ol-banner' }, 'Caution: This message came from outside your organization. Be careful with links and attachments.') : null,
        h('div', { class: 'ol-body' }, m.body.split('\n').map((line) => h('p', null, line || ' ')))] : h('div', { class: 'ol-empty' }, svg(I.mail, 48), h('p', null, 'Select an item to read'))))));
}

registerTool({
  id: 'outlook', name: 'Outlook', short: 'Outlook', width: 1120, height: 700,
  icon: '<rect x="12" y="6" width="19" height="22" rx="2" fill="#28a8ea"/><path d="M12 12l9.5 6 9.5-6" fill="none" stroke="#fff" stroke-width="1.6"/><rect x="3" y="9" width="15" height="16" rx="2" fill="#0a5dc2"/><ellipse cx="10.5" cy="17" rx="4" ry="4.6" fill="none" stroke="#fff" stroke-width="2"/>',
  draw: view,
});
