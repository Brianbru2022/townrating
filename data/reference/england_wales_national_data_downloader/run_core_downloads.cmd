@echo off
setlocal
cd /d "%~dp0"

echo England and Wales National Heritage Data Downloader
echo ----------------------------------------------------
echo This downloads the core Historic England and Cadw/DataMapWales layers.
echo Large optional, local-HER and portal-only sources are not included in this run.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\01_download_england_heritage.ps1"
if errorlevel 1 echo WARNING: England script reported an error. Review the messages above.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\02_download_wales_heritage.ps1"
if errorlevel 1 echo WARNING: Wales heritage script reported an error. Review the messages above.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\03_download_wales_historical_boundaries.ps1"
if errorlevel 1 echo WARNING: Wales historical-boundary script reported an error. Review the messages above.

echo.
echo Core run finished. Check the downloads folder and each _download_manifest.csv file.
pause
