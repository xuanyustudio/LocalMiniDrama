const promptOverridesService = require('../services/promptOverridesService');
const promptI18n = require('../services/promptI18n');
const response = require('../response');

// 可编辑的提示词定义
// 注意：default_body 和 locked_suffix 都只包含中文版本
function getPromptDefinitions() {
  return [
    {
      key: 'story_expansion_system',
      label: '故事生成提示词',
      description: '控制 AI 如何将故事梗概扩写成完整剧本',
      default_body: `你是一位专业的编剧。你的任务是根据用户提供的故事梗概（可能很短），扩展成一段完整可用的短片剧本/故事正文。

要求：
1. 用中文写作，保持叙事清晰、流畅，适合后续拆分为分镜。
2. 可以包含场景描述、角色动作与对话，但不要输出分镜格式、镜头编号或「内景/外景」等场次标记。
3. 长度适中：约 300～800 字（梗概极简时可 150～400 字），视梗概复杂度调整。
4. 只输出剧本正文，不要输出「剧本：」「故事：」等标题，也不要输出任何说明性文字。`,
      locked_suffix: null,
    },
    {
      key: 'storyboard_system',
      label: '分镜拆解提示词',
      description: '控制 AI 如何将剧本拆分成分镜头方案（输出格式要求已锁定）',
      default_body: `【角色】你是一位资深影视分镜师，精通罗伯特·麦基的镜头拆解理论，擅长构建情绪节奏。

【任务】将小说剧本按**独立动作单元**拆解为分镜头方案。

【分镜拆解原则】
1. **动作单元划分**：每个镜头必须对应一个完整且独立的动作
   - 一个动作 = 一个镜头（角色站起来、走过去、说一句话、做一个反应表情等）
   - 禁止合并多个动作（站起+走过去应拆分为2个镜头）

2. **景别标准**（根据叙事需要选择）：
   - 大远景：环境、氛围营造
   - 远景：全身动作、空间关系
   - 中景：交互对话、情感交流
   - 近景：细节展示、情绪表达
   - 特写：关键道具、强烈情绪

3. **运镜要求**：
   - 固定镜头：稳定聚焦于一个主体
   - 推镜：接近主体，增强紧张感
   - 拉镜：扩大视野，交代环境
   - 摇镜：水平移动摄像机，空间转换
   - 跟镜：跟随主体移动
   - 移镜：摄像机与主体同向移动

4. **情绪与强度标记**：
   - emotion：简短描述（兴奋、悲伤、紧张、愉快等）
   - emotion_intensity：用箭头表示情绪等级
     * 极强 ↑↑↑ (3)：情绪高峰、高度紧张
     * 强 ↑↑ (2)：情绪明显波动
     * 中 ↑ (1)：情绪有所变化
     * 平稳 → (0)：情绪不变
     * 弱 ↓ (-1)：情绪回落

【输出要求】
1. 生成一个数组，每个元素是一个镜头，包含：
   - shot_number：镜头号
   - scene_description：场景（地点+时间，如"卧室内，早晨"）
   - shot_type：景别（大远景/远景/中景/近景/特写）
   - camera_angle：机位角度（平视/仰视/俯视/侧面/背面）
   - camera_movement：运镜方式（固定/推镜/拉镜/摇镜/跟镜/移镜）
   - action：动作描述
   - result：动作完成后的画面结果
   - dialogue：角色对话或旁白（如有）
   - emotion：当前情绪
   - emotion_intensity：情绪强度等级（3/2/1/0/-1）`,
      locked_suffix: `\n\n**重要：必须只返回纯JSON数组，不要包含任何markdown代码块、说明文字或其他内容。直接以 [ 开头，以 ] 结尾。**\n\n【重要提示】\n- 镜头数量必须与剧本中的独立动作数量匹配（不允许合并或减少）\n- 每个镜头必须有明确的动作和结果\n- 景别选择必须符合叙事节奏（不要连续使用同一景别）\n- 情绪强度必须准确反映剧本氛围变化`,
    },
    {
      key: 'character_extraction',
      label: '角色提取提示词',
      description: '控制 AI 如何从剧本中提取角色信息（输出格式要求已锁定）',
      default_body: `你是一个专业的角色分析师，擅长从剧本中提取和分析角色信息。

你的任务是根据提供的剧本内容，提取并整理剧中出现的所有角色的详细设定。

要求：
1. 提取所有有名字的角色（忽略无名路人或背景角色）
2. 对每个角色，提取以下信息：
   - name: 角色名字
   - role: 角色类型（main/supporting/minor）
   - appearance: 外貌描述（150-300字）
   - personality: 性格特点（100-200字）
   - description: 背景故事和角色关系（100-200字）
3. 外貌描述要足够详细，适合AI生成图片，包括：性别、年龄、体型、面部特征、发型、服装风格等,但不要包含任何场景、背景、环境等信息
4. 主要角色需要更详细的描述，次要角色可以简化`,
      locked_suffix: `\n输出格式：\n**重要：必须只返回纯JSON数组，不要包含任何markdown代码块、说明文字或其他内容。直接以 [ 开头，以 ] 结尾。**\n每个元素是一个角色对象，包含上述字段。`,
    },
    {
      key: 'scene_extraction',
      label: '场景提取提示词',
      description: '控制 AI 如何从剧本中提取场景背景（风格/比例和输出格式已锁定）',
      default_body: `【任务】从剧本中提取所有唯一的场景背景

【要求】
1. 识别剧本中所有不同的场景（地点+时间组合）
2. 为每个场景生成详细的**中文**图片生成提示词（Prompt）
3. **重要**：场景描述必须是**纯背景**，不能包含人物、角色、动作等元素
4. **重要**：prompt 字段必须为中文，不得使用英文（风格词如 realistic 可保留）`,
      locked_suffix: `\n5. **风格要求**：[当前剧集风格]\n   - **图片比例**：[当前比例]\n\n【输出格式】\n**重要：必须只返回纯JSON数组，不要包含任何markdown代码块。直接以 [ 开头，以 ] 结尾。**\n每个元素包含：location（地点）, time（时间）, prompt（完整的中文图片生成提示词，纯背景，明确说明无人物）。`,
    },
    {
      key: 'prop_extraction',
      label: '道具提取提示词',
      description: '控制 AI 如何从剧本中提取关键道具（系统提示词，剧本内容由系统自动传入；风格/比例和输出格式已锁定）',
      default_body: `你是一位专业的剧本道具分析师，擅长从剧本中提取具有视觉特征的关键道具。

你的任务是根据提供的剧本内容，提取并整理所有对剧情有重要作用或有特殊视觉特征的关键道具。

要求：
1. 只提取对剧情发展有重要作用、或有特殊视觉特征的关键道具。
2. 普通的生活用品（如普通的杯子、笔）如果无特殊剧情意义不需要提取。
3. 如果道具有明确的归属者，请在描述中注明。
4. "image_prompt"字段是用于AI生成图片的英文提示词，必须详细描述道具的外观、材质、颜色、风格。`,
      locked_suffix: `\n- **风格要求**：[当前道具风格]\n- **图片比例**：[当前比例]\n\n【输出格式】\n**重要：必须只返回纯JSON数组，不要包含任何markdown代码块、说明文字或其他内容。直接以 [ 开头，以 ] 结尾。**\n每个对象包含：\n- name: 道具名称\n- type: 类型 (如：武器/关键证物/日常用品/特殊装置)\n- description: 在剧中的作用和中文外观描述\n- image_prompt: 英文图片生成提示词 (Focus on the object, isolated, detailed, cinematic lighting, high quality)`,
    },
    {
      key: 'storyboard_user_suffix',
      label: '分镜输出格式要求',
      description: '追加在分镜拆解用户提示词末尾的详细要素说明（JSON 输出格式已锁定）',
      default_body: `【分镜要素】每个镜头聚焦单一动作，描述要详尽具体：
1. **镜头标题(title)**：用3-5个字概括该镜头的核心内容或情绪
2. **时间**：[清晨/午后/深夜/具体时分+详细光线描述]
3. **地点**：[场景完整描述+空间布局+环境细节]
4. **镜头设计**：**景别(shot_type)**、**镜头角度(angle)**、**运镜方式(movement)**
5. **人物行为**：**详细动作描述**
6. **对话/独白**：提取该镜头中的完整对话或独白内容（如无对话则为空字符串）
7. **画面结果**：动作的即时后果+视觉细节+氛围变化
8. **环境氛围**：光线质感+色调+声音环境+整体氛围
9. **配乐提示(bgm_prompt)**、**音效描述(sound_effect)**
10. **观众情绪**：[情绪类型]（[强度：↑↑↑/↑↑/↑/→/↓]）

**dialogue字段说明**：角色名："台词内容"。无对话时填空字符串""。
**角色和背景要求**：characters字段为角色ID数字数组；scene_id从场景列表选或null。
**duration时长**：每镜头4-12秒，综合对话、动作、情绪估算。`,
      locked_suffix: `\n\n【输出格式】请以JSON格式输出，包含 "storyboards" 数组。每个镜头包含：shot_number, title, shot_type, angle, time, location, scene_id, movement, action, dialogue, result, atmosphere, emotion, duration, bgm_prompt, sound_effect, characters, is_primary。**必须只返回纯JSON，不要markdown。**`,
    },
    {
      key: 'first_frame_prompt',
      label: '首帧图像提示词',
      description: '控制 AI 如何生成分镜首帧（动作前静态画面）的图像提示词（风格/比例和 JSON 格式已锁定）',
      default_body: `你是一个专业的图像生成提示词专家。请根据提供的镜头信息，生成适合用于AI图像生成的提示词。

重要：这是镜头的首帧 - 一个完全静态的画面，展示动作发生之前的初始状态。

关键要点：
1. 聚焦初始静态状态 - 动作发生之前的那一瞬间
2. 必须不包含任何动作或运动
3. 描述角色的初始姿态、位置和表情
4. 可以包含场景氛围和环境细节
5. 景别决定构图和取景范围`,
      locked_suffix: `\n- **风格要求**：[当前剧集风格]\n- **图片比例**：[当前比例]\n输出格式：\n返回一个JSON对象，包含：\n- prompt：完整的中文图片生成提示词（详细描述，适合AI图像生成）\n- description：简化的中文描述（供参考）`,
    },
    {
      key: 'key_frame_prompt',
      label: '关键帧图像提示词',
      description: '控制 AI 如何生成分镜关键帧（动作高潮瞬间）的图像提示词（风格/比例和 JSON 格式已锁定）',
      default_body: `你是一个专业的图像生成提示词专家。请根据提供的镜头信息，生成适合用于AI图像生成的提示词。

重要：这是镜头的关键帧 - 捕捉动作最激烈、最精彩的瞬间。

关键要点：
1. 聚焦动作最精彩的时刻
2. 捕捉情绪表达的顶点
3. 强调动态张力
4. 展示角色动作和表情的高潮状态
5. 可以包含动作模糊或动态效果`,
      locked_suffix: `\n- **风格要求**：[当前剧集风格]\n- **图片比例**：[当前比例]\n输出格式：\n返回一个JSON对象，包含：\n- prompt：完整的中文图片生成提示词（详细描述，适合AI图像生成）\n- description：简化的中文描述（供参考）`,
    },
    {
      key: 'last_frame_prompt',
      label: '尾帧图像提示词',
      description: '控制 AI 如何生成分镜尾帧（动作后静态画面）的图像提示词（风格/比例和 JSON 格式已锁定）',
      default_body: `你是一个专业的图像生成提示词专家。请根据提供的镜头信息，生成适合用于AI图像生成的提示词。

重要：这是镜头的尾帧 - 一个静态画面，展示动作结束后的最终状态和结果。

关键要点：
1. 聚焦动作完成后的最终状态
2. 展示动作的结果
3. 描述角色在动作完成后的姿态和表情
4. 强调动作后的情绪状态
5. 捕捉动作结束后的平静瞬间`,
      locked_suffix: `\n- **风格要求**：[当前剧集风格]\n- **图片比例**：[当前比例]\n输出格式：\n返回一个JSON对象，包含：\n- prompt：完整的中文图片生成提示词（详细描述，适合AI图像生成）\n- description：简化的中文描述（供参考）`,
    },
  ];
}

