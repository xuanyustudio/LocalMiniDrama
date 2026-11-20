@echo off
chcp 65001 >nul
if not exist "%~dp0backend-node\.env" copy "%~dp0backend-node\.env.example" "%~dp0backend-node\.env" >nul
start "" notepad.exe "%~dp0backend-node\.env"
echo 请在打开的记事本中填入密钥，保存后回到此窗口。
pause
if exist "%~dp0runtime-node-test\node.exe" (
  "%~dp0runtime-node-test\node.exe" "%~dp0backend-node\tools\activate-free-text.js"
) else (
  node "%~dp0backend-node\tools\activate-free-text.js"
)
pause
