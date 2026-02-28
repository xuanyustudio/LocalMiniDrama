@echo off
set ROOT=%~dp0

echo [0/2] Checking port 5679...
netstat -ano > "%TEMP%\lmd_netstat.txt" 2>&1
findstr ":5679 " "%TEMP%\lmd_netstat.txt" | findstr "LISTENING" > "%TEMP%\lmd_port.txt" 2>&1
for /f "tokens=5" %%a in (%TEMP%\lmd_port.txt) do (
  echo   Killing old process on port 5679 ^(PID %%a^)...
  taskkill /PID %%a /F >nul 2>&1
)
del "%TEMP%\lmd_netstat.txt" >nul 2>&1
del "%TEMP%\lmd_port.txt" >nul 2>&1

echo [1/2] Starting backend (backend-node)...
start "Backend" cmd /k "cd /d %ROOT%backend-node && npm run dev"

echo [2/2] Starting frontend (frontweb)...
start "Frontend" cmd /k "cd /d %ROOT%frontweb && npm run dev"

echo Done. Backend: http://localhost:3013  Frontend: http://localhost:5173

timeout /t 3 /nobreak >nul
start http://localhost:3013
