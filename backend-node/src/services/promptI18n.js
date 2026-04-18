// 内存覆盖缓存：key => body（仅存可编辑部分，不含锁定的 JSON 格式要求）
const _overrideCache = {};

function loadOverridesIntoCache(overrides) {
  for (const o of overrides) {
    _overrideCache[o.key] = o.content;
  }
}

function setOverrideInMemory(key, content) {
  _overrideCache[key] = content;
}

function clearOverrideInMemory(key) {
  delete _overrideCache[key];
}

// 与 Go application/services/prompt_i18n.go 对齐：提示词与语言
function getLanguage(cfg) {
  return (cfg?.app?.language || 'zh').toLowerCase();
}

function isEnglish(cfg) {
  return getLanguage(cfg) === 'en';
}

/** 画风由前端写入 dramas.metadata.style_prompt_zh / style_prompt_en，mergeCfgStyleWithDrama 注入 cfg.style */

function styleTextForCfgLang(cfg) {
  const z = (cfg?.style?.default_style_zh || '').trim();
  const e = (cfg?.style?.default_style_en || '').trim();
  const d = (cfg?.style?.default_style || '').trim();
  if (isEnglish(cfg)) return e || d;
  return z || d;
}

function styleTextZhForPolish(cfg) {
  return (cfg?.style?.default_style_zh || cfg?.style?.default_style || '').trim();
}

function styleTextEnForImage(cfg) {
  return (cfg?.style?.default_style_en || cfg?.style?.default_style || '').trim();
}

function getCharacterExtractionPrompt(cfg) {
  const style = styleTextForCfgLang(cfg);
  const imageRatio = cfg?.style?.default_image_ratio || '16:9';
  if (isEnglish(cfg)) {
    return `You are a professional character analyst, skilled at extracting and analyzing character information from scripts.

Your task is to extract and organize character settings for all named characters in the script.

Requirements:
1. Extract all characters with names (ignore unnamed passersby or background characters)
2. For each character, extract:
   - name: Character name
   - role: Character role (main/supporting/minor)
   - appearance: Detailed physical appearance for AI image generation (gender, age, body type, facial features, hairstyle, clothing style — NO scene or background info)
   - description: Brief background and relationships (50-100 words)
3. Main characters need detailed appearance; supporting characters can be simplified
- **Style Requirement**: ${style}
- **Image Ratio**: ${imageRatio}
Output Format:
**CRITICAL: Return ONLY a valid JSON array. Do NOT include any markdown code blocks, explanations, or other text. Start directly with [ and end with ].**
Each element is a character object containing the above fields.`;
  }
  const _charOverride = _overrideCache['character_extraction'];
  if (_charOverride) {
    return _charOverride + `\n- **风格要求**：${style}\n- **图片比例**：${imageRatio}\n输出格式：\n**重要：必须只返回纯JSON数组，不要包含任何markdown代码块、说明文字或其他内容。直接以 [ 开头，以 ] 结尾。**\n每个元素是一个角色对象，包含上述字段。`;
  }
  return `你是一个专业的角色分析师，擅长从剧本中提取和分析角色信息。

**【语言要求】所有字段的值必须使用中文，禁止出现英文内容（role字段的值除外，固定为 main/supporting/minor）。**

你的任务是根据提供的剧本内容，提取并整理剧中出现的所有有名字角色的设定。

要求：
1. 提取所有有名字的角色（忽略无名路人或背景角色）
2. 对每个角色，提取以下信息（全部用中文填写）：
   - name: 角色名字（中文）
   - role: 角色类型，固定值之一：main / supporting / minor
   - appearance: 外貌描述（中文，100-200字，包含性别、年龄、体型、面部特征、发型、服装风格等，不含任何场景或环境信息）
   - description: 背景故事和角色关系（中文，50-100字）
3. 主要角色外貌要详细，次要角色可简化
- **风格要求**：${style}
- **图片比例**：${imageRatio}
输出格式：
**重要：必须只返回纯JSON数组，不要包含任何markdown代码块、说明文字或其他内容。直接以 [ 开头，以 ] 结尾。**
每个元素是一个角色对象，包含上述字段。`;
}

function getStoryboardSystemPrompt(cfg) {
  if (isEnglish(cfg)) {
    return `[Role] You are a senior film storyboard artist, proficient in Robert McKee's shot breakdown theory, skilled at building emotional rhythm.

[Task] Break down the novel script into storyboard shots based on **independent action units**.

[Shot Breakdown Principles]
1. **Action Unit Division**: Each shot must correspond to a complete and independent action
   - One action = one shot (character stands up, walks over, speaks a line, reacts with an expression, etc.)
   - Do NOT merge multiple actions (standing up + walking over should be split into 2 shots)

2. **Shot Type Standards** (choose based on storytelling needs):
   - Extreme Long Shot (ELS): Environment, atmosphere building
   - Long Shot (LS): Full body action, spatial relationships
   - Medium Shot (MS): Interactive dialogue, emotional communication
   - Close-Up (CU): Detail display, emotional expression
   - Extreme Close-Up (ECU): Key props, intense emotions

3. **Camera Movement Requirements**:
   - Fixed Shot: Stable focus on one subject
   - Push In: Approaching subject, increasing tension
   - Pull Out: Expanding field of view, revealing context
   - Pan: Horizontal camera movement, spatial transitions
   - Follow: Following subject movement
   - Tracking: Linear movement with subject

4. **Emotion & Intensity Markers**:
   - Emotion: Brief description (excited, sad, nervous, happy, etc.)
   - Intensity: Emotion level using arrows
     * Extremely strong ↑↑↑ (3): Emotional peak, high tension
     * Strong ↑↑ (2): Significant emotional fluctuation
     * Moderate ↑ (1): Noticeable emotional change
     * Stable → (0): Emotion remains unchanged
     * Weak ↓ (-1): Emotion subsiding

5. **Narrative Segment Grouping**:
   - Group consecutive shots into named narrative segments (e.g., "Arrival", "Confrontation", "Resolution")
   - Each segment = a coherent dramatic beat or scene transition
   - Segment rules:
     * 1–3 segments for short scripts (≤10 shots)
     * 3–6 segments for medium scripts (10–30 shots)
     * Shot count per segment: suggest 3–8 shots (avoid 1-shot segments unless a major turning point)
     * Opening shots: wide/establishing, closing shots: close-up/reaction to cap the beat

[Output Requirements]
1. Return a JSON array. Each element is one shot object containing ALL of the following fields:
   - shot_number: Shot number (integer, starting from 1)
   - title: Shot title (3–8 words, concise summary of this shot's key action or visual, e.g., "Lin Wei Enters the Room", "Tense Eye Contact")
   - segment_index: Segment index (0-based integer, e.g., 0, 1, 2…)
   - segment_title: Segment name (short 2–6 words, e.g., "Chance Encounter", "Hidden Truth Revealed")
   - location: Location name (e.g., "bedroom interior", "rooftop", "hospital corridor")
   - time: Time of day (e.g., "morning", "dusk", "night", "afternoon")
   - shot_type: Shot type (extreme long shot/long shot/medium shot/close-up/extreme close-up)
   - camera_angle: Camera angle (eye-level/low-angle/high-angle/side/back)
   - camera_movement: Camera movement (fixed/push/pull/pan/follow/tracking)
   - lighting_style: Lighting style — choose ONE: natural/front/side/backlit/top/under/soft/dramatic/golden_hour/blue_hour/night/neon
   - depth_of_field: Depth of field — choose ONE: extreme_shallow/shallow/medium/deep (close-up → shallow/extreme_shallow; wide shot → deep)
   - action: Action description
   - result: Visual result of the action
   - dialogue: Character dialogue or narration (if any)
   - emotion: Current emotion
   - emotion_intensity: Emotion intensity level (3/2/1/0/-1)

**CRITICAL: Return ONLY a valid JSON array. Do NOT include any markdown code blocks, explanations, or other text. Start directly with [ and end with ].**

[Important Notes]
- Shot count must match number of independent actions in the script (not allowed to merge or reduce)
- Each shot must have clear action, result, AND title
- Shot types must match storytelling rhythm (don't use same shot type continuously)
- Emotion intensity must accurately reflect script atmosphere changes
- segment_index must be sequential integers starting from 0; all shots in the same segment share the same index and title`;
  }
  const _sbOverride = _overrideCache['storyboard_system'];
  if (_sbOverride) {
    return _sbOverride + '\n\n**重要：必须只返回纯JSON数组，不要包含任何markdown代码块、说明文字或其他内容。直接以 [ 开头，以 ] 结尾。**\n\n【重要提示】\n- 镜头数量必须与剧本中的独立动作数量匹配（不允许合并或减少）\n- 每个镜头必须有明确的动作和结果\n- 景别选择必须符合叙事节奏（不要连续使用同一景别）\n- 情绪强度必须准确反映剧本氛围变化';
  }
  return `【角色】你是一位资深影视分镜师，精通罗伯特·麦基的镜头拆解理论，擅长构建情绪节奏。

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

5. **叙事段落分组**：
   - 将连续镜头归组为命名段落（如"邂逅"、"矛盾激化"、"和解"）
   - 每个段落 = 一个连贯的戏剧节拍或场景切换
   - 分组规则：
     * 短剧本（≤10个镜头）：1–3个段落
     * 中等剧本（10–30个镜头）：3–6个段落
     * 每段建议3–8个镜头，避免1镜头单独成段（除非是重大转折点）
     * 段落开篇用大远景/远景建立环境，段落结尾用近景/特写收尾

【输出要求】
1. 返回一个JSON数组，每个元素是一个镜头对象，必须包含以下**全部**字段：
   - shot_number：镜头号（整数，从1开始）
   - title：镜头标题（3–8字，简洁概括本镜头的核心动作或视觉重点，如"林薇走进房间"、"紧张的对视"）
   - segment_index：段落索引（从0开始的整数，如 0、1、2……）
   - segment_title：段落名称（简短2–6字，如"意外相遇"、"真相大白"）
   - location：场景地点名称（如"卧室内"、"天台"、"医院走廊"）
   - time：拍摄时间（如"清晨"、"黄昏"、"夜晚"、"午后"）
   - shot_type：景别（大远景/远景/中景/近景/特写）
   - camera_angle：机位角度（平视/仰视/俯视/侧面/背面）
   - camera_movement：运镜方式（固定/推镜/拉镜/摇镜/跟镜/移镜）
   - lighting_style：灯光风格 — 从以下选一个填入：natural/front/side/backlit/top/under/soft/dramatic/golden_hour/blue_hour/night/neon（根据 time 和 atmosphere 判断；夜晚→night，黄昏→golden_hour，室内暖光→soft，强情绪→dramatic，逆光→backlit）
   - depth_of_field：景深 — 从以下选一个填入：extreme_shallow/shallow/medium/deep（特写/近景→shallow，中景→medium，远景/大远景→deep）
   - action：动作描述
   - result：动作完成后的画面结果
   - dialogue：角色对话或旁白（如有）
   - emotion：当前情绪
   - emotion_intensity：情绪强度等级（3/2/1/0/-1）

2. **构图与视觉设计参考**（生成分镜时运用）：
   - 景别变化规律：禁止连续3个及以上镜头使用相同景别，情绪递进时逐步推近（远→中→近→特写）
   - 构图建议：三分法（稳定叙事）/ 对角线（动态张力）/ 框架构图（增加纵深）/ 中心构图（庄重仪式感）
   - 光线方向：在 atmosphere 字段中注明光源方向和色温（如"左侧冷蓝光，逆光轮廓"）
   - 对话场景：使用正反打（过肩镜头交替），避免连续同向构图

**重要：必须只返回纯JSON数组，不要包含任何markdown代码块、说明文字或其他内容。直接以 [ 开头，以 ] 结尾。**

【重要提示】
- 镜头数量必须与剧本中的独立动作数量匹配（不允许合并或减少）
- 每个镜头必须有明确的 title（标题）、action（动作）和 result（结果）
- 景别选择必须符合叙事节奏（不要连续使用同一景别）
- 情绪强度必须准确反映剧本氛围变化
- segment_index 必须从0开始递增的整数，同一段落内所有镜头共享相同的 segment_index 和 segment_title`;
}

