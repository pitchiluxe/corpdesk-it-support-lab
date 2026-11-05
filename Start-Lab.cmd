@echo off
cd /d "%~dp0"
echo CORP Desk training simulator
echo Open http://127.0.0.1:8765 in your browser.
echo Keep this window open. Press Ctrl+C to stop.
node server.cjs
pause
