# CORP Desk: lab guide and job-search playbook

This guide does three things:

1. **Explains every lab**: the situation, what you must do, what is checked, and why it matters in a real job.
2. **Shows you how to advertise the work** on LinkedIn, with post templates, and how to film or screenshot it.
3. **Shows you how to publish it on GitHub** as a portfolio recruiters can open.

> Every lab rolls a **new random scenario** when you start it (different people, departments, printers, keys, phishing domains, and sometimes a twist). Read each ticket carefully: the steps below tell you *what kind* of work it is, not the answer.

---

## Part 1 — How the lab works

- **Start here:** the **IT Support Career Path** card on the desktop. Click **Start lab**. The Service Desk opens on the ticket and the fault is injected.
- **Work like the job:** read the ticket, open the tools listed under *Tools for this incident*, investigate before you change anything, and collect the evidence on the checklist.
- **Resolve:** write resolution notes (root cause, change, verification) and click **Validate & resolve**. The lab checks your evidence *and the live state of the systems*. Wrong or excessive changes fail.
- **Practise again:** a resolved lab offers **Practise again with a new scenario**.
- **Passwords:** `Pwd` on the desktop lists every lab account and its training password. Five wrong passwords lock an account, just like the domain policy. (In a real job you would never keep such a file.)
- **Certificate:** finish all 13 career-path labs. The lab asks for your full name and prints a certificate (Career Path > Certificate > Print / Save as PDF).
- **Start over:** Career Path > Certificate > **Reset lab**, or Start > Power > **Reset lab**.

---

## Part 2 — The labs

### Module 1 · Service desk basics

#### LAB-001 · Account locked after failed sign-ins
- **Situation:** an HR user is locked out.
- **Do:** check the account state in ADUC or PowerShell (`Get-ADUser hr01 -Properties LockedOut`). Tell *locked* apart from *disabled*. Unlock it, then prove a sign-in works (Remote Desktop > Verify a sign-in, with the password from `Pwd`).
- **Checked:** account unlocked and enabled; you inspected it and tested a sign-in.
- **Real job:** lockouts are the single most common ticket. Always find out *why* (a phone with an old password?) and say so in the notes.

#### LAB-002 · Workstation cannot locate the domain
- **Situation:** the server responds by IP, but names do not resolve.
- **Do:** `ipconfig /all`, compare the DNS server with the documented 10.77.0.10, fix it, then `Resolve-DnsName` to prove it.
- **Checked:** DNS points at the domain controller; you inspected and verified resolution.
- **Real job:** "It's always DNS." Separate network transport (ping by IP) from name resolution.

### Module 2 · Joiners, movers and leavers (JML)

#### LAB-006 · Joiner: new hire starts soon
- **Situation:** a manager emails an approved onboarding request (random person, department, title and manager; sometimes shared mailbox access too).
- **Do:** read the request in **Outlook**. In **ADUC** create the user in the right department OU, set the job title and manager, add the department role group, and require a password change at first logon. Run a **delta sync** (Microsoft 365 admin > Run delta sync, or `Start-ADSyncSyncCycle -PolicyType Delta`). Assign **Microsoft 365 E3** so a mailbox is created. Grant shared mailbox access only if requested, and only Read (no Send As).
- **Checked:** every attribute, group, sync, licence and mailbox, plus no extra access.
- **Real job:** onboarding is planned work driven by HR. In hybrid companies, cloud access comes after sync.

#### LAB-013 · Mover: internal transfer
- **Situation:** HR transfers someone from one department to another.
- **Do:** move the user to the new OU, **remove the old role group** and add the new one, update Department, Job title and Manager, and remove the old team's shared mailbox access if they had it.
- **Checked:** new access granted *and* old access removed.
- **Real job:** movers are where "access creep" happens. Removing old access the same day is the difference between a good and a great technician.

#### LAB-004 · Wrong access to Finance files
- **Situation:** an HR employee can open the Finance share.
- **Do:** find the wrong group membership, remove only that, and verify that HR access works and Finance staff are unaffected.
- **Real job:** least privilege and access reviews.

#### LAB-007 · Leaver: termination today
- **Situation:** HR sends a leaver notice (random person and manager).
- **Do:** **disable** (never delete) the account, move it to the Disabled OU, remove its groups. In Microsoft 365: **block sign-in**, **sign out of all sessions**, **convert the mailbox to shared** and give the manager Full Access, then **remove the licence**. Remove shared mailbox access if the notice says so.
- **Checked:** all of the above, with sessions revoked after the incident started.
- **Real job:** leavers are a security process. Keep the data, cut the access, free the licence.

