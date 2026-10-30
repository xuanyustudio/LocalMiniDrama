import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { dramaThreadId } from './context.mjs';
import { resolveTextModel } from './model.mjs';
import { listSkillDirectories } from './skills.mjs';
import { guardDeleteApproval, toAgentSseEvent } from './sse.mjs';
import * as tools from './tools.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

let ready = false;
let agent;
let memory;
let appDb;
let appLog;
let appConfig;

function warn(message, err) {
  const error = err && err.message ? err.message : String(err || '');
  if (appLog && appLog.warn) appLog.warn(message, { error });
  else console.warn(message, error);
}

function readScope(ctx) {
  const source = ctx && ctx.requestContext;
  if (source && typeof source.get === 'function') {
    return { dramaId: source.get('dramaId'), episodeId: source.get('episodeId') };
  }
  return {
    dramaId: source && source.dramaId,
    episodeId: source && source.episodeId,
  };
}

function validateSkillMarkdown(markdown) {
  const fence = String(markdown || '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fence) return { valid: false };
  return { valid: /^name:\s*\S+/m.test(fence[1]) };
}

function loadService(name) {
  return require(`../services/${name}`);
}

function generationDeps() {
  return {
    startStoryGeneration: loadService('storyGenerationService.js').startStoryGeneration,
    generateCharacters: loadService('characterGenerationService.js').generateCharacters,
    extractBackgroundsForEpisode: loadService('backgroundExtractionService.js').extractBackgroundsForEpisode,
    generateStoryboard: loadService('episodeStoryboardService.js').generateStoryboard,
    generateCharacterFourViewImage: loadService('characterLibraryService.js').generateCharacterFourViewImage,
    generateSceneSingleImage: loadService('sceneService.js').generateSceneSingleImage,
    generateSceneFourViewImage: loadService('sceneService.js').generateSceneFourViewImage,
    updateStoryboard: loadService('storyboardService.js').updateStoryboard,
    createImage: loadService('imageService.js').create,
  };
}

function tool(id, description, inputSchema, execute, extra) {
  return createTool({ id, description, inputSchema, execute, ...extra });
}

function buildTools() {
  const empty = z.object({});
  return {
    get_current_project: tool('get_current_project', '读取当前短剧、分集、角色、场景和分镜', empty, async (_input, ctx) => {
      const scope = readScope(ctx);
      return tools.executeGetCurrentProject(appDb, scope.dramaId, scope.episodeId);
    }),
    generate_story: tool('generate_story', '为当前短剧生成剧本', empty, async (_input, ctx) => {
      const scope = readScope(ctx);
      return tools.executeGenerateStory(appDb, appLog, scope.dramaId, generationDeps());
    }),
    save_episode_script: tool('save_episode_script', '保存当前集的剧本', z.object({
      title: z.string().optional(),
      script: z.string(),
    }), async (input, ctx) => {
      const scope = readScope(ctx);
      return tools.executeSaveEpisodeScript(appDb, scope.dramaId, scope.episodeId, {
        title: input.title,
        scriptContent: input.script,
      });
    }),
    generate_characters: tool('generate_characters', '为当前集生成角色', empty, async (_input, ctx) => {
      const scope = readScope(ctx);
      return tools.executeGenerateCharacters(appDb, appConfig, appLog, scope.dramaId, scope.episodeId, generationDeps());
    }),
    update_character: tool('update_character', '新建或修改当前剧的角色', z.object({
      id: z.number().optional(),
      name: z.string().optional(),
      role: z.string().optional(),
      appearance: z.string().optional(),
      personality: z.string().optional(),
      description: z.string().optional(),
    }), async (input, ctx) => {
      const scope = readScope(ctx);
      return tools.executeUpdateCharacter(appDb, appLog, scope.dramaId, scope.episodeId, input);
    }),
    generate_scenes: tool('generate_scenes', '从当前集剧本提取场景', empty, async (_input, ctx) => {
      const scope = readScope(ctx);
      return tools.executeGenerateScenes(appDb, appConfig, appLog, scope.dramaId, scope.episodeId, generationDeps());
    }),
    update_scene: tool('update_scene', '新建或修改当前剧的场景', z.object({
      id: z.number().optional(),
      location: z.string().optional(),
      time: z.string().optional(),
      prompt: z.string().optional(),
    }), async (input, ctx) => {
      const scope = readScope(ctx);
      return tools.executeUpdateScene(appDb, appLog, scope.dramaId, scope.episodeId, input);
    }),
    generate_storyboards: tool('generate_storyboards', '为当前集生成分镜', z.object({
      storyboardCount: z.number().optional(),
    }), async (input, ctx) => {
      const scope = readScope(ctx);
      return tools.executeGenerateStoryboards(appDb, appLog, scope.dramaId, scope.episodeId, input, generationDeps());
    }),
    update_storyboard: tool('update_storyboard', '修改当前剧的一条分镜', z.object({
      id: z.number(),
      dialogue: z.string().optional(),
      action: z.string().optional(),
      description: z.string().optional(),
      imagePrompt: z.string().optional(),
    }), async (input, ctx) => {
      const scope = readScope(ctx);
      return tools.executeUpdateStoryboard(appDb, appLog, scope.dramaId, input);
    }),
    generate_image: tool('generate_image', '为角色、场景或分镜出图', z.object({
      type: z.enum(['character', 'scene', 'storyboard']),
      id: z.number(),
      view: z.enum(['single', 'four']).optional(),
      prompt: z.string().optional(),
    }), async (input, ctx) => {
      const scope = readScope(ctx);
      return tools.executeGenerateImage(appDb, appLog, appConfig, scope.dramaId, input, generationDeps());
    }),
    get_task: tool('get_task', '查询当前剧的一个生成任务', z.object({
      taskId: z.string(),
    }), async (input, ctx) => {
      const scope = readScope(ctx);
      return tools.executeGetTask(appDb, scope.dramaId, input);
    }),
    delete_item: tool('delete_item', '删除当前剧的角色、场景或分镜，必须等用户允许', z.object({
      type: z.enum(['character', 'scene', 'storyboard']),
      id: z.number(),
    }), async (input, ctx) => {
      const scope = readScope(ctx);
      return tools.executeDeleteItem(appDb, appLog, scope.dramaId, input);
    }, {
      requireApproval: true,
      beforeApproval(input, ctx) {
        const scope = readScope(ctx);
        const guard = guardDeleteApproval(appDb, scope.dramaId, input);
        if (guard.action === 'decline') return { proceed: false, output: { ok: false, error: guard.error } };
      },
    }),
  };
}

function messageText(message) {
  const content = message && message.content;
  if (typeof content === 'string') return content;
  const parts = Array.isArray(content) ? content : (content && Array.isArray(content.parts) ? content.parts : []);
  return parts.map((part) => (part && part.type === 'text' ? part.text || '' : '')).join('');
}

async function emitStream(output, dramaId, writeEvent) {
  const stream = output && output.fullStream ? output.fullStream : output;
  for await (const chunk of stream) {
    const event = toAgentSseEvent(chunk);
    if (!event) continue;
    if (event.type === 'tool-call-approval') {
      const guard = guardDeleteApproval(appDb, dramaId, { type: event.itemType, id: event.id });
      if (guard.action === 'ask') event.label = guard.label;
    }
    writeEvent(event);
  }
  writeEvent({ type: 'done' });
}

function threadOptions(dramaId, requestContext) {
  const thread = dramaThreadId(dramaId);
  return {
    requestContext,
    memory: { thread, resource: thread },
  };
}

export function isAgentReady() {
  return ready;
}

export async function initAgent({ db, log, config, dataDir }) {
  ready = false;
  appDb = db;
  appLog = log;
  appConfig = config || {};
  try {
    const dir = dataDir || path.join(process.cwd(), 'data');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'agent.db').replace(/\\/g, '/');
    const storage = new LibSQLStore({ id: 'drama-agent', url: `file:${file}` });
    memory = new Memory({ storage, options: { lastMessages: 20, semanticRecall: false } });
    const builtinDir = path.resolve(here, '../../skills/short-drama');
    const userSkillsDir = path.join(dir, 'skills');
    agent = new Agent({
      id: 'drama-assistant',
      name: '短剧助手',
      instructions: '你是本地短剧助手。只操作当前打开的短剧。删除必须调用 delete_item 并等待用户允许。没有出视频、导入导出、道具、新建或删除整部剧的工具。',
      model: () => {
        const resolved = resolveTextModel(appDb);
        if (!resolved.ok) throw new Error(resolved.error);
        return resolved.model;
      },
      tools: buildTools(),
      skills: () => listSkillDirectories({
        builtinDir,
        userSkillsDir,
        log: appLog || { warn() {} },
        validate: validateSkillMarkdown,
      }),
      memory,
      requestContextSchema: z.object({
        dramaId: z.number(),
        episodeId: z.number().nullable(),
      }),
    });
    new Mastra({ agents: { dramaAssistant: agent }, storage });
    ready = true;
  } catch (err) {
    ready = false;
    agent = undefined;
    memory = undefined;
    warn('助手初始化失败', err);
  }
}