/**
 * 分镜生成「全能模式」：在系统提示末尾追加，使 JSON 每镜带 creation_mode + universal_segment_text（灵境 SoulLens SEEDANCE 单行规范）
 */
function getStoryboardUniversalOmniModeSuffix(cfg) {
  if (isEnglish(cfg)) {
    return `

[HIGHEST PRIORITY — UNIVERSAL / OMNI VIDEO PROMPT MODE]
This run is "AI universal storyboard" mode. EVERY shot object MUST include two extra fields in addition to all existing required fields:
1. "creation_mode": the exact string "universal".
2. "universal_segment_text": ONE single line only (NO line breaks). This is a **VIDEO clip prompt** for the whole shot duration (use JSON "duration" seconds — often 8–15s), NOT a still-frame / key-art description. Dense SoulLens-style SEEDANCE row. Each segment must be visually specific (forbid placeholder fluff). The line MUST contain these labeled segments in order, separated by spaces:
   主体: @人物1 (brief mood/posture)[facing hint] 正在 [motion with tempo across time] + micro-expression（与上镜衔接: shot 1 = 开篇情绪奠基; later = continuity or turn); add @人物2 … in characters[] order.
   叙事动态: In ONE breath, time-ordered mini beat for **this shot's duration**: where we are, who does what **first then next** (entry/exit/chase/kneel/pick up), how space reads; must read like storyboard for **motion picture**, not a frozen tableau.
   空间: 前景-[...] 中景-[...] 背景-[...]
   光影: [direction + color temp + contrast + material]
   镜头: MUST include a **camera motion chain** (at least TWO concrete moves, join with comma/顿号 or 起→承→合). Use SoulLens-like vocabulary where fit: 定镜, 缓推轨, 横移, 摇镜, 跟拍, 手持微晃, 从前景遮挡物后横移滑出, 拉焦, 缓升 — plus shot size, angle, composition（two-shot: 轴线：A在画左·B在画右）（结尾动势: toward next beat）. For duration ≥ 8s, **forbidden** to summarize the whole clip as only "特写+固定" or static single framing without staged camera change or reveal.
   台词: 第Xs @人物N:"dialogue"（omit if none）
   音效: 环境层-[...] 动作层-[...] 情绪层-[non-melodic] [style tag] [禁BGM][禁字幕]
Hard rules: (1) affirmative wording only. (2) [禁BGM][禁字幕] ONLY at the very end. (3) No --ar/--motion/--quality. (4) No @图片N; use @人物N from characters[] order.
If characters is empty, use @人物1 as generic label.`;
  }
  return `

【最高优先级——灵境式全能分镜 / SEEDANCE 视频提示词】
本任务为「AI生成全能分镜」模式：每个镜头对象在保留上述全部原有字段的同时，还必须额外包含：
1. "creation_mode"：固定字符串 "universal"（不可省略）。
2. "universal_segment_text"：严格单行字符串（禁止换行），供 **视频生成**（Seedance / 可灵 Omni 等）使用。必须按本镜 JSON 字段 **duration 的秒数** 写满「一段时间里发生的事」，是 **动态影像分镜** ，不是单帧插图说明；禁止只描写某一瞬间的构图而忽略时间流逝内的走位、阶段变化与镜头运动。
   按顺序包含下列字段段（段名后中文冒号，段间空格；禁止空壳短语）：
   主体：@人物1（神态四字内）[朝向：画左/画右/面向对手择一] 正在 [带速度节奏的肢体动作链] + 微表情（与上镜衔接：首镜「开篇情绪奠基」，其余接上一镜）；多角色按 characters[] 写 @人物2 …
   叙事动态：用逗号或小句串联 **本镜 duration 秒内** 的时间线——先交代空间一句，再写 @人物1 从哪到哪/先后动作阶段，若有 @人物2 写其入画或反应时机；必须出现「谁在动、如何动、与谁/何物发生关系」，读起来像迷你分场剧本，而非静物摄影说明。
   空间：前景-[…] 中景-[…] 背景-[…]（随人物走位可略有变化则点明）
   光影：[主光+色温+明暗比+质感]
   镜头：**运镜链** 必须至少两步，用顿号、逗号或「起→承→合」连接，优先使用灵境式组合词：**定镜**、**缓推轨**、**横移**、**摇镜**、**跟拍**、**手持微晃**、**从前景遮挡物或门柱后横移滑出**、**拉焦**、**缓升** 等；写明与人物位移的配合（例：人物冲出时侧后方跟拍→至门口横移滑出遮挡 reveal 街道与人群）。景别+机位+构图写在运镜链中或紧挨其后。（双人须含「轴线：A在画左·B在画右」）（结尾动势：指向下镜）。**若 duration≥8**：严禁用「仅特写+全程固定」一句话概括整段 clip。
   台词：第Xs @人物N："对白原文"（无则省略）
   音效：环境层-[…] 动作层-[…] 情绪层-[无旋律声层] + 视觉风格短句（八字以上） + 整行最末 [禁BGM][禁字幕]
铁律：①全部肯定句 ②[禁BGM][禁字幕] 仅在整行最后 ③禁止 --ar、--motion、--quality ④禁止 @图片N；人物用 @人物1… 与 characters[] 一致。
若 characters 为空，仍用 @人物1。`;
}

/** 分镜生成勾选「解说旁白」时追加到用户提示词末尾 */
function getStoryboardNarrationExtraInstructions(cfg) {
  if (isEnglish(cfg)) {
    return `

【VO / Narration mode — STRICT (user enabled full VO pipeline)】
- Add string field "narration" to **each** shot. **Every "narration" MUST be a non-empty string** (at least one full sentence), readable within this shot's "duration".
- **Shot with shot_number = 1 MUST** open with narrator lines: set time/place/mood or a hook — never leave empty because the shot is "establishing only".
- **Shot 2** should also carry narration if it is still wide/establishing; do not leave both 1 and 2 empty.
- Third-person / documentary narrator voice — **not** character dialogue (keep spoken lines in "dialogue" only). Do not copy dialogue text into "narration".
- 1–3 short sentences per shot; forbid consecutive shots with empty "narration".`;
  }
  return `

【解说旁白模式 — 硬性要求（用户已开启全片解说管线）】
- 在 "storyboards" 数组的**每一个**镜头对象中必须有字符串字段 "narration"，且 **narration 一律不得为空字符串**（每镜至少一句完整解说，约 10～50 字，须在本镜 duration 秒内能读完）。
- **shot_number 为 1 的第一个镜头**：必须有**开场解说**（交代时间、空间、氛围或悬念钩子），禁止以「纯建立镜头、无对白所以无旁白」为由留空；大远景/远景用旁白描述环境与基调，把观众带进故事。
- **第 2 个镜头**：若仍为远景/大远景/环境铺垫，同样必须写旁白；**禁止第 1、2 镜连续留空**。
- narration 为画外第三人称或纪录片式解说，与角色对白 dialogue 严格区分；对白只写在 dialogue，不要把对白原文复制进 narration。
- 每镜 1～3 句为宜；禁止连续多个镜头的 narration 为空。`;
}

function formatUserPrompt(cfg, key, ...args) {
  const style = styleTextForCfgLang(cfg);
  const imageRatio = cfg?.style?.default_image_ratio || '16:9';
  const templates = {
    en: {
      character_request: 'Script content:\n%s\n\nPlease extract and organize detailed character profiles for ALL named characters from the script.',
      drama_info_template: `Title: %s\nSummary: %s\nGenre: %s\nStyle: ${style}\nImage ratio: ${imageRatio}`,
      script_content_label: '【Script Content】',
      task_label: '【Task】',
      character_list_label: '【Available Character List】',
      scene_list_label: '【Extracted Scene Backgrounds】',
      task_instruction: 'Break down the novel script into storyboard shots based on **independent action units**.',
      character_constraint: '**Important** — characters field rules:\n1. Only use character IDs (numbers) from the above character list. Do not invent IDs.\n2. Only include characters who **physically appear and act** in this specific shot. Do NOT list characters who are merely mentioned, offscreen, or appear in the overall scene but not in this shot.\n3. The number of characters listed must match who is described in the action/dialogue fields. If the action only describes one person, list only that one character.',
      scene_constraint: '**Important**: In the scene_id field, select the most matching background ID (number) from the above background list. If no suitable background exists, use null.',
      prop_list_label: '【Available Prop List】',
      prop_constraint: '**Important** — props field rules:\n1. Only use prop IDs (numbers) from the above prop list. Do not invent IDs.\n2. Only include props that are **visually present and actively used or prominently featured** in this specific shot.\n3. If no props from the list appear in the shot, use an empty array [].',
      frame_info: 'Shot information:\n%s\n\nPlease directly generate the image prompt for the first frame without any explanation:',
      key_frame_info: 'Shot information:\n%s\n\nPlease directly generate the image prompt for the key frame without any explanation:',
      last_frame_info: 'Shot information:\n%s\n\nPlease directly generate the image prompt for the last frame without any explanation:',
      shot_description_label: 'Shot description: %s',
      scene_label: 'Scene: %s, %s',
      characters_label: 'Characters: %s',
      action_label: 'Action: %s',
      result_label: 'Result: %s',
      dialogue_label: 'Dialogue: %s',
      atmosphere_label: 'Atmosphere: %s',
      shot_type_label: 'Shot type: %s',
      angle_label: 'Angle: %s',
      movement_label: 'Movement: %s',
      storyboard_count_constraint: '**Constraint**: Total shot count must be around %s (allow ±20%). Please merge or split actions to meet this requirement.',
      video_duration_constraint: '**Constraint**: Total video duration must be around %s seconds (allow ±10%). Please adjust shot count and duration to meet this requirement.',
    },
    zh: {
      character_request: '剧本内容：\n%s\n\n请提取剧本中所有有名字角色的设定。',
      drama_info_template: `剧名：%s\n简介：%s\n类型：%s\n风格: ${style}\n图片比例: ${imageRatio}`,
      script_content_label: '【剧本内容】',
      task_label: '【任务】',
      character_list_label: '【本剧可用角色列表】',
      scene_list_label: '【本剧已提取的场景背景列表】',
      task_instruction: '将小说剧本按**独立动作单元**拆解为分镜头方案。',
      character_constraint: '**重要** — characters字段填写规则：\n1. 只能使用上述角色列表中的角色ID（数字），不得自创ID。\n2. 只填写在**本镜头中实际出现并有具体行为**的角色。不要把"提到的"、"画面外的"、或整个场景里有但本镜头动作中未描述的角色也列进去。\n3. characters数量必须与action/dialogue中实际描写的人物数量一致。如果action只描述了一个人的动作，characters里就只填那一个人的ID。',
      scene_constraint: '**重要**：在scene_id字段中，必须从上述背景列表中选择最匹配的背景ID（数字）。如果没有合适的背景，则填null。',
      prop_list_label: '【本集可用道具列表】',
      prop_constraint: '**重要** — props字段填写规则：\n1. 只能使用上述道具列表中的道具ID（数字），不得自创ID。\n2. 只填写在**本镜头中视觉上出现并被使用或显著展示**的道具。\n3. 如果本镜头中没有列表中的道具出现，则填空数组[]。',
      frame_info: '镜头信息：\n%s\n\n请直接生成首帧的图像提示词，不要任何解释：',
      key_frame_info: '镜头信息：\n%s\n\n请直接生成关键帧的图像提示词，不要任何解释：',
      last_frame_info: '镜头信息：\n%s\n\n请直接生成尾帧的图像提示词，不要任何解释：',
      shot_description_label: '镜头描述: %s',
      scene_label: '场景: %s, %s',
      characters_label: '角色: %s',
      action_label: '动作: %s',
      result_label: '结果: %s',
      dialogue_label: '对白: %s',
      atmosphere_label: '氛围: %s',
      shot_type_label: '景别: %s',
      angle_label: '角度: %s',
      movement_label: '运镜: %s',
      storyboard_count_constraint: '**重要约束**：总分镜数量必须控制在 %s 个左右（允许 ±20% 的偏差）。请务必合并或拆分动作以满足此数量要求。',
      video_duration_constraint: '**重要约束**：视频总时长必须控制在 %s 秒左右（允许 ±10% 的偏差）。请调整分镜数量和单镜时长以满足此要求。',
    },
  };
  const lang = isEnglish(cfg) ? 'en' : 'zh';
  const t = templates[lang][key] || templates.zh[key];
  if (!t) return args[0] != null ? String(args[0]) : '';
  let i = 0;
  return t.replace(/%[sd]/g, () => (args[i] != null ? String(args[i++]) : ''));
}

