@echo off
set ROOT=%~dp0

echo [1/2] Starting backend (backend-node)...
start "Backend" cmd /k "cd /d %ROOT%backend-node && npm run dev"

echo [2/2] Starting frontend (frontweb)...
start "Frontend" cmd /k "cd /d %ROOT%frontweb && npm run dev"

echo Done. Backend: http://localhost:3013  Frontend: http://localhost:5173

timeout /t 3 /nobreak >nul
start http://localhost:3013
