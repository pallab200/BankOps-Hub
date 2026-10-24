@echo off
setlocal enabledelayedexpansion
title e-GP Auto Fetcher - User Level Installer (No Admin Required)

cd /d "%~dp0"
echo ========================================================
echo   e-GP Auto Fetcher - Non-Admin User Installer
echo ========================================================
echo.
echo Installing for current user only (No Administrator needed)...
echo.

set "EXT_ID=niaeibogofdcekojlmpoagmkiffnpdbn"
set "XML_PATH=%~dp0update.xml"
set "XML_PATH=!XML_PATH:\=/!"
set "XML_URL=file:///!XML_PATH!"
set "FORCELIST_VAL=!EXT_ID!;!XML_URL!"

:: Register only in HKCU (HKEY_CURRENT_USER - No Admin privileges required)
echo [1/2] Setting Edge User Policy...
reg add "HKCU\Software\Policies\Microsoft\Edge\ExtensionInstallForcelist" /v 1 /t REG_SZ /d "!FORCELIST_VAL!" /f >nul 2>&1
reg add "HKCU\Software\Policies\Microsoft\Edge\ExtensionInstallSources" /v 1 /t REG_SZ /d "file:///*" /f >nul 2>&1
reg add "HKCU\Software\Policies\Microsoft\Edge\ExtensionInstallAllowlist" /v 1 /t REG_SZ /d "!EXT_ID!" /f >nul 2>&1

echo [2/2] Setting Chrome User Policy...
reg add "HKCU\Software\Policies\Google\Chrome\ExtensionInstallForcelist" /v 1 /t REG_SZ /d "!FORCELIST_VAL!" /f >nul 2>&1
reg add "HKCU\Software\Policies\Google\Chrome\ExtensionInstallSources" /v 1 /t REG_SZ /d "file:///*" /f >nul 2>&1
reg add "HKCU\Software\Policies\Google\Chrome\ExtensionInstallAllowlist" /v 1 /t REG_SZ /d "!EXT_ID!" /f >nul 2>&1

echo.
echo ========================================================
echo   COMPLETE: User policy applied successfully!
echo ========================================================
echo.
echo If your bank policy allows HKCU policies, the extension will appear
echo automatically when you restart Edge/Chrome.
echo.
echo Note: You can also use Edge "Load Unpacked" (Developer Mode ON)
echo which works 100%% on ALL Windows PCs without any admin rights.
echo.
pause