/** 分镜用户提示词后缀：详细输出格式与要求
 * @param {object} cfg - 配置对象
 * @param {number|null} shotDuration - 单镜建议时长（秒），由后端从项目配置或总时长/数量推算后注入
 */
function getStoryboardUserPromptSuffix(cfg, shotDuration) {
  const lang = isEnglish(cfg) ? 'en' : 'zh';
  const durationHint = shotDuration && Number.isFinite(Number(shotDuration)) && Number(shotDuration) > 0
    ? Number(shotDuration)
    : null;
  if (lang === 'en') {
    const durationInstruction = durationHint
      ? `approximately ${durationHint}s per shot (project setting), adjust ±1s based on dialogue length and action complexity`
      : 'estimate per shot from dialogue length, action complexity, and emotion';
    return `

**dialogue field**: "Character: \"line\"". Multiple: "A: \"...\" B: \"...\"". Monologue: "(Monologue) content". No dialogue: "".

**scene_id**: Select the most matching background ID from the scene list above, or null if none suitable.

**duration (seconds)**: ${durationInstruction}.

**Output**: JSON with "storyboards" array. Each item: shot_number, segment_index, segment_title, title, shot_type, angle, time, location, scene_id, movement, action, dialogue, result, atmosphere, emotion, duration, bgm_prompt, sound_effect, characters (array of IDs), props (array of prop IDs), is_primary. Return ONLY valid JSON, no markdown.`;
  }
  const _sbUserLocked = `\n\n【输出格式】请以JSON格式输出，包含 "storyboards" 数组。每个镜头包含：shot_number, segment_index, segment_title, title, shot_type, angle, time, location, scene_id, movement, action, dialogue, result, atmosphere, emotion, duration, bgm_prompt, sound_effect, characters（角色ID数组）, props（道具ID数组）, is_primary。**必须只返回纯JSON，不要markdown。**`;
  const _sbUserOverride = _overrideCache['storyboard_user_suffix'];
  if (_sbUserOverride) {
    return '\n\n' + _sbUserOverride + _sbUserLocked;
  }
  const durationInstruction = durationHint
    ? `每镜头约${durationHint}秒（项目配置），综合对话、动作、情绪可适当调整±1秒`
    : '综合对话、动作、情绪估算每镜时长（秒）';
  return `

【分镜要素】每个镜头聚焦单一动作，描述要详尽具体：
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
**scene_id**：从上方场景列表中选择最匹配的背景ID，如无合适背景则填null。
**duration时长**：${durationInstruction}。

【输出格式】请以JSON格式输出，包含 "storyboards" 数组。每个镜头包含：shot_number, segment_index, segment_title, title, shot_type, angle, time, location, scene_id, movement, action, dialogue, result, atmosphere, emotion, duration, bgm_prompt, sound_effect, characters（角色ID数组）, props（道具ID数组）, is_primary。**必须只返回纯JSON，不要markdown。**`;
}

function getFirstFramePrompt(cfg) {
  const style = styleTextEnForImage(cfg);
  const imageRatio = cfg?.style?.default_image_ratio || '16:9';
  if (isEnglish(cfg)) {
    return `You are a professional cinematic storyboard image prompt expert. Generate AI image generation prompts based on the shot information provided.

Important: This is the FIRST FRAME - a completely static image showing the initial state BEFORE the action begins.

Core Rules:
1. Static initial state only - the moment before any action
2. NO movement or action descriptions
3. Describe character's initial posture, screen position (left/center/right), and expression
4. Include character appearance details if provided

Cinematic Language (must apply):
- COMPOSITION: Choose based on shot type: Rule of Thirds (subject at grid intersections), Frame Composition (use doors/windows/branches as natural frame), Center Composition (symmetrical, ceremonial), Foreground Layering (blurred foreground for depth)
- LIGHTING: Specify light source direction (left/right/top/backlight/bottom), quality (hard light=dramatic shadows / soft light=natural warmth), color temperature (warm=golden/orange, cool=blue/cyan)
- DEPTH OF FIELD: Close-up/medium-close=shallow DOF, background blur; Medium shot=medium DOF; Long shot/wide=deep DOF, full scene clarity
- CHARACTER POSITION: Describe placement in frame, facing direction (toward/away from camera/profile), body language
- **Style Requirement**: ${style}
- **Image Ratio**: ${imageRatio}
Output Format:
Return a JSON object containing:
- prompt: Complete image generation prompt (detailed cinematic description)
- description: Simplified Chinese description (for reference)`;
  }
  const _ffLocked = `\n- **风格要求**：${style}\n- **图片比例**：${imageRatio}\n输出格式：\n返回一个JSON对象，包含：\n- prompt：完整的中文图片生成提示词（详细的电影语言描述）\n- description：简化的中文描述（供参考）`;
  const _ffOverride = _overrideCache['first_frame_prompt'];
  if (_ffOverride) {
    return _ffOverride + _ffLocked;
  }
  return `你是一个专业的电影分镜图像生成提示词专家。请根据提供的镜头信息，生成适合AI图像生成的提示词。

重要：这是镜头的首帧 - 一个完全静态的画面，展示动作发生之前的初始状态。

核心规则：
1. 聚焦初始静态状态 - 动作发生之前的那一瞬间，禁止包含任何动作或运动描述
2. 描述角色在画面中的位置（画面左/中/右）、朝向（面向/背对/侧面）、初始姿态和表情
3. 如提供了角色外貌信息，必须将其融入提示词（服装、发型、面部特征等）

【电影语言规范（必须应用）】

构图规则（根据景别选择）：
- 三分法：主体置于三分线交点，稳定平衡，适合大多数叙事镜头
- 框架构图：用门窗/树枝/栏杆形成自然画框，突出主体，增加纵深
- 中心构图：对称庄重，适合特写和仪式感场景
- 前景遮挡：前景虚化元素增加层次感

光线设计（必须描述）：
- 光源方向：左侧光/右侧光/顶光/逆光（轮廓光）/底光
- 光线质感：硬光（强烈阴影，戏剧张力）/ 柔光（柔和过渡，自然温馨）
- 色温：暖光（金黄/橙红，温暖怀旧）/ 冷光（蓝调/青白，冷漠疏离）

景深设置：
- 特写/近景：浅景深，背景虚化，突出人物情绪
- 中景：中等景深，人物与环境均清晰
- 远景/全景：深景深，前后均清晰，交代空间关系
- **风格要求**：${style}
- **图片比例**：${imageRatio}

【5层结构输出格式】
返回JSON对象，prompt 字段按以下5层顺序拼接成英文，各层间用逗号分隔（不加层标签文字）：
第1层-镜头设计：景别 + 机位角度 + 构图方式（如 "medium shot, eye-level angle, rule of thirds"）
第2层-光线：光源方向 + 光线质感 + 色温（如 "left-side soft warm light, golden hour glow"）
第3层-内容焦点：角色（外貌特征+初始姿态+表情）+ 场景环境关键细节
第4层-氛围：情绪基调 + 色彩倾向（如 "quiet tense atmosphere, desaturated cool palette"）
第5层-视觉风格：${style ? style + ', ' : ''}cinematic storyboard, ${imageRatio} aspect ratio, high detail

JSON字段：
- prompt：按上述5层组装的英文图片提示词（直接给图片AI使用）
- description：一句话中文描述（供人类参考）`;
}

function getKeyFramePrompt(cfg) {
  const style = styleTextEnForImage(cfg);
  const imageRatio = cfg?.style?.default_image_ratio || '16:9';
  if (isEnglish(cfg)) {
    return `You are a professional cinematic storyboard image prompt expert. Generate AI image generation prompts based on the shot information provided.

Important: This is the KEY FRAME - capturing the most intense and climactic moment of the action.

Core Rules:
1. Focus on the peak moment of the action - maximum dramatic tension
2. Capture the emotional climax - character's most expressive state
3. Can include dynamic effects (motion blur, impact lines, visual tension)
4. Include character appearance details if provided
5. Show character's body language and expression at climax

Cinematic Language (must apply):
- COMPOSITION: For action/climax - diagonal composition (dynamic tension, leads viewer's eye), Dutch angle (unease/intensity for conflict scenes), over-shoulder (confrontation/dialogue tension)
- LIGHTING: Dramatic lighting for peak moments - rim light separating subject from background, strong chiaroscuro (light/shadow contrast), or explosive bright key light for revelations
- DEPTH OF FIELD: Usually shallow to isolate the critical action; deep for wide action involving environment
- EMOTIONAL COLOR: Warm saturated (passion/anger), cool desaturated (shock/loss), high contrast (climax/confrontation)
- **Style Requirement**: ${style}
- **Image Ratio**: ${imageRatio}
Output Format:
Return a JSON object containing:
- prompt: Complete image generation prompt (detailed cinematic description)
- description: Simplified Chinese description (for reference)`;
  }
  const _kfLocked = `\n- **风格要求**：${style}\n- **图片比例**：${imageRatio}\n输出格式：\n返回一个JSON对象，包含：\n- prompt：完整的中文图片生成提示词（详细的电影语言描述）\n- description：简化的中文描述（供参考）`;
  const _kfOverride = _overrideCache['key_frame_prompt'];
  if (_kfOverride) {
    return _kfOverride + _kfLocked;
  }
  return `你是一个专业的电影分镜图像生成提示词专家。请根据提供的镜头信息，生成适合AI图像生成的提示词。

重要：这是镜头的关键帧 - 捕捉动作最激烈、情绪最饱满的高潮瞬间。

核心规则：
1. 聚焦动作高潮时刻，最大化戏剧张力
2. 捕捉情绪顶点，角色表情和肢体语言处于最强烈状态
3. 可包含动态效果（动作模糊、视觉冲击感）
4. 如提供了角色外貌信息，必须将其融入提示词
5. 展示角色高潮状态下的肢体姿态和神情

【电影语言规范（必须应用）】

构图规则（高潮/动作场景）：
- 对角线构图：强烈动态感，视觉引导，适合冲突/行动镜头
- 荷兰角/斜角：不安感和紧张感，适合对峙/心理冲击场景
- 过肩镜头：适合对话高潮、面对面对峙

光线设计（高潮时刻）：
- 轮廓光：将主体从背景中分离，突出人物
- 强烈明暗对比（硬光）：戏剧张力，冲突感
- 爆发性亮光：适合揭示真相、情绪爆发时刻
- 色温情绪化：暖色饱和（激情/愤怒）/ 冷色低饱和（震惊/失落）

景深与色调：
- 通常使用浅景深聚焦关键动作，隔离背景
- 高对比度色调强化高潮感
- **风格要求**：${style}
- **图片比例**：${imageRatio}

【5层结构输出格式】
返回JSON对象，prompt 字段按以下5层顺序拼接成英文，各层间用逗号分隔（不加层标签文字）：
第1层-镜头设计：景别 + 机位角度 + 构图方式（如 "close-up, low angle, diagonal composition"）
第2层-光线：光源方向 + 光线质感 + 色温（如 "dramatic rim light, strong chiaroscuro, warm saturated"）
第3层-内容焦点：角色（外貌特征+高潮姿态+情绪表情）+ 场景关键细节
第4层-氛围：情绪基调 + 色彩倾向（如 "intense confrontation, high contrast, vivid saturated palette"）
第5层-视觉风格：${style ? style + ', ' : ''}cinematic storyboard, ${imageRatio} aspect ratio, dynamic tension

JSON字段：
- prompt：按上述5层组装的英文图片提示词（直接给图片AI使用）
- description：一句话中文描述（供人类参考）`;
}

