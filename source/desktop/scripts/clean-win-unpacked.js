'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync, execSync } = require('child_process');

const unpackedDir = path.join(__dirname, '..', 'release', 'win-unpacked');

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function stopWindowsAppProcesses() {
  if (process.platform !== 'win32') return;
  const names = ['本地短剧助手.exe', 'LocalMiniDrama.exe'];
  for (const name of names) {
    spawnSync('taskkill', ['/F', '/IM', name, '/T'], { stdio: 'ignore', shell: true });
  }
  try {
    const ps = [
      "Get-CimInstance Win32_Process |",
      "Where-Object { $_.ExecutablePath -like '*LocalMiniDrama*' -or $_.ExecutablePath -like '*win-unpacked*' -or $_.Name -like 'LocalMiniDrama*' } |",
      "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
    ].join(' ');
    execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: 'ignore', timeout: 15000 });
  } catch (_) {}
}

function removeDir(dir) {
  if (!fs.existsSync(dir)) {
    log('[clean] release/win-unpacked not found, skip');
    return true;
  }
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    log('[clean] release/win-unpacked removed');
    return true;
  } catch (err) {
    const stale = `${dir}.stale-${Date.now()}`;
    try {
      fs.renameSync(dir, stale);
      log(`[clean] could not delete win-unpacked, renamed to ${path.basename(stale)}`);
      return true;
    } catch (renameErr) {
      log(`[clean] FAILED: ${err.message}`);
      log('[clean] Close running LocalMiniDrama exe, close Explorer on release/win-unpacked, then retry.');
      log('[clean] Or reboot if antivirus is scanning app.asar.');
      return false;
    }
  }
}

stopWindowsAppProcesses();
if (!removeDir(unpackedDir)) process.exit(1);
log('[clean] ready for electron-builder');