function routes(db, log) {
  return {
    list: (req, res) => {
      try {
        const defs = getPromptDefinitions();
        const overrides = promptOverridesService.listOverrides(db);
        const overrideMap = {};
        for (const o of overrides) overrideMap[o.key] = o.content;
        const prompts = defs.map((d) => ({
          key: d.key,
          label: d.label,
          description: d.description,
          default_body: d.default_body,
          locked_suffix: d.locked_suffix,
          current_body: overrideMap[d.key] || null,
          is_customized: !!overrideMap[d.key],
        }));
        response.success(res, { prompts });
      } catch (err) {
        log.error('prompts list', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    update: (req, res) => {
      const { key } = req.params;
      const { content } = req.body || {};
      const defs = getPromptDefinitions();
      if (!defs.some((d) => d.key === key)) {
        return response.badRequest(res, `未知的提示词 key: ${key}`);
      }
      if (!content || !content.trim()) {
        return response.badRequest(res, 'content 不能为空');
      }
      try {
        promptOverridesService.setOverride(db, key, content.trim());
        promptI18n.setOverrideInMemory(key, content.trim());
        log.info('prompt override updated', { key });
        response.success(res, { ok: true, key });
      } catch (err) {
        log.error('prompts update', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    reset: (req, res) => {
      const { key } = req.params;
      const defs = getPromptDefinitions();
      if (!defs.some((d) => d.key === key)) {
        return response.badRequest(res, `未知的提示词 key: ${key}`);
      }
      try {
        promptOverridesService.deleteOverride(db, key);
        promptI18n.clearOverrideInMemory(key);
        log.info('prompt override reset', { key });
        response.success(res, { ok: true, key });
      } catch (err) {
        log.error('prompts reset', { error: err.message });
        response.internalError(res, err.message);
      }
    },
  };
}

module.exports = { routes, getPromptDefinitions };