function getLastFramePrompt(cfg) {
  const style = styleTextEnForImage(cfg);
  const imageRatio = cfg?.style?.default_image_ratio || '16:9';
  if (isEnglish(cfg)) {
    return `You are a professional cinematic storyboard image prompt expert. Generate AI image generation prompts based on the shot information provided.

Important: This is the LAST FRAME - a static image showing the final state AFTER the action ends.

Core Rules:
1. Focus on the final resting state after action completion
2. Show the visible result/consequence of the action
3. Describe character's final posture, position, and emotional expression
4. Emphasize the emotional aftermath - relief, tension, sadness, triumph
5. Include character appearance details if provided

Cinematic Language (must apply):
- COMPOSITION: Closing shots often use wider frames to re-establish context; or tight on face for emotional resolution
- LIGHTING: Reflect emotional aftermath - soft warm light (resolution/comfort), lingering dramatic shadows (unresolved tension), fading light (loss/ending)
- DEPTH OF FIELD: Match the emotional tone - shallow for intimate emotional close, deep for consequential wide shots showing impact on environment
- CHARACTER POSITION: Show the result - where the character ended up, their final stance, any physical consequences
- ATMOSPHERE: Describe color tone and mood that carries the emotional weight of the scene's conclusion
- **Style Requirement**: ${style}
- **Image Ratio**: ${imageRatio}
Output Format:
Return a JSON object containing:
- prompt: Complete image generation prompt (detailed cinematic description)
- description: Simplified Chinese description (for reference)`;
  }
  const _lfLocked = `\n- **风格要求**：${style}\n- **图片比例**：${imageRatio}\n输出格式：\n返回一个JSON对象，包含：\n- prompt：完整的中文图片生成提示词（详细的电影语言描述）\n- description：简化的中文描述（供参考）`;
  const _lfOverride = _overrideCache['last_frame_prompt'];
  if (_lfOverride) {
    return _lfOverride + _lfLocked;
  }
  return `你是一个专业的电影分镜图像生成提示词专家。请根据提供的镜头信息，生成适合AI图像生成的提示词。

重要：这是镜头的尾帧 - 一个静态画面，展示动作结束后的最终状态和结果。

核心规则：
1. 聚焦动作完成后的最终静态状态
2. 展示动作的可见结果和后果
3. 描述角色在动作完成后的最终姿态、位置和情绪表情
4. 强调情绪余韵：释然/平静/悲伤/胜利/遗憾
5. 如提供了角色外貌信息，必须将其融入提示词

【电影语言规范（必须应用）】

构图规则（收尾镜头）：
- 通常用较宽的景别重建空间背景，或用紧镜头聚焦情绪收场
- 留白构图：大面积空旷空间传递孤独/结束感
- 呼应开场构图：收尾镜头可与首帧构图呼应，形成闭环

光线设计（情绪余韵）：
- 柔和暖光：事件解决后的温情/宽慰
- 残留戏剧阴影：未解决的张力，悬念延续
- 渐弱光线/冷调：失去/结束/遗憾的情绪
- 色调整体偏暗或偏亮反映情绪归宿

景深与氛围：
- 情绪收场：浅景深，聚焦面部情绪细节
- 结果展示：深景深，展示行动对环境/他人的影响
- 整体色调和氛围承载本镜头情绪的收尾重量
- **风格要求**：${style}
- **图片比例**：${imageRatio}

【5层结构输出格式】
返回JSON对象，prompt 字段按以下5层顺序拼接成英文，各层间用逗号分隔（不加层标签文字）：
第1层-镜头设计：景别 + 机位角度 + 构图方式（如 "wide shot, high angle, centered composition"）
第2层-光线：光源方向 + 光线质感 + 色温（如 "fading side light, soft diffused, cool blue tone"）
第3层-内容焦点：角色（外貌特征+结果姿态+情绪余韵）+ 场景最终状态
第4层-氛围：情绪基调 + 色彩倾向（如 "quiet melancholy, muted desaturated palette, stillness"）
第5层-视觉风格：${style ? style + ', ' : ''}cinematic storyboard, ${imageRatio} aspect ratio, emotional resolution

JSON字段：
- prompt：按上述5层组装的英文图片提示词（直接给图片AI使用）
- description：一句话中文描述（供人类参考）`;
}

/** 道具提取系统提示词（system prompt，剧本内容由 user prompt 单独传入） */
function getPropExtractionPrompt(cfg) {
  const base = styleTextForCfgLang(cfg);
  const propExtra = (cfg?.style?.default_prop_style || '').toString().trim();
  const style = [base, propExtra].filter(Boolean).join(', ');
  const imageRatio = cfg?.style?.default_prop_ratio || cfg?.style?.default_image_ratio || '16:9';
  if (isEnglish(cfg)) {
    return `You are a professional script prop analyst, skilled at extracting key props with visual characteristics from scripts.

Your task is to extract and organize all key props that are important to the plot or have special visual characteristics from the provided script content.

[Requirements]
1. Extract ONLY key props that are important to the plot or have special visual characteristics.
2. Do NOT extract common daily items (e.g., normal cups, pens) unless they have special plot significance.
3. If a prop has a clear owner, note it **only** in "description" (Chinese OK). **Never** put character names, nicknames, or relationship words in "image_prompt".
4. "image_prompt" must be **English**, written as a **professional catalog / product-hero** shot for a single prop: describe shape, material, color, wear, scale cues, and finish in detail.
5. In "image_prompt" you **must** specify: **one seamless solid-color studio backdrop** (matte, no gradient), **only the prop as the sole subject**, **soft even studio lighting** (readable micro-detail, no dramatic movie lighting), and explicitly forbid people, hands, furniture, floors, tables, scenery, packaging (unless the prop *is* the package), text, logos, dust/debris, or any secondary objects.
6. **No script leakage in "image_prompt"**: forbid character names, place names, organization names, dialogue, plot beats, and other **original-script identifiers**. Replace with generic visual terms (e.g. "engraved serif lettering" instead of a name). The **only** exception is text that is **visibly printed or engraved on the prop itself** as part of its graphic design—describe that text generically if possible ("small engraved inscription") unless the script explicitly requires exact wording on the object.
7. **Strict, non-expanding "image_prompt"**: include **only** attributes grounded in the script or the "description" you output—**no** invented accessories, era/brand backstory, mood adjectives unrelated to materials, or "hero story" filler. Prefer a **tight** prompt over a long one.
- **Style Requirement**: ${style}
- **Image Ratio**: ${imageRatio}

[Output Format]
**CRITICAL: Return ONLY a valid JSON array. Do NOT include any markdown code blocks, explanations, or other text. Start directly with [ and end with ].**
Each object containing:
- name: Prop Name
- type: Type (e.g., Weapon/Key Item/Daily Item/Special Device)
- description: Role in the drama and visual description
- image_prompt: English hero product shot prompt (single prop, solid seamless backdrop, no clutter, no environment, soft studio light, tight wording, no names/places from script, ultra-detailed only where visually grounded)`;
  }
  const _propLocked = `\n- **风格要求**：${style}\n- **图片比例**：${imageRatio}\n\n【输出格式】\n**重要：必须只返回纯JSON数组，不要包含任何markdown代码块、说明文字或其他内容。直接以 [ 开头，以 ] 结尾。**\n每个对象包含：\n- name: 道具名称\n- type: 类型 (如：武器/关键证物/日常用品/特殊装置)\n- description: 在剧中的作用和中文外观描述（人名、归属可写在此字段，勿写入 image_prompt）\n- image_prompt: 英文单道具主图提示词（纯色无缝背景、仅主体、无杂物无场景、柔和棚拍光；**禁止**剧本人名/地名/组织名/台词/剧情标签；只写有依据的外观词，**不脑补、不扩写**）`;
  const _propOverride = _overrideCache['prop_extraction'];
  if (_propOverride) {
    return _propOverride + _propLocked;
  }
  return `你是一位专业的剧本道具分析师，擅长从剧本中提取具有视觉特征的关键道具。

你的任务是根据提供的剧本内容，提取并整理所有对剧情有重要作用或有特殊视觉特征的关键道具。

要求：
1. 只提取对剧情发展有重要作用、或有特殊视觉特征的关键道具。
2. 普通的生活用品（如普通的杯子、笔）如果无特殊剧情意义不需要提取。
3. 若道具有明确归属者，**仅**写在 "description" 中（可用中文人名）；**禁止**在 "image_prompt" 中出现任何角色名、昵称、称谓或人际关系用语。
4. "image_prompt" 必须为**英文**，按**影视资产库 / 电商主图级**单道具产品照来写：写清轮廓、材质、颜色、磨损与工艺细节、体量感。
5. "image_prompt" 中**必须**写明：**单一无缝纯色棚拍背景**（哑光、无渐变）、**画面中仅有该道具一个主体**、**柔和均匀的棚拍光**（便于看清细节，避免电影化强反差光），并**明确禁止**：人物、手、家具、地面/台面、室内外环境、散落杂物、其他道具、文字商标、包装（除非该道具本身就是包装）、烟尘粒子等任何多余元素。
6. **image_prompt 禁止泄漏剧本特征**：不得出现剧本人名、地名、组织名、台词、情节梗专有称呼等；一律改写为**泛化视觉描述**（如用 "small engraved inscription" 而非具体人名）。**唯一例外**：文字**实体印/刻在道具表面**且剧本明确要求还原该字样时，可保留该可见字样；否则用泛化描述。
7. **image_prompt 严格不扩展**：只写剧本与你在本对象 "description" 中已交代、且**肉眼可见**的外观信息；禁止凭空增加配饰、品牌故事、时代煽情形容词、叙事性铺垫；宁可**短而准**，不要为凑字数扩写。
- **风格要求**：${style}
- **图片比例**：${imageRatio}

【输出格式】
**重要：必须只返回纯JSON数组，不要包含任何markdown代码块、说明文字或其他内容。直接以 [ 开头，以 ] 结尾。**
每个对象包含：
- name: 道具名称
- type: 类型 (如：武器/关键证物/日常用品/特殊装置)
- description: 在剧中的作用和中文外观描述
- image_prompt: 英文单道具主图提示词（纯色无缝背景、仅主体、无杂物无场景、柔和棚拍光；无剧本人名地名等；只写有依据的外观词，简练不扩写）`;
}

function getSceneExtractionPrompt(cfg, style) {
  const styleText = (style || '').toString().trim();
  const s = styleText || styleTextForCfgLang(cfg);
  const imageRatio = cfg?.style?.default_image_ratio || '16:9';
  if (isEnglish(cfg)) {
    return `[Task] Extract all unique scene backgrounds from the script

[Requirements]
1. Identify all different scenes (location + time combinations) in the script
2. Generate detailed **English** image generation prompts for each scene
3. **Important**: Scene descriptions must be **pure backgrounds** without any characters, people, or actions
4. Prompt requirements:
   - Must use **English**, no Chinese characters
   - Detailed description of scene, time, atmosphere, style
   - Must explicitly specify "no people, no characters, empty scene"
   - **Style Requirement**: ${s}
   - **Image Ratio**: ${imageRatio}

[Output Format]
**CRITICAL: Return ONLY a valid JSON array. Do NOT include any markdown code blocks. Start directly with [ and end with ].**
Each element: location, time, prompt (English image generation prompt for pure background).`;
  }
  const _sceneLocked = `\n5. **风格要求**：${s}\n   - **图片比例**：${imageRatio}\n\n【输出格式】\n**重要：必须只返回纯JSON数组，不要包含任何markdown代码块。直接以 [ 开头，以 ] 结尾。**\n每个元素包含：location（地点）, time（时间）, prompt（完整的中文图片生成提示词，纯背景，明确说明无人物）。`;
  const _sceneOverride = _overrideCache['scene_extraction'];
  if (_sceneOverride) {
    return _sceneOverride + _sceneLocked;
  }
  return `【任务】从剧本中提取所有唯一的场景背景

【要求】
1. 识别剧本中所有不同的场景（地点+时间组合）
2. 为每个场景生成详细的**中文**图片生成提示词（Prompt）
3. **重要**：场景描述必须是**纯背景**，不能包含人物、角色、动作等元素
4. **重要**：prompt 字段必须为中文，不得使用英文（风格词如 realistic 可保留）
5. **风格要求**：${s}
   - **图片比例**：${imageRatio}

【输出格式】
**重要：必须只返回纯JSON数组，不要包含任何markdown代码块。直接以 [ 开头，以 ] 结尾。**
每个元素包含：location（地点）, time（时间）, prompt（完整的中文图片生成提示词，纯背景，明确说明无人物）。`;
}

