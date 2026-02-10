const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
const src = path.join(repoRoot, 'backend-node');
const dest = path.join(__dirname, '..', 'backend-app');

const dirsToCopy = ['src', 'configs', 'scripts', 'migrations'];

if (!fs.existsSync(src)) {
  console.error('backend-node not found at', src);
  process.exit(1);
}

if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
fs.mkdirSync(dest, { recursive: true });

for (const dir of dirsToCopy) {
  const from = path.join(src, dir);
  const to = path.join(dest, dir);
  if (fs.existsSync(from)) {
    fs.cpSync(from, to, { recursive: true });
  }
}

// 若 backend-node 没有 migrations 或目录为空，使用 desktop 自带的初始迁移
const migrationsDest = path.join(dest, 'migrations');
const initialMigrations = path.join(__dirname, 'initial-migrations');
if (!fs.existsSync(migrationsDest)) fs.mkdirSync(migrationsDest, { recursive: true });
const hasSql = fs.existsSync(migrationsDest) && fs.readdirSync(migrationsDest).some((f) => f.endsWith('.sql'));
if (!hasSql && fs.existsSync(initialMigrations)) {
  fs.cpSync(initialMigrations, migrationsDest, { recursive: true });
  console.log('Copied initial-migrations -> desktop/backend-app/migrations');
}

console.log('Copied backend-node (src, configs, scripts, migrations) -> desktop/backend-app');
