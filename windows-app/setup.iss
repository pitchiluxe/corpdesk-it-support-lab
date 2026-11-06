#ifndef AppOutput
  #define AppOutput "publish"
#endif
#ifndef AppVersion
  #define AppVersion "1.0.6"
#endif
[Setup]
AppId={{A24C625D-ECFD-4AF2-98D2-42EB1214BB42}
AppName=CORP Desk IT Support Lab
AppVersion={#AppVersion}
AppPublisher=Erick Omari · Pitchiluxe
AppPublisherURL=https://github.com/pitchiluxe
DefaultDirName={localappdata}\Programs\CORP Desk
DefaultGroupName=CORP Desk
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist\downloads
OutputBaseFilename=CORP-Desk-Setup
SetupIconFile=..\dist\assets\corpdesk.ico
UninstallDisplayIcon={app}\CorpDesk.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
MinVersion=10.0
[Tasks]
Name: desktopicon; Description: Create a desktop shortcut; GroupDescription: Shortcuts:; Flags: unchecked
[Files]
Source: {#AppOutput}\*; DestDir: {app}; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: {group}\CORP Desk; Filename: {app}\CorpDesk.exe; WorkingDir: {app}
Name: {autodesktop}\CORP Desk; Filename: {app}\CorpDesk.exe; WorkingDir: {app}; Tasks: desktopicon
[Run]
Filename: {app}\CorpDesk.exe; Description: Launch CORP Desk; Flags: nowait postinstall skipifsilent