/**
 * 故事扩展：根据梗概生成短片剧本正文（中英文系统提示词）
 */
function getStoryExpansionSystemPrompt(cfg, episodeCount) {
  const n = Number(episodeCount) > 1 ? Number(episodeCount) : 1;
  const jsonNote = `\n\n**输出格式（必须严格遵守）**：\n返回一个 JSON 数组，包含 ${n} 个对象，每个对象格式如下：\n[\n  {\n    "episode": 1,\n    "title": "第一集标题（5-10字，概括本集核心内容）",\n    "content": "本集剧本正文（约800字）"\n  }\n]\n**必须只返回纯 JSON 数组，不要任何 markdown 代码块、说明文字。直接以 [ 开头，以 ] 结尾。**`;
  if (isEnglish(cfg)) {
    const enNote = `\n\n**Output format (STRICTLY required)**:\nReturn a JSON array with ${n} object(s), each in this format:\n[\n  {\n    "episode": 1,\n    "title": "Episode title (5-15 words)",\n    "content": "Episode script body (~800 words)"\n  }\n]\n**Return ONLY the JSON array. No markdown, no explanation. Start directly with [ and end with ].**`;
    return `You are a professional screenwriter. Your task is to expand the user's story premise into ${n} episode(s) of a short-film script.

Requirements:
1. Write in clear, fluent English suitable for later storyboard breakdown.
2. Include scene descriptions, character actions and dialogue. Do NOT use shot numbers, "INT./EXT." headings, or screenplay formatting marks.
3. Each episode: approximately 800 words. Episodes must be connected in story continuity — each episode picks up from where the previous one ended.
4. Each episode should have a clear beginning, development, and a hook or turning point at the end.${enNote}`;
  }
  const _storyOverride = _overrideCache['story_expansion_system'];
  const base = _storyOverride || `你是一位专业的编剧。你的任务是根据用户提供的故事梗概，创作 ${n} 集完整的短片剧本。

要求：
1. 用中文写作，叙事清晰流畅，适合后续拆分为分镜。
2. 可以包含场景描述、角色动作与对话，但不要输出分镜格式、镜头编号或「内景/外景」等场次标记。
3. 每集约 800 字。如有多集，剧情必须前后衔接——每集从上一集结尾处推进，确保整体故事连贯。
4. 每集有清晰的起承转合，结尾留有悬念或转折，吸引观众看下一集。`;
  return base + jsonNote;
}

const STORY_STYLE_LABELS = {
  en: { modern: 'Modern', ancient: 'Period/Ancient', fantasy: 'Fantasy', daily: 'Slice of life' },
  zh: { modern: '现代', ancient: '古风', fantasy: '奇幻', daily: '日常' },
};
const STORY_TYPE_LABELS = {
  en: { drama: 'Drama', comedy: 'Comedy', adventure: 'Adventure' },
  zh: { drama: '剧情', comedy: '喜剧', adventure: '冒险' },
};

/**
 * 故事扩展：构建用户侧提示（梗概 + 可选风格/类型/集数），中英文
 */
function buildStoryExpansionUserPrompt(cfg, premise, style, type, episodeCount) {
  const lang = isEnglish(cfg) ? 'en' : 'zh';
  const n = Number(episodeCount) > 1 ? Number(episodeCount) : 1;
  const styleLabels = STORY_STYLE_LABELS[lang];
  const typeLabels = STORY_TYPE_LABELS[lang];
  if (lang === 'en') {
    let prompt = `Please create ${n} episode(s) of a short-film script based on the following story premise:\n\n${premise}`;
    if (style && styleLabels[style]) {
      prompt += `\n\nStyle: ${styleLabels[style]}`;
    }
    if (type && typeLabels[type]) {
      prompt += `\nGenre: ${typeLabels[type]}`;
    }
    if (n > 1) {
      prompt += `\nEpisodes: ${n}`;
    }
    return prompt;
  }
  let prompt = `请根据以下故事梗概，创作 ${n} 集短片剧本：\n\n${premise}`;
  if (style && styleLabels[style]) {
    prompt += `\n\n故事风格：${styleLabels[style]}`;
  }
  if (type && typeLabels[type]) {
    prompt += `\n剧本类型：${typeLabels[type]}`;
  }
  if (n > 1) {
    prompt += `\n生成集数：${n} 集`;
  }
  return prompt;
}

/**
 * 返回指定提示词 key 的可编辑默认正文（中文，不含动态锁定部分）。
 * promptOverrides.js 调用此函数，确保 UI 展示的内容与 promptI18n.js 始终一致。
 */
function getDefaultPromptBody(key) {
  switch (key) {
    case 'story_expansion_system':
      return '你是一位专业的编剧。你的任务是根据用户提供的故事梗概，创作 ${n} 集完整的短片剧本。\n\n要求：\n1. 用中文写作，叙事清晰流畅，适合后续拆分为分镜。\n2. 可以包含场景描述、角色动作与对话，但不要输出分镜格式、镜头编号或「内景/外景」等场次标记。\n3. 每集约 800 字。如有多集，剧情必须前后衔接——每集从上一集结尾处推进，确保整体故事连贯。\n4. 每集有清晰的起承转合，结尾留有悬念或转折，吸引观众看下一集。';

    case 'storyboard_system':
      return '【角色】你是一位资深影视分镜师，精通罗伯特·麦基的镜头拆解理论，擅长构建情绪节奏。\n\n【任务】将小说剧本按**独立动作单元**拆解为分镜头方案。\n\n【分镜拆解原则】\n1. **动作单元划分**：每个镜头必须对应一个完整且独立的动作\n   - 一个动作 = 一个镜头（角色站起来、走过去、说一句话、做一个反应表情等）\n   - 禁止合并多个动作（站起+走过去应拆分为2个镜头）\n\n2. **景别标准**（根据叙事需要选择）：\n   - 大远景：环境、氛围营造\n   - 远景：全身动作、空间关系\n   - 中景：交互对话、情感交流\n   - 近景：细节展示、情绪表达\n   - 特写：关键道具、强烈情绪\n\n3. **运镜要求**：\n   - 固定镜头：稳定聚焦于一个主体\n   - 推镜：接近主体，增强紧张感\n   - 拉镜：扩大视野，交代环境\n   - 摇镜：水平移动摄像机，空间转换\n   - 跟镜：跟随主体移动\n   - 移镜：摄像机与主体同向移动\n\n4. **情绪与强度标记**：\n   - emotion：简短描述（兴奋、悲伤、紧张、愉快等）\n   - emotion_intensity：用箭头表示情绪等级\n     * 极强 ↑↑↑ (3)：情绪高峰、高度紧张\n     * 强 ↑↑ (2)：情绪明显波动\n     * 中 ↑ (1)：情绪有所变化\n     * 平稳 → (0)：情绪不变\n     * 弱 ↓ (-1)：情绪回落\n\n【输出要求】\n1. 生成一个数组，每个元素是一个镜头，包含：\n   - shot_number：镜头号\n   - scene_description：场景（地点+时间，如"卧室内，早晨"）\n   - shot_type：景别（大远景/远景/中景/近景/特写）\n   - camera_angle：机位角度（平视/仰视/俯视/侧面/背面）\n   - camera_movement：运镜方式（固定/推镜/拉镜/摇镜/跟镜/移镜）\n   - action：动作描述\n   - result：动作完成后的画面结果\n   - dialogue：角色对话或旁白（如有）\n   - emotion：当前情绪\n   - emotion_intensity：情绪强度等级（3/2/1/0/-1）';

    case 'character_extraction':
      return '你是一个专业的角色分析师，擅长从剧本中提取和分析角色信息。\n\n**【语言要求】所有字段的值必须使用中文，禁止出现英文内容（role字段的值除外，固定为 main/supporting/minor）。**\n\n你的任务是根据提供的剧本内容，提取并整理剧中出现的所有有名字角色的设定。\n\n要求：\n1. 提取所有有名字的角色（忽略无名路人或背景角色）\n2. 对每个角色，提取以下信息（全部用中文填写）：\n   - name: 角色名字（中文）\n   - role: 角色类型，固定值之一：main / supporting / minor\n   - appearance: 外貌描述（中文，100-200字，包含性别、年龄、体型、面部特征、发型、服装风格等，不含任何场景或环境信息）\n   - description: 背景故事和角色关系（中文，50-100字）\n3. 主要角色外貌要详细，次要角色可以简化';

    case 'scene_extraction':
      return '【任务】从剧本中提取所有唯一的场景背景\n\n【要求】\n1. 识别剧本中所有不同的场景（地点+时间组合）\n2. 为每个场景生成详细的**中文**图片生成提示词（Prompt）\n3. **重要**：场景描述必须是**纯背景**，不能包含人物、角色、动作等元素\n4. **重要**：prompt 字段必须为中文，不得使用英文（风格词如 realistic 可保留）';

    case 'prop_extraction':
      return '你是一位专业的剧本道具分析师，擅长从剧本中提取具有视觉特征的关键道具。\n\n你的任务是根据提供的剧本内容，提取并整理所有对剧情有重要作用或有特殊视觉特征的关键道具。\n\n要求：\n1. 只提取对剧情发展有重要作用、或有特殊视觉特征的关键道具。\n2. 普通的生活用品（如普通的杯子、笔）如果无特殊剧情意义不需要提取。\n3. 归属者、剧中人名等**只**写在 "description"，**不要**写进 "image_prompt"。\n4. "image_prompt" 必须为英文，按「产品主图 / 资产白模照」标准撰写：只描述该道具本体（造型、材质、颜色、工艺与磨损），并强制纯色无缝棚拍背景、无场景无杂物。\n5. "image_prompt" 须明确排除人物、手、家具、台面、其他物体与环境叙事元素。\n6. "image_prompt" **禁止**出现剧本人名、地名、组织名、台词、剧情专有词；用泛化视觉词替代，且**禁止无依据扩写**（不凭空加配饰、品牌叙事、煽情形容词）。';

    case 'storyboard_user_suffix':
      return '【分镜要素】每个镜头聚焦单一动作，描述要详尽具体：\n1. **镜头标题(title)**：用3-5个字概括该镜头的核心内容或情绪\n2. **时间**：[清晨/午后/深夜/具体时分+详细光线描述]\n3. **地点**：[场景完整描述+空间布局+环境细节]\n4. **镜头设计**：**景别(shot_type)**、**镜头角度(angle)**、**运镜方式(movement)**\n5. **人物行为**：**详细动作描述**\n6. **对话/独白**：提取该镜头中的完整对话或独白内容（如无对话则为空字符串）\n7. **画面结果**：动作的即时后果+视觉细节+氛围变化\n8. **环境氛围**：光线质感+色调+声音环境+整体氛围\n9. **配乐提示(bgm_prompt)**、**音效描述(sound_effect)**\n10. **观众情绪**：[情绪类型]（[强度：↑↑↑/↑↑/↑/→/↓]）\n\n**dialogue字段说明**：角色名："台词内容"。无对话时填空字符串""。\n**scene_id**：从上方场景列表中选择最匹配的背景ID，如无合适背景则填null。\n**duration时长**：综合对话、动作、情绪估算每镜时长（具体目标秒数由系统自动注入）。';

    case 'first_frame_prompt':
      return '你是一个专业的电影分镜图像生成提示词专家。请根据提供的镜头信息，生成适合AI图像生成的提示词。\n\n重要：这是镜头的首帧 - 一个完全静态的画面，展示动作发生之前的初始状态。\n\n核心规则：\n1. 聚焦初始静态状态 - 动作发生之前的那一瞬间，禁止包含任何动作或运动描述\n2. 描述角色在画面中的位置（画面左/中/右）、朝向（面向/背对/侧面）、初始姿态和表情\n3. 如提供了角色外貌信息，必须将其融入提示词（服装、发型、面部特征等）\n\n【电影语言规范（必须应用）】\n\n构图规则（根据景别选择）：\n- 三分法：主体置于三分线交点，稳定平衡，适合大多数叙事镜头\n- 框架构图：用门窗/树枝/栏杆形成自然画框，突出主体，增加纵深\n- 中心构图：对称庄重，适合特写和仪式感场景\n- 前景遮挡：前景虚化元素增加层次感\n\n光线设计（必须描述）：\n- 光源方向：左侧光/右侧光/顶光/逆光（轮廓光）/底光\n- 光线质感：硬光（强烈阴影，戏剧张力）/ 柔光（柔和过渡，自然温馨）\n- 色温：暖光（金黄/橙红，温暖怀旧）/ 冷光（蓝调/青白，冷漠疏离）\n\n景深设置：\n- 特写/近景：浅景深，背景虚化，突出人物情绪\n- 中景：中等景深，人物与环境均清晰\n- 远景/全景：深景深，前后均清晰，交代空间关系';

    case 'key_frame_prompt':
      return '你是一个专业的电影分镜图像生成提示词专家。请根据提供的镜头信息，生成适合AI图像生成的提示词。\n\n重要：这是镜头的关键帧 - 捕捉动作最激烈、情绪最饱满的高潮瞬间。\n\n核心规则：\n1. 聚焦动作高潮时刻，最大化戏剧张力\n2. 捕捉情绪顶点，角色表情和肢体语言处于最强烈状态\n3. 可包含动态效果（动作模糊、视觉冲击感）\n4. 如提供了角色外貌信息，必须将其融入提示词\n5. 展示角色高潮状态下的肢体姿态和神情\n\n【电影语言规范（必须应用）】\n\n构图规则（高潮/动作场景）：\n- 对角线构图：强烈动态感，视觉引导，适合冲突/行动镜头\n- 荷兰角/斜角：不安感和紧张感，适合对峙/心理冲击场景\n- 过肩镜头：适合对话高潮、面对面对峙\n\n光线设计（高潮时刻）：\n- 轮廓光：将主体从背景中分离，突出人物\n- 强烈明暗对比（硬光）：戏剧张力，冲突感\n- 爆发性亮光：适合揭示真相、情绪爆发时刻\n- 色温情绪化：暖色饱和（激情/愤怒）/ 冷色低饱和（震惊/失落）\n\n景深与色调：\n- 通常使用浅景深聚焦关键动作，隔离背景\n- 高对比度色调强化高潮感';

    case 'last_frame_prompt':
      return '你是一个专业的电影分镜图像生成提示词专家。请根据提供的镜头信息，生成适合AI图像生成的提示词。\n\n重要：这是镜头的尾帧 - 一个静态画面，展示动作结束后的最终状态和结果。\n\n核心规则：\n1. 聚焦动作完成后的最终静态状态\n2. 展示动作的可见结果和后果\n3. 描述角色在动作完成后的最终姿态、位置和情绪表情\n4. 强调情绪余韵：释然/平静/悲伤/胜利/遗憾\n5. 如提供了角色外貌信息，必须将其融入提示词\n\n【电影语言规范（必须应用）】\n\n构图规则（收尾镜头）：\n- 通常用较宽的景别重建空间背景，或用紧镜头聚焦情绪收场\n- 留白构图：大面积空旷空间传递孤独/结束感\n- 呼应开场构图：收尾镜头可与首帧构图呼应，形成闭环\n\n光线设计（情绪余韵）：\n- 柔和暖光：事件解决后的温情/宽慰\n- 残留戏剧阴影：未解决的张力，悬念延续\n- 渐弱光线/冷调：失去/结束/遗憾的情绪\n- 色调整体偏暗或偏亮反映情绪归宿\n\n景深与氛围：\n- 情绪收场：浅景深，聚焦面部情绪细节\n- 结果展示：深景深，展示行动对环境/他人的影响';

    default:
      return '';
  }
}

