@echo off
setlocal
set FIREBASE_FUNCTIONS_DISCOVERY_OUTPUT_PATH=true
node "%~dp0node_modules\firebase-tools\lib\bin\firebase.js" %*
exit /b %ERRORLEVEL%
