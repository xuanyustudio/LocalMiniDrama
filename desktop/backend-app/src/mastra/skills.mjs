import fs from 'fs';
import path from 'path';

function acceptSkill(dir, log, validate) {
  const skillFile = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(skillFile) || !fs.statSync(skillFile).isFile()) return null;
  try {
    const markdown = fs.readFileSync(skillFile, 'utf8');
    const result = validate(markdown);
    if (result && result.valid) return path.resolve(dir);
    log.warn(`跳过不合法的 skill：${dir}`);
  } catch (err) {
    log.warn(`跳过不合法的 skill：${dir} (${err.message})`);
  }
  return null;
}

export function listSkillDirectories({ builtinDir, userSkillsDir, log, validate }) {
  const found = [];
  if (builtinDir) {
    const builtin = acceptSkill(builtinDir, log, validate);
    if (builtin) found.push(builtin);
  }
  if (userSkillsDir && fs.existsSync(userSkillsDir)) {
    for (const name of fs.readdirSync(userSkillsDir)) {
      const dir = path.join(userSkillsDir, name);
      if (!fs.statSync(dir).isDirectory()) continue;
      const accepted = acceptSkill(dir, log, validate);
      if (accepted) found.push(accepted);
    }
  }
  return found;
}
