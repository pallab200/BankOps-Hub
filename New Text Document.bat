@echo off
setlocal EnableDelayedExpansion

set "APPNAME=BankOps Hub"
set "SRCDIR=%~dp0"
set "INSTALLDIR=%USERPROFILE%\Documents\%APPNAME%"
set "HTMLFILE=BankOps Hub.html"

:: Detect Desktop path
if exist "%USERPROFILE%\OneDrive\Desktop" (
    set "DESKTOP=%USERPROFILE%\OneDrive\Desktop"
) else (
    set "DESKTOP=%USERPROFILE%\Desktop"
)

echo Installing %APPNAME%...
echo Desktop path: %DESKTOP%
echo.

:: Create install directory
if not exist "%INSTALLDIR%" mkdir "%INSTALLDIR%"

:: Copy all files
xcopy "%SRCDIR%*" "%INSTALLDIR%\" /E /I /Y >nul

:: Create Desktop Shortcut
powershell -NoProfile -ExecutionPolicy Bypass ^
"$ws = New-Object -ComObject WScript.Shell; ^
$sc = $ws.CreateShortcut('%DESKTOP%\%APPNAME%.lnk'); ^
$sc.TargetPath = '%INSTALLDIR%\%HTMLFILE%'; ^
$sc.WorkingDirectory = '%INSTALLDIR%'; ^
$sc.Save()"

echo.
echo Installation completed
echo Desktop shortcut created
echo.
pause