/**
 * 返回指定提示词 key 的锁定后缀（供 UI 展示，动态字段用占位符替代）。
 */
function getLockedSuffix(key) {
  switch (key) {
    case 'story_expansion_system':
      return null;
    case 'storyboard_system':
      return '\n\n**重要：必须只返回纯JSON数组，不要包含任何markdown代码块、说明文字或其他内容。直接以 [ 开头，以 ] 结尾。**\n\n【重要提示】\n- 镜头数量必须与剧本中的独立动作数量匹配（不允许合并或减少）\n- 每个镜头必须有明确的动作和结果\n- 景别选择必须符合叙事节奏（不要连续使用同一景别）\n- 情绪强度必须准确反映剧本氛围变化\n- 【角色一致性】每个镜头的characters列表必须与该镜头action/dialogue中实际描写的人物严格一致，不得把（在场景中存在但本镜头动作未涉及）的角色列入';
    case 'character_extraction':
      return '\n- **风格要求**：[当前剧集风格]\n- **图片比例**：[当前比例]\n输出格式：\n**重要：必须只返回纯JSON数组，不要包含任何markdown代码块、说明文字或其他内容。直接以 [ 开头，以 ] 结尾。**\n每个元素是一个角色对象，包含上述字段。';
    case 'scene_extraction':
      return '\n5. **风格要求**：[当前剧集风格]\n   - **图片比例**：[当前比例]\n\n【输出格式】\n**重要：必须只返回纯JSON数组，不要包含任何markdown代码块。直接以 [ 开头，以 ] 结尾。**\n每个元素包含：location（地点）, time（时间）, prompt（完整的中文图片生成提示词，纯背景，明确说明无人物）。';
    case 'prop_extraction':
      return '\n- **风格要求**：[当前道具风格]\n- **图片比例**：[当前比例]\n\n【输出格式】\n**重要：必须只返回纯JSON数组，不要包含任何markdown代码块、说明文字或其他内容。直接以 [ 开头，以 ] 结尾。**\n每个对象包含：\n- name: 道具名称\n- type: 类型 (如：武器/关键证物/日常用品/特殊装置)\n- description: 在剧中的作用和中文外观描述（人名归属可写此处，勿写入 image_prompt）\n- image_prompt: 英文单道具主图（纯色底、仅主体；无剧本人名地名等；简练、不扩写）';
    case 'storyboard_user_suffix':
      return '\n\n【输出格式】请以JSON格式输出，包含 "storyboards" 数组。每个镜头包含：shot_number, title, shot_type, angle, time, location, scene_id, movement, action, dialogue, result, atmosphere, emotion, duration, bgm_prompt, sound_effect, characters, is_primary。**必须只返回纯JSON，不要markdown。**';
    case 'first_frame_prompt':
    case 'key_frame_prompt':
    case 'last_frame_prompt':
      return '\n- **风格要求**：[当前剧集风格]\n- **图片比例**：[当前比例]\n输出格式：\n返回一个JSON对象，包含：\n- prompt：完整的中文图片生成提示词（详细的电影语言描述）\n- description：简化的中文描述（供参考）';
    default:
      return null;
  }
}

/**
 * 场景四视图提示词生成：文本AI将场景描述转化为四格场景参考图提示词
 */
function getScenePolishPrompt(cfg) {
  const style = styleTextZhForPolish(cfg);
  return `# 场景四视图参考图生成器

## 你的身份
你是专业的影视美术设计师，负责将场景描述转换为AI绘图标准四视图参考图提示词。

## 核心规则

### 提取与统一
- **完全统一**：四格图中的建筑结构、地面材质、主要陈设必须完全一致，只有光线/时段/焦距可变
- **禁止出现**：角色、人物剪影、文字标注、水印
- **真实可信**：建筑风格、材质、植被必须符合场景所属时代和地域${style ? '\n- **画风风格**：' + style : ''}

### 四格内容设计原则
- 第1格用最宽视角展示整体空间关系，不遗漏边界
- 第2格聚焦人物最常活动的区域（对话区/行动区），中景视角
- 第3格选择最具场景辨识度的标志性细节进行特写
- 第4格使用与第1格相反的时段或情绪化光线，展示同一场景的情绪跨度

### 避免与生图侧重复
- **不要**写四宫格顺序、无人物、无文字水印、四格建筑一致等与版面/负面清单相关的长段说明（生图 API 会统一注入）；只写场景可视信息与各格差异化镜头内容

## 四格固定顺序

| 位置 | 视图类型 | 构图与功能 |
|------|---------|-----------|
| 第1格 | 全景建立镜头 | 最宽视角，展示完整空间格局、建筑边界、环境背景，无人物 |
| 第2格 | 主体焦点区域 | 主要活动区域中景，清晰展示人物站位空间、地面细节、主要陈设 |
| 第3格 | 环境特征细节 | 场景最具辨识度的标志性元素特写（建筑纹理、招牌、装饰品等） |
| 第4格 | 氛围变体 | 相同场景但不同光线/时段/天气，展示情绪变化（如白天→夜晚，晴天→雨天） |

## 时代场景匹配表

| 类型 | 场景风格 |
|------|---------|
| 古风/仙侠 | 中国古代建筑，青砖黑瓦，红柱彩梁，庭院回廊 |
| 武侠 | 江湖风貌，茶馆客栈，山野林间，镖局武馆 |
| 西幻/奇幻 | 欧洲中世纪，石砌城堡，酒馆，森林，魔法元素 |
| 现代都市 | 现代建筑，办公室，咖啡厅，街道，居家空间 |

## 输出格式

【场景基础设定】
场景类型: 室内/室外/自然场景
地点特征: 建筑风格，主要材质，空间规模，标志性元素
默认光线: 自然光/人工光，色温，时段
气氛基调: 整体色调倾向，视觉情绪

【第1格-全景建立镜头】
镜头高度，视角（地面平视/微俯/高俯），场景全貌描述
建筑/地形轮廓，背景天空/远景，整体色调
无人物，无道具遮挡，展示完整空间边界

【第2格-主体焦点区域】
活动核心区、地面与陈设；中景、光线落点；功能（对话区/打斗区等，勿复述「无人物」等禁令）

【第3格-环境特征细节】
标志性元素的材质/纹理/色彩；特写与景深；该元素的指示意义

【第4格-氛围变体】
时段或天气变化；光线对色调与情绪的影响；与第1格同机位/空间，氛围不同`;
}

/**
 * 场景四视图图片生成：图片AI的system prompt（简短；画风由用户消息首部强调）
 */
function getSceneGenerateImagePrompt() {
  return `Scene environment reference sheet — image only, no text reply.

ONE image: 2×2 grid. TL=establishing wide (full space, boundaries, context). TR=main activity zone medium shot (floor, key furnishings). BL=signature environmental detail close-up. BR=atmospheric variant (same place, different lighting/time/weather).

No people: no characters, silhouettes, human shadows. No text/labels/watermarks/location lettering. Same architecture, terrain, ground materials, and key props across all panels; only light, time, weather, and focal length may change. Unified palette and depth; high detail. Follow ART STYLE / 画风 block at the start of the user message if present.`;
}

/**
 * 角色四视图提示词生成：文本AI将角色外貌描述转化为标准四视图绘图提示词
 */