### Module 3 · Identity, MFA and access

#### LAB-009 · New phone: MFA reset (or not?)
- **Situation:** a caller says they got a new phone.
- **Do:** click **Verify caller** and choose a safe method (a call-back to the number on file). If they are genuine, then in **Entra admin center**: delete the old Authenticator, **Require re-register MFA**, and **Revoke sessions**. **About 1 in 3 calls is an impostor:** the call-back reaches the real employee. Then change nothing and **Escalate to Security**.
- **Checked:** the right outcome for that caller.
- **Real job:** MFA-reset social engineering is how many real breaches start. "Verify, then act" is a hiring question.

#### LAB-012 · Shared mailbox access request
- **Situation:** someone needs access to a team mailbox.
- **Do:** read the owner's approval in Outlook. Grant **exactly** what it says (sometimes Read only, sometimes Read + Send As).
- **Checked:** the right person, the right rights, and nobody else.

#### LAB-003 · Unauthorized local admin
- **Do:** remove the employee from the local Administrators group and keep the support admin account.

### Module 4 · Devices, printing and policy

#### LAB-008 · A department cannot print
- **Situation:** a random printer and queue. Sometimes the **Print Spooler has stopped**; sometimes it is running but a **corrupt job jams the queue**.
- **Do:** check Print Management and Services (or `Get-Service Spooler`, `Get-PrintJob`). Start the spooler if needed, cancel **only** the job in error, and print a test page.
- **Real job:** printing is one of the top call drivers.

#### LAB-010 · BitLocker recovery screen
- **Situation:** a random user and device; the device has several keys.
- **Do:** verify the caller. In **Entra > Devices > the device > BitLocker keys**, match the **Key ID** the user reads out, then **Provide recovery key**.
- **Checked:** the correct key for the correct, verified person.

#### LAB-005 · Missing security baseline (Group Policy)
- **Do:** move the computer to the OU where the GPO is linked, then `gpupdate /force` and check the resulting policy.

### Module 5 · Security incident response

#### LAB-011 · Phishing
- **Situation:** a random lure and domain. Sometimes the user **typed their password**, sometimes they did not.
- **Do:** in Outlook **View message details** (SPF/DKIM/DMARC fail, mismatched Return-Path) and **Report phishing**. In Microsoft 365 > **Explorer**, find every copy and **soft delete** it; add the domain to the **Tenant Allow/Block List**. If a password was entered, **reset it** and **revoke sessions**.
- **Real job:** contain first, then escalate with evidence.

### Practice tickets
Tickets you create (**New**) or generate (**Generate practice tickets**) in the Service Desk appear in **Career Path > Practice tickets**. They count in your portfolio export, not toward the certificate.

---

## Part 3 — Record your work (screenshots and video)

For each lab, capture **four images**:
1. **The ticket**: the problem as reported.
2. **The investigation**: the evidence (e.g. message headers, the print queue in error, the Key ID match).
3. **The fix**: the tool where you made the change.
4. **The proof**: the resolved ticket with your notes.

