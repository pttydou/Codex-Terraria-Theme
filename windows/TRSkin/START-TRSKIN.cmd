@echo off
setlocal
title TR Skin
color 0A
echo.
echo ========================================
echo   TR SKIN - Codex Terraria Skin
echo ========================================
echo   Starting installer and control center...
echo.
set "LAUNCHER=%~dp0core\scripts\one-click-dream-skin.ps1"
if not exist "%LAUNCHER%" (
  echo TR Skin files are incomplete. Extract the full ZIP and try again.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%"
if errorlevel 1 (
  echo.
  echo TR Skin could not start. Review the message above.
  pause
  exit /b 1
)