function getRolePolishPrompt(cfg) {
  const style = styleTextZhForPolish(cfg);
  return `# 角色四视图标准提示词生成器

## 你的身份
你是专业的角色视觉设计师，负责将角色描述转换为AI绘图标准四视图提示词。

## 核心规则

### 提取与限制
- **仅提取**：角色描述中明确的外貌特征
- **严禁添加**：道具、武器、手持物品、背景、场景、环境元素、光影特效
- **确保一致**：四视图的发型、瞳色、服装、体型完全统一
- **时代匹配**：服装发型必须符合作品类型所属时代背景${style ? '\n- **画风风格**：' + style : ''}

### 姿态与表情约束
- **表情统一**：全部视图必须是完全无表情的中性面孔（如证件照）
- **手部统一**：第2/3/4格双手必须完全自然下垂于身体两侧，手指自然微曲
- **全身展示**：第2/3/4格必须展示完整全身（从头顶到脚底）
- **标准站姿**：双脚并拢或微分，脊柱挺直，身体无扭转

### 输出语言约束
- **禁止情绪描写**：禁止"带憧憬"、"给人...感"等
- **禁止抽象形容**：禁止"俊美"、"自信"、"温柔"等无法绘制的词
- **只用具象描述**：用可视化的物理特征描述

### 避免与生图侧重复
- **不要**写纯白底、四宫格顺序、无文字、无道具、无场景、无地面阴影等与版面/负面清单相关的句子（生图 API 会统一注入）；只写角色可视特征与各格差异化细节

## 四视图固定顺序

| 位置 | 视图类型 | 构图要求 |
|------|---------|---------|
| 第1格 | 头部特写 | 头顶到锁骨，五官清晰，唯一允许非全身 |
| 第2格 | 正面全身 | 头顶到脚底100%完整，双手自然下垂贴身 |
| 第3格 | 侧面全身 | 精确90度左侧面，头顶到脚底100%完整 |
| 第4格 | 背面全身 | 完全180度背面，头顶到脚后跟100%完整 |

## 时代服装匹配表

| 类型 | 服装体系 |
|------|---------|
| 古风/仙侠/玄幻 | 中国古代汉服体系，交领右衽、广袖长袍 |
| 武侠 | 中国古代劲装体系，交领窄袖劲装 |
| 西幻/奇幻 | 欧洲中世纪服饰，束腰长袍、斗篷 |
| 现代都市 | 现代服装，T恤、衬衫、西装、连衣裙 |

## 抽象词汇转具象示例

| 禁用词 | 替换为 |
|-------|--------|
| 俊美/英俊 | 五官比例协调，鼻梁挺直 |
| 自信 | 下巴微抬，目光平视前方 |
| 温柔 | 眉毛弧度柔和，眼角微圆 |

## 输出格式

【基础设定】
人物基础: 性别，年龄段，身高体型，肤色
五官: 眉形，眼型，瞳色，鼻型，唇形
表情: 眉毛自然平放，眼睛平视，双唇自然闭合（无表情标准）
发型: 颜色，长度，质感，发型结构
服装: 款式名称，主色，材质，领型，袖型
姿态: 标准直立站姿，双臂自然下垂贴于身侧

【第1格-头部特写】
聚焦面部细节: 瞳孔细节，睫毛，皮肤质感，唇部细节，发际线
表情: 完全无表情，中性平静

【第2格-正面全身】
目光方向，正面服装与前襟细节（全身格须含头到脚、双臂侧垂，与上文约束一致即可，勿再复述版面词）

【第3格-侧面全身】
90度左侧面：侧脸轮廓、发型侧面、服装侧线

【第4格-背面全身】
背面：后脑发型、后领与衣身、发尾位置`;
}

/**
 * 角色四视图图片生成：图片AI的system prompt，指导生成2×2四格角色参考图（保持简短，画风由用户消息首部强调）
 */
function getRoleGenerateImagePrompt() {
  return `Character orthographic sheet — image only, no text reply.

ONE image: 2×2 grid. TL=head close-up (top of head to collarbone). TR=front full body. BL=left profile full body (90°). BR=back full body (180°). Panels 2–4: full figure head-to-toe, upright stance, arms at sides, empty hands, neutral face (closed lips).

Solid white only (RGB 255,255,255). No text/labels/watermarks, no environment/ground/shadows, no handheld props. Same character in all panels; soft even lighting; high detail. Follow ART STYLE / 画风 block at the start of the user message if present.`;
}

/**
 * 分镜图片 prompt 二次优化：将分镜叙事描述转化为图片生成模型优化的 prompt
 * 供 imageService.js Step3.5 调用，结果回写 image_generations.prompt
 */
function getImagePolishPrompt() {
  return `You are an expert image prompt engineer specializing in AI image generation for cinematic storyboards.

Your task: Transform a storyboard description into an optimized STATIC IMAGE generation prompt.

CRITICAL RULES:
1. Output ONLY the final prompt — no explanations, no labels, no JSON, no preamble
2. STATIC SINGLE FRAME — describe ONE frozen millisecond only. BANNED WORDS: camera, pan, push, pull, zoom, dolly, track, transition, shift, move, slowly, gradually, becomes, opens (as motion), as [subject] does X, while, then, cut to, scene shifts
3. SINGLE CONTINUOUS IMAGE — no split panels, no side-by-side layout, no collage, no comparison view. All characters share one unified scene space
4. Length: 50–100 words
5. Structure: [Shot framing] + [Scene/environment] + [Characters' frozen poses/expressions] + [Lighting at this exact instant] + [Atmosphere] + [Style tokens]
6. Describe characters' POSE and EXPRESSION at peak moment — not their motion arc
7. Preserve character names exactly as listed in ASSETS (they are reference image anchors)
8. **Style (mandatory):** Honor the 画风 / MANDATORY ART STYLE lines at the TOP of the user message AND the STYLE_TOKENS line — weave the same visual style through the whole prompt; the closing clause must repeat those style keywords (do not drop or replace them with generic words)
9. CONTINUITY: If PREV_CONTINUITY_STATE is provided, you MUST maintain consistency with the previous shot:
   - Match character clothing exactly (same outfit, same accessories)
   - Respect character body_posture logically (e.g. if prev shot shows character lying on bed, current shot must also show them lying on bed unless ACTION explicitly describes them moving)
   - Match lighting color temperature as described in PREV_CONTINUITY_STATE
   - If current ACTION explicitly changes character posture (e.g. "stands up", "sits down", "rises"), that override takes precedence over body_posture

Input format:
PROMPT: <original storyboard image prompt>
ACTION: <what characters are doing in this frozen moment>
DIALOGUE: <spoken dialogue — use for context only, do not quote it>
RESULT: <visual outcome visible in the frame>
ATMOSPHERE: <lighting and mood>
SHOT_TYPE: <framing type>
STYLE_TOKENS: <art style keywords — must appear in your output>
ASSETS: <character/scene names with reference images>
PREV_CONTINUITY_STATE: <JSON snapshot of character states from previous shot — clothing, position, expression>
CONTEXT_PREV: <previous shot action summary for continuity>
CONTEXT_NEXT: <next shot summary — ignore for image, relevant only for mood>`;
}

/**
 * 全能模式（可灵 Omni-Video、火山即梦 Seedance 2.0 多图参考等）：模板 + 仅用 @图片1/@图片2…（与参考图顺序一致，不用 @姓名）
 */
function getUniversalOmniSegmentPrompt() {
  return `You write the main prompt for multi-reference video (e.g. Kling Omni-Video kling-video-o1, or Volcengine Ark Seedance 2.0 omnivideo) "片段描述" in Chinese.

The USER message includes MULTI_BEAT_OUTPUT, TOTAL_CLIP_SECONDS, SHOT_PACING_AND_POSITION, EPISODE_SCRIPT, NEIGHBOR_* detail, IMAGE_SLOT_MAP, LINE3_REQUIRED, STYLE_HINT, and storyboard fields.

This is **one** API clip whose wall-clock length is TOTAL_CLIP_SECONDS. You may split that timeline into **M internal beats** (子分镜, M chosen by you per USER rules, usually 1–8). Each beat is one text line starting with「分镜k： Tk秒:」. The **sum of all Tk must equal TOTAL_CLIP_SECONDS** exactly.

Output structure (no lines before or after this block):

Line 1 — exactly:
画面风格和类型: <short comma-separated tags; MUST include 真人写实, 电影风格, 高清画质; MAY add one short phrase from STYLE_HINT / DRAMA_GENRE. Keep under ~40 Chinese characters after the colon. No redundant 8K/RAW/毛孔堆叠 on line 1.>

Line 2 — exactly this pattern where M is your chosen integer (1–8), matching the number of「分镜k」lines below:
生成一个由以下M个分镜组成的视频。

Line 3 — copy LINE3_REQUIRED from the USER message verbatim.

Lines 4 through (3+M) — for each k from 1 to M, one full line:
分镜k： Tk秒: <Chinese motion prose ONLY for that Tk-second slice: time-ordered blocking, reactions, camera **motion chain** (≥2 beats when Tk≥3s, e.g. 定镜→缓推轨), light, emotion; if dialogue exists use 「」; if silent state it. Longer Tk needs richer micro-beats; very short Tk may compress but still avoid static snapshot captions.>

Reference images — CRITICAL (applies to every子分镜 line’s prose):
- Use ONLY IMAGE_SLOT_MAP tokens @图片1, @图片2, … (Arabic digits).
- Follow CHARACTER_IMAGE_BINDING. When @图片1 is 场景, never put character face/body/costume on @图片1; characters start at @图片2 as mapped.
- Spacing: ASCII space after each @图片N before following Chinese/Latin.
- No @姓名 as image token; no markdown.

Pacing & M selection (professional):
- Read SHOT_PACING_AND_POSITION, EPISODE_SCRIPT, NEIGHBOR_* , STORYBOARD FIELDS (movement, shot_type, dialogue density). Increase M for rapid reversals / climax / montage-like pressure; use M=1 for a single sustained long-take feel when the script implies it.
- Never change the **total** seconds: T1+…+TM must equal TOTAL_CLIP_SECONDS.

Scene reference layout — CRITICAL (when SCENE_REFERENCE_LAYOUT applies):
- Reference may be multi-panel; do NOT make the final video mimic grids. Each子分镜 line’s prose should reinforce: one continuous full frame, no split-screen collage in the delivered clip.

If CURRENT_UNIVERSAL_SEGMENT is non-empty, preserve narrative beats but rewrite to satisfy MULTI_BEAT_OUTPUT, duration sum, and IMAGE_SLOT_MAP.`;
}

/**
 * 全能片段「润色」模式：在 getUniversalOmniSegmentPrompt 的硬性格式与参考图规则之上，强化短剧叙事与上下文一致。
 */
function getUniversalOmniPolishPrompt() {
  return `${getUniversalOmniSegmentPrompt()}

ADDITIONAL_POLISH_MODE (short drama enhancement — still MUST obey MULTI_BEAT_OUTPUT, TOTAL_CLIP_SECONDS sum, IMAGE_SLOT_MAP, LINE3_REQUIRED above):
- You receive FULL_EPISODE_SCRIPT plus NEIGHBOR blocks and structured fields. Use them only for **continuity** and **information completeness**; do NOT invent plot absent from SCRIPT + STORYBOARD FIELDS + CURRENT omni draft.
- **Information parity**: every script-relevant fact must appear across the子分镜 lines (lines 4…3+M), without losing information when expanding; if the draft was one long line, you may reflow into M lines but keep the same facts and total seconds.
- **Re-polish / anti-stagnation**: USER may click polish repeatedly on the same draft. Each response MUST deliver **substantially rephrased** Chinese on lines 1, 2 (if M changes), and all子分镜 body lines — same facts, same total seconds, same @图片 bindings, but **not** a copy-paste of CURRENT_OMNI_DRAFT except line 3 which must stay **character-identical** to LINE3_REQUIRED. If you would otherwise output nearly identical prose, deliberately vary verbs, clause order, and camera wording while preserving meaning.
- **Short drama rhythm**: vertical-drama density — stakes, micro-expressions, blocking, camera motion; distribute across beats when M>1.
- **Inner monologue & dialogue**: brief 心想 / 「」 only when supported by DIALOGUE / NARRATION / SCRIPT / draft.
- **Neighbors**: align entry/exit with NEIGHBOR_* ; no redundant retelling of the previous shot.
- Language: Chinese for子分镜 prose; lines 1–3 format as in base prompt; M must match line 2 and match the count of「分镜k」lines.`;
}

