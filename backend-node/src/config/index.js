const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const configPaths = [
  path.join(process.cwd(), 'configs', 'config.yaml'),
  path.join(process.cwd(), 'config.yaml'),
  path.join(__dirname, '..', '..', 'configs', 'config.yaml'),
];

const examplePaths = [
  path.join(process.cwd(), 'configs', 'config.example.yaml'),
  path.join(__dirname, '..', '..', 'configs', 'config.example.yaml'),
];

function loadConfig() {
  let raw = null;
  for (const p of configPaths) {
    if (fs.existsSync(p)) {
      raw = fs.readFileSync(p, 'utf8');
      break;
    }
  }
  if (!raw) {
    for (const p of examplePaths) {
      if (fs.existsSync(p)) {
        raw = fs.readFileSync(p, 'utf8');
        break;
      }
    }
  }
  if (!raw) {
    throw new Error('Config file not found. Copy configs/config.example.yaml to configs/config.yaml');
  }
  const parsed = yaml.load(raw);
  if (!parsed?.app?.name) {
    throw new Error('Invalid config: missing app section');
  }
  return parsed;
}

module.exports = { loadConfig };
