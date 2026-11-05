# CORP Desk Windows application

Windows 10/11 x64. Built with .NET 10 WinForms and Microsoft's WebView2 SDK. The app bundles .NET; it uses the installed Microsoft Edge WebView2 Evergreen Runtime. This preview is not code-signed.

Build from the project root:

```powershell
.\windows-app\build.ps1
```

Output: `dist/downloads/CORP-Desk-Setup.exe`. The installer uses per-user installation, Start menu shortcuts, optional desktop shortcut, and the standard Windows uninstaller. It does not install Ollama, pull models, modify Windows accounts, or enable a network listener.

Local assets are mapped to `https://corpdesk.local` inside WebView2. This is virtual-host content mapping, not a public DNS entry or remote server. Native IPC accepts requests only from that local origin. Untrusted websites run in a separate browser WebView with web messaging disabled. Only HTTP(S) navigation is accepted there; certificate protections are not bypassed. Permission requests ask the user. Installed Ollama launch is limited to known program locations.

The app checks local Ollama at `127.0.0.1:11434` using a proxy-free client. Only already-downloaded local models are accepted. An unavailable model/service produces an error or offline availability state rather than a fabricated response. No cloud-model fallback is configured.

Smoke check (no installer execution):

```powershell
.\windows-app\publish\CorpDesk.exe --self-test "$PWD\desktop-smoke.json"
```

It checks packaged content, WebView2 Runtime availability, browser address/search normalization, and local Ollama discovery. Model inference and arbitrary external website compatibility are separate runtime checks. Run the portable preview with `--profile <workspace-folder>` to isolate preview data from installed-user data.

Build references: [WebView2 WinForms setup](https://learn.microsoft.com/en-us/microsoft-edge/webview2/get-started/winforms), [Microsoft WebView2 package](https://www.nuget.org/packages/Microsoft.Web.WebView2/1.0.4314.35), [Ollama API](https://docs.ollama.com/api).
