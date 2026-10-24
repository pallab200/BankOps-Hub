@echo off
title e-GP Manager - Automated Fetcher
echo ================================================================
echo Starting e-GP Manager with e-GP Live Fetcher...
echo ================================================================
python server.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Python was not found in PATH or exited with an error.
    echo Opening e-GP Manager.html directly in browser...
    start "" "e-GP Manager.html"
    pause
)
