@echo off
if not exist "%~dp0backend-node\.env" copy "%~dp0backend-node\.env.example" "%~dp0backend-node\.env" >nul
start "" notepad.exe "%~dp0backend-node\.env"
