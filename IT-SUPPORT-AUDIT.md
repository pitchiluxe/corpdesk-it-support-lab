# CORP Desk: IT support readiness audit

What a new service desk / desktop support technician does in their first months, compared with what the lab let you practise, and what was added.

## Findings (before)

| Area | Real job | Lab before | Gap |
|---|---|---|---|
| Ticket handling | Every task is a ticket with notes, priority, verification | Service Desk with 5 graded incidents | Good base, but only 5 scenarios |
| Joiners / movers / leavers | Daily: new hires, role changes, terminations | One "wrong access" incident (mover) | No onboarding, no offboarding |
| Microsoft 365 | Licences, mailboxes, shared mailboxes, sign-in blocks | None | Missing entirely |
| Hybrid identity | AD accounts reach the cloud via Entra Connect sync | None | Missing |
| MFA and sign-in | New phone, lost phone, re-registration, revoke sessions | None | Missing |
| Social engineering | Verify callers before resets | Not taught | Missing (a top real-world risk) |
| Devices | BitLocker recovery, compliance | None | Missing |
| Printing | Spooler, stuck queues, test pages (top call driver) | Spooler existed only as a PowerShell service | No print tooling or scenario |
| Security | Phishing reports, header analysis, purge, block | None | Missing |
| Tools | ServiceNow, ADUC, M365 admin, Entra admin, Outlook, services.msc, Print Management | Service Desk, ADUC, PowerShell, Event Viewer | Most admin tools missing |
| Guidance | Clear progression, interview readiness | Lab Guide only | No pathway or job mapping |
| Shell | Windows 11 Start, dark mode | Simple app list; dark only in Settings | Not like Windows |

## What was added

**Tools (work like the real ones, so the learner knows where to click):**
- Microsoft 365 admin center: active users, licences, mailbox conversion and permissions, shared mailboxes, directory sync status (Run delta sync), Explorer (purge a message from all mailboxes), Tenant Allow/Block List.
- Microsoft Entra admin center: authentication methods, require MFA re-registration, revoke sessions, devices with BitLocker recovery keys.
- Outlook: the shared service desk mailbox, message details (headers), Report phishing.
- Services (services.msc) and Print Management (printmanagement.msc), sharing state with PowerShell.
- PowerShell: `Start-ADSyncSyncCycle -PolicyType Delta`, `Get-Printer`, `Get-PrintJob`, `Remove-PrintJob`, `Print-TestPage`.
- Run dialog: `services.msc`, `printmanagement.msc`, `outlook`, `admin.microsoft.com`, `entra.microsoft.com`.

**Seven graded real-world incidents (LAB-006 to LAB-012):** onboarding a new hire, terminating a leaver, a jammed print queue, an MFA reset for a new phone, BitLocker recovery, a phishing compromise, and a shared mailbox access request. Each injects a fault, needs evidence collected in the real tools, and is validated against the live system state (wrong keys, over-granted access and skipped verification fail).

**Caller verification** on MFA and BitLocker tickets: unsafe choices (asking for a password, trusting a name) are refused with the reason.

**IT Support Career Path** (desktop card and app): five modules in order, the next lab one click away, where each real tool lives, and interview questions tied to the labs you completed.

**Windows 11 Start** (Pinned, All apps, Recommended, search across apps, Settings and incidents, account and power menus, Ctrl+Esc) and **system-wide dark mode** (tray toggle, or Settings > Personalization > Colors).

## Still not covered (next candidates)

- Remote assistance with Quick Assist, and a slow-PC lab (Task Manager, startup apps, disk space).
- Software requests through Company Portal / Intune, and device compliance remediation.
- Mapped drives and VPN connectivity scenarios.
- Escalation and SLA handling: assigning to Tier 2, breach timers, customer communication templates.
- A timed "shift" mode that mixes tickets by priority.