export async function streamChat({ dramaId, episodeId, message, writeEvent }) {
  if (!ready) throw new Error('助手未就绪');
  const requestContext = new RequestContext();
  requestContext.set('dramaId', Number(dramaId));
  requestContext.set('episodeId', episodeId == null ? null : Number(episodeId));
  const output = await agent.stream(message, threadOptions(dramaId, requestContext));
  await emitStream(output, dramaId, writeEvent);
}

export async function resumeApproval({ dramaId, runId, toolCallId, approved, writeEvent }) {
  if (!ready) throw new Error('助手未就绪');
  const requestContext = new RequestContext();
  requestContext.set('dramaId', Number(dramaId));
  requestContext.set('episodeId', null);
  const options = { runId, toolCallId, ...threadOptions(dramaId, requestContext) };
  const output = approved
    ? await agent.approveToolCall(options)
    : await agent.declineToolCall({ ...options, reason: '用户拒绝了这次删除' });
  await emitStream(output, dramaId, writeEvent);
}

export async function getHistory(dramaId) {
  const thread = dramaThreadId(dramaId);
  const messages = [];
  const pendingApprovals = [];
  if (memory) {
    try {
      const recalled = await memory.recall({ threadId: thread, resourceId: thread });
      for (const message of recalled.messages || []) {
        messages.push({ role: message.role || '', text: messageText(message) });
      }
    } catch (_) {
      /* 新线程还没有记录 */
    }
  }
  if (agent) {
    try {
      const listed = await agent.listSuspendedRuns({ threadId: thread, resourceId: thread });
      for (const run of listed.runs || []) {
        for (const call of run.toolCalls || []) {
          if (!call.requiresApproval) continue;
          const args = call.args || {};
          const guard = guardDeleteApproval(appDb, dramaId, args);
          pendingApprovals.push({
            runId: run.runId,
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            type: args.type,
            id: args.id,
            label: guard.action === 'ask' ? guard.label : '',
          });
        }
      }
    } catch (_) {
      /* 还没有待确认的操作 */
    }
  }
  return { messages, pendingApprovals };
}
