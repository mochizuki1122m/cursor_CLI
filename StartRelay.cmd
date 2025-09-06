@echo off
setlocal
pushd %~dp0

where pwsh >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1"
) else (
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1"
)

popd
endlocal