Video (60–90 seconds, made with the Windows Snipping Tool's screen recorder or OBS):
- 0–10 s: "Here's a real-world ticket: …"
- 10–60 s: investigate, fix, verify, narrating *why*.
- 60–90 s: "What I'd tell the user, and how I'd stop it happening again."

Use **Career Path > Interview & portfolio > Export my portfolio** to get a Markdown file with your completed labs and your own resolution notes.

---

## Part 4 — LinkedIn posts

Post once per module (5 posts over 2–3 weeks) and finish with your certificate. Keep each post short, specific and honest. Always say it was a **lab / simulation**.

### Template A — one lab
> 🔧 **Hands-on IT support lab: [lab name]**
>
> **Scenario:** [one sentence from the ticket].
> **What I did:**
> • [investigation step and the tool]
> • [the fix]
> • [how I verified it]
>
> **What I learned:** [one real-world lesson, e.g. "disable leavers, don't delete them: you keep the mailbox and the audit trail."]
>
> Practised in CORP Desk, a Windows / Active Directory / Microsoft 365 service desk simulator. 📹 Video below.
>
> #ITSupport #HelpDesk #ActiveDirectory #Microsoft365 #CareerChange #OpenToWork

### Template B — a module (JML example)
> I just finished the **Joiner–Mover–Leaver** module of my IT support lab:
> ✅ Onboarded a new hire from an HR request (AD account, role group, Entra Connect sync, E3 licence, mailbox)
> ✅ Transferred an employee and removed their old access the same day
> ✅ Offboarded a leaver: disabled, sessions revoked, mailbox converted to shared for the manager, licence reclaimed
>
> The lesson that stuck: access changes need an approval *and* a clean-up. 🎯
> #IdentityAndAccess #ITSupport #ServiceDesk

### Template C — security
> 🎣 Phishing response, Tier 1 style: headers (SPF fail, mismatched Return-Path) → report → purge every copy tenant-wide → block the domain → reset the password and revoke sessions because credentials were entered. Then escalate with the evidence.
> #CyberSecurity #ITSupport #Microsoft365

### Template D — certificate
> 🎓 I completed the **IT Support Career Path**: 13 randomized, real-world service desk incidents across Active Directory, Microsoft 365, Entra ID, printing, BitLocker and phishing response. Portfolio and write-ups: [GitHub link]. I'm looking for a **Service Desk / IT Support** role — I'd love to connect!

**Tips:** put the image or video first; tag skills, not buzzwords; reply to every comment; add the certificate under *Licenses & certifications* (issuing organization: "CORP Desk (training simulator)") and the GitHub repo under *Featured*.

---

## Part 5 — Publish on GitHub

1. **Create the repository:** on github.com click **New repository**, name it `it-support-labs`, make it **Public**, and tick **Add a README**.
2. **Create this folder structure** (on your PC, or with **Add file > Upload files**):
   ```
   it-support-labs/
   ├── README.md
   ├── certificate/CORP-Desk-Certificate.pdf
   ├── portfolio/CORP-Desk-Portfolio-Your-Name.md   (from "Export my portfolio")
   └── labs/
       ├── 01-account-lockout/      (screenshots + notes.md)
       ├── 06-joiner/
       ├── 13-mover/
       ├── 07-leaver/
       ├── 09-mfa-reset/
       ├── 10-bitlocker/
       ├── 08-printing/
       ├── 11-phishing/
       └── 12-shared-mailbox/
   ```
3. **Write `notes.md` for each lab:** Scenario · Investigation · Fix · Verification · What I'd do differently · Skills.
4. **Upload from the command line** (if you use Git):
   ```bash
   git clone https://github.com/<your-username>/it-support-labs.git
   ```
   ```bash
   cd it-support-labs
   ```
   Copy in your files, then:
   ```bash
   git add .
   ```
   ```bash
   git commit -m "Add CORP Desk IT support lab portfolio"
   ```
   ```bash
   git push
   ```
5. **README template:**
   ```markdown
   # IT Support Labs — <Your Name>
   Hands-on service desk work in CORP Desk (Windows, Active Directory, Microsoft 365, Entra ID).
   | Lab | Skills | Evidence |
   |---|---|---|
   | Joiner / Mover / Leaver | AD, Entra Connect, licences, mailboxes | [notes](labs/06-joiner/notes.md) |
   | MFA reset with caller verification | Entra ID, social engineering defence | [notes](labs/09-mfa-reset/notes.md) |
   | Phishing response | Headers, Explorer purge, block list | [notes](labs/11-phishing/notes.md) |
   🎓 [Certificate](certificate/CORP-Desk-Certificate.pdf) · 📹 [Videos](https://linkedin.com/in/<you>)
   ```
6. **Pin the repository** on your GitHub profile, and put the link in your LinkedIn *Featured* section and on your CV.

---

## Part 6 — Turn it into a job

**CV bullets (adapt them to what you did):**
- Resolved 13 simulated service desk incidents end to end (identity, Microsoft 365, printing, BitLocker, phishing), each validated against the live system state.
- Ran joiner/mover/leaver processes in hybrid AD + Entra ID: account creation, sync, licensing, access removal and leaver offboarding.
- Applied caller verification before MFA and BitLocker requests, and escalated an impersonation attempt instead of resetting.

**STAR stories:** pick three labs (one JML, one security, one troubleshooting) and practise *Situation, Task, Action, Result* out loud. Use **Career Path > Interview & portfolio** for the questions.

**Be honest:** say "in a lab" or "in a simulator". Employers value initiative and clear thinking, and you can explain every click.