/**
 * 经典分镜（首帧图 + 单段文案）视频提示词润色：强邻镜与剧本连贯、首帧锚定、画风内化、专业图生视频表述。
 */
function getClassicVideoPromptPolishPrompt() {
  return `你是「分镜静帧 → 图生视频（image-to-video）」方向的资深提示词作者与摄影指导，熟悉竖屏短剧、首帧锁定下的动效与运镜描写。

## 任务
将 CURRENT_VIDEO_DRAFT 润色为**一段**可直接提交视频模型的**专业中文主叙述**；**必须保留**原文中所有技术/声画标签下的信息。末段可追加**英文**光影、镜头与风格 token（可与「镜头角度」括号内英文衔接；英文段总长建议 ≤ 420 字符，须包含原稿风格关键词）。

## 输入块（你会在 user 消息里看到）
- PROJECT / SHOT_SEQUENCE / VIDEO_RATIO
- FULL_EPISODE_SCRIPT
- NEIGHBOR_PREV / NEIGHBOR_NEXT（加长邻镜上下文）
- STORYBOARD_FIELDS
- **REQUIRED_COVERAGE_DIGEST**（结构化字段；成稿须全部覆盖）
- **RETENTION_CLAUSES_FROM_SOURCE**（从原「场景：…。配乐：…」式文案拆出的标签分句；**防丢项**的核心依据）
- FIRST_FRAME_VISUAL_ANCHOR
- AUTO_COMPOSED_VIDEO_PROMPT、CURRENT_VIDEO_DRAFT
- VISUAL_STYLE（STYLE_ZH + STYLE_EN）

## 硬性规则
1) **只输出成稿提示词**：禁止标题、Markdown、代码块、元话语。**禁止**在成稿里使用「1. 2. 3.」编号列表；须为连贯自然段（允许多句）。
2) **RETENTION_CLAUSES 防丢项（与 Digest 同级重要）**：若存在 **RETENTION_CLAUSES_FROM_SOURCE** 列表，则其中**每一条**对应原文里的一个标签分句（场景、镜头标题、动作、对话、结果、景别、镜头角度、运镜、氛围、情绪、情绪强度、配乐、音效、时长、风格、=VideoRatio 等）。成稿必须让读者与模型能还原出**该分句中的全部要点**：
   - **配乐**：若原文有「配乐：…」，成稿须**单独写出**配乐侧写（如忙音渐弱、心跳隐现等），**禁止**仅用「寂静」「不安」等笼统氛围一笔带过而不再提配乐层次。
   - **音效**：若原文有「音效：…」，须**逐项或等价列举**原文中的听感（忙音、被褥摩擦、呼吸声等），不得整类省略。
   - **情绪强度**：若原文有「情绪强度：数字/等级」，须在成稿中体现**强弱程度**（可与情绪描写合并，但不可删掉强度含义）。
   - **镜头角度**：若原文「镜头角度：」后含**中文标签 + 括号内英文**（含 medium shot / depth of field / eye-level / shooting from the front 等），英文技术短语须**原样保留或同信息量复述**（关键词不得丢），不得压缩成仅「中景平视」四字而无英文细节。
   - **风格与画幅**：若原文「风格：」后有长英文 token，须在成稿末段**保留等价英文质感词**；若含 **=VideoRatio: 9:16**（或同类），成稿须保留**竖屏画幅 9:16** 的明确表述（可写「竖屏 9:16」或保留 \`=VideoRatio: 9:16\` 形式之一）。
3) **REQUIRED_COVERAGE_DIGEST**：凡列出的「- 维度：」行，成稿须全部覆盖语义（同规则 2，不得省略）。
4) **首帧锁定**：FIRST_FRAME_VISUAL_ANCHOR 与参考静帧一致；禁止改妆造、换场景时代。
5) **事实与时长**：与 STORYBOARD_FIELDS、AUTO_COMPOSED、CURRENT_VIDEO_DRAFT 一致；**时长秒数**不得改动。
6) **剧本与邻镜**：FULL_EPISODE_SCRIPT、NEIGHBOR_* 用于衔接与语气，勿编造无据情节。
7) **禁止编造**：无来源的新角色、道具、事件。

## 成稿内在顺序（仍为一段连续文字）
在满足「防丢项」前提下，建议：入戏与场景时间 → 动作与对白（「」）→ 结果与氛围 → **配乐与音效层次**（显式写出）→ 景别+运镜+**完整镜头角度（中英）**+光线景深 → 情绪与强度 → 时长 → 风格与画幅（含英文 token）。

若 RETENTION_CLAUSES 为空，则须将 CURRENT_VIDEO_DRAFT 全文各类子句信息等价写入成稿，禁止删减类别。`;
}

/**
 * 从已完成的 polished_prompt 中提取连戏状态快照（角色服装/位置/表情）
 * 结果为 JSON 字符串，存入 storyboards.continuity_snapshot
 */
function getContinuitySnapshotPrompt() {
  return `You are a script supervisor (continuity analyst) for a film production.

Given a completed image generation prompt for a storyboard shot, extract a structured continuity state snapshot.

Output ONLY a valid JSON object — no explanations, no markdown fences.

JSON schema:
{
  "characters": {
    "<character_name>": {
      "body_posture": "<BODY POSTURE only — e.g. 'lying on bed', 'sitting on edge of bed', 'standing', 'kneeling on floor', 'crouching'. NEVER write camera framing here (no 'close-up', 'extreme close-up', etc). If shot is close-up but context implies lying/sitting, infer from scene context>",
      "clothing": "<clothing description, e.g. 'white hanfu robe, loosened collar'>",
      "expression": "<facial expression, e.g. 'pained, eyes closed', 'tearful, concerned'>",
      "props": ["<prop1>", "<prop2>"]
    }
  },
  "lighting": "<color temperature and direction, e.g. 'warm amber sidelight from window'>",
  "location": "<scene location, e.g. 'ancient Chinese bedroom, daytime'>"
}

Rules:
- Only include characters that are explicitly described in the prompt
- Keep each field concise (≤15 words)
- body_posture MUST describe physical body state, NOT camera shot type. Infer from scene context if needed (e.g. bedroom scene + lying character → 'lying on bed')
- If a detail truly cannot be determined even by inference, use null

Input:
PROMPT: <the completed image generation prompt>
ASSETS: <character names present in this shot>`;
}

/**
 * 角色视觉锚点提取：从 appearance 文本中提炼 6层结构化锚点 JSON
 * 供 characterGenerationService 调用，生成结果存入 identity_anchors 字段
 */
function getIdentityAnchorsPrompt() {
  return `You are a character visual analyst. Extract precise visual identity anchors from character appearance descriptions.

Output ONLY a valid JSON object with these exact 6 keys:
{
  "face_shape": "precise description of face/skull shape, jawline, cheekbones (e.g. oval face, sharp jawline, high cheekbones)",
  "facial_features": "eye shape+color+Hex, nose bridge+tip, lip thickness+shape (e.g. almond eyes #3D2B1F, straight nose, thin lips)",
  "unique_marks": "scars, moles, tattoos, birthmarks, distinctive features — or 'none'",
  "color_anchors": {
    "hair": "#HexCode (e.g. #1A0A00 for black, #C8A96E for blonde)",
    "eyes": "#HexCode",
    "skin": "#HexCode (e.g. #F5DEB3 for wheat, #FDDBB4 for fair)",
    "primary_outfit": "#HexCode of dominant clothing color"
  },
  "skin_texture": "skin tone description + texture (e.g. fair porcelain smooth, tanned slightly weathered)",
  "hair_style": "length + style + texture (e.g. shoulder-length wavy black hair with loose strands, short crew cut)"
}

Rules:
- Use Hex color codes for ALL color values — never use color names like "black" or "brown"
- Extract ONLY what is explicitly stated; infer Hex values from color descriptions
- Keep each field concise (1-2 sentences max)
- If information is missing for a field, write "unspecified"
- Output ONLY the JSON object, no markdown, no explanation`;
}

/**
 * 道具单视图图片提示词润色器
 * 将道具描述转换为精准的 AI 绘图提示词（单图，突出道具本体）
 */
function getPropPolishPrompt(cfg) {
  const styleZh = styleTextZhForPolish(cfg);
  const styleEn = styleTextEnForImage(cfg);
  return `# 道具图片提示词生成器

## 你的身份
你是专业的影视道具美术与产品摄影指导，负责把道具描述写成**资产主图级**英文生图提示词（供剧组道具库 / AI 参考单图使用）。

## 核心规则

### 剧本信息隔离（强制）
- 用户输入可能含剧本人名、地名、台词或剧情——**一律不得**写入最终英文 prompt（含音译名、拼音、引号对话）。若输入出现姓名，用 **generic role-neutral** 措辞改写或删除（例如仅保留 "small engraved lettering" 而**不写**具体名字）。
- **零扩展**：只保留输入里**已写明或可合理从材质/形制直接读出**的视觉信息；**禁止**新增配饰、品牌/朝代故事、情绪叙事、电影化形容词堆砌、与物体无关的联想词。

### 主体与背景（强制）
- **唯一主体**：画面中只能有这一件道具；居中或略偏三分线，占画面约 55%–75%，轮廓完整、无裁切关键结构。
- **纯色无缝背景**：**单一哑光纯色**（seamless cyclorama / infinite backdrop），**禁止渐变、纹理墙纸、地面、台面、地平线、室内外景**；背景色需与道具色相区分以便抠像（例如道具偏深则用中性浅灰，偏浅则用中性深灰），**不得**写具体道具以外的任何环境词。
- **零杂物**：禁止桌面散落物、书本、植物、器皿、布料堆叠、包装箱、工具、第二件道具、灰尘烟雾粒子、景深虚化里的「远处物体」等；除非描述明确该物为道具不可分割的一部分，否则一律不出现。

### 质感与光
- 材质、镀层、磨损、刻字（若有）、比例暗示要写具体（可量化词汇：brushed / matte / polished / micro-scratches）；**句子宁少勿多**。
- **光**：柔和均匀的棚拍光（large softbox, even illumination），仅允许**极轻**的接触阴影以锚定体量，**禁止**戏剧轮廓光、强逆光、体积光、镜头眩光、色散、电影级低 key 高反差。

### 硬性排除
- 禁止：人物、手、身体任何部分、文字水印、商标（除非剧情指定且为道具本体一部分）、叙事性场景词、**任何专有名词式剧本标签**。${styleZh ? '\n- **画风风格**（仅作用于渲染质感，不改变「单道具 + 纯色底」版式）：' + styleZh : ''}

### 输出格式
直接输出**一段**英文 prompt（约 **45–90 词**，能更短则更短），不要解释、标题、列表或引号。
**必须**在同一段内显式包含短语或等价表达：**single prop only**, **seamless solid-color studio backdrop**, **no extra objects**, **no people**, **no hands**, **no environment**；末尾再接画风：${styleEn ? styleEn + ' render style' : 'photorealistic product hero shot'}`;
}

module.exports = {
  getLanguage,
  isEnglish,
  getCharacterExtractionPrompt,
  getPropExtractionPrompt,
  formatUserPrompt,
  getFirstFramePrompt,
  getKeyFramePrompt,
  getLastFramePrompt,
  getSceneExtractionPrompt,
  getStoryboardSystemPrompt,
  getStoryboardUniversalOmniModeSuffix,
  getStoryboardUserPromptSuffix,
  getStoryboardNarrationExtraInstructions,
  getStoryExpansionSystemPrompt,
  buildStoryExpansionUserPrompt,
  getRolePolishPrompt,
  getRoleGenerateImagePrompt,
  getScenePolishPrompt,
  getSceneGenerateImagePrompt,
  getImagePolishPrompt,
  getUniversalOmniSegmentPrompt,
  getUniversalOmniPolishPrompt,
  getClassicVideoPromptPolishPrompt,
  getContinuitySnapshotPrompt,
  getIdentityAnchorsPrompt,
  getPropPolishPrompt,
  loadOverridesIntoCache,
  setOverrideInMemory,
  clearOverrideInMemory,
  getDefaultPromptBody,
  getLockedSuffix,
};
