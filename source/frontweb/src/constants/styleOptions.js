/** 自定义画风：dramas.style 固定短标识，完整描述写在 metadata.style_prompt_* */
export const CUSTOM_STYLE_VALUE = 'custom'

/** 影像风格选项 - 静态配置数据 */
export const generationStyleOptions = [
  {
    label: '写实 / 影视',
    options: [
      { label: '写实',    value: 'realistic',
        prompt:   '超写实摄影风格，8K超清细节，精准自然光照，真实皮肤纹理，专业摄影机拍摄，RAW原片质感，超高清锐度，人物面部毛孔清晰可见',
        promptEn: 'photorealistic, ultra-detailed, 8k uhd, sharp focus, natural lighting, real skin texture, hyperrealism, professional photography, RAW photo',
        color: 'linear-gradient(135deg,#c9a87c,#7c5e3c)', thumb: '/style-thumbs/realistic.jpg' },
      { label: '电影感',  value: 'cinematic',
        prompt:   '电影级大片画面，变形镜头压缩感，胶片颗粒质感，伦勃朗式戏剧性布光，浅景深虚化背景，专业调色风格，史诗级构图，35mm胶片美学，宽画幅银幕比例',
        promptEn: 'cinematic movie still, anamorphic lens, film grain, dramatic rembrandt lighting, shallow depth of field, color graded, epic composition, professional cinematography, 35mm film, widescreen',
        color: 'linear-gradient(135deg,#1a1a2e,#c9aa71)', thumb: '/style-thumbs/cinematic.jpg' },
      { label: '纪录片',  value: 'documentary',
        prompt:   '纪录片摄影风格，自然可用光源，抓拍式真实瞬间，手持摄影机晃动感，新闻摄影美学，粗粝真实质感，颗粒感胶片，非摆拍自然状态',
        promptEn: 'documentary photography style, natural available light, candid authentic moment, handheld camera look, photojournalism, raw gritty realism, grain texture, unposed',
        color: 'linear-gradient(135deg,#4a6741,#8fbc8f)', thumb: '/style-thumbs/documentary.jpg' },
      { label: '黑色电影', value: 'noir',
        prompt:   '黑色电影风格，高对比度黑白影调，强烈明暗光影雕刻，百叶窗投影光纹，1940年代侦探片氛围，悬疑神秘气质，烟雾缭绕与雨夜街景',
        promptEn: 'film noir, dramatic high-contrast black and white, hard chiaroscuro shadows, venetian blind light patterns, moody 1940s detective aesthetic, mystery atmosphere, smoke and rain',
        color: 'linear-gradient(135deg,#1a1a1a,#666)',    thumb: '/style-thumbs/noir.jpg' },
      { label: '复古胶片', value: 'retro film',
        prompt:   '复古胶片摄影美学，柯达色彩体系，漏光与光晕效果，浓重35mm胶片颗粒，褪色暖调色彩，模拟胶片质感，怀旧复古氛围，轻微过曝处理',
        promptEn: 'vintage retro film photography, kodachrome color palette, light leaks, heavy 35mm grain, faded warm tones, analog film aesthetics, nostalgic atmosphere, slightly overexposed',
        color: 'linear-gradient(135deg,#d4a373,#8b6914)', thumb: '/style-thumbs/retro.jpg' },
      { label: '恐怖',    value: 'horror',
        prompt:   '恐怖氛围渲染，阴暗压抑情绪，浓厚大气雾气，深重戏剧阴影，诡异冷色布光，令人不安的构图，哥特元素点缀，去饱和暗调色板，心理悬疑张力',
        promptEn: 'horror atmosphere, dark ominous mood, dense atmospheric fog, deep dramatic shadows, eerie cold lighting, unsettling composition, gothic elements, desaturated dark palette, psychological tension',
        color: 'linear-gradient(135deg,#1a0a0a,#7b1111)', thumb: '/style-thumbs/horror.jpg' },
    ]
  },
  {
    label: '动漫 / 卡通',
    options: [
      { label: '日本动漫', value: 'anime style',
        prompt:   '日本动漫画风，精细赛璐璐上色，清晰黑色线稿，高饱和鲜艳配色，极具表现力的角色设计，动画工作室级别质量，漫画美学影响，关键帧视觉插图风格',
        promptEn: 'anime style, Japanese animation, clean cel shading, precise black linework, vibrant saturated colors, expressive character design, studio quality, manga influence, key visual illustration',
        color: 'linear-gradient(135deg,#ff9fd2,#a97cdb)', thumb: '/style-thumbs/anime.jpg' },
      { label: '欧美漫画', value: 'comic style',
        prompt:   '欧美漫画风格，粗犷墨线勾勒，半调网点纹理，充满动感的动作构图，平涂鲜艳色彩，超级英雄插画美学，墨水上色分格效果',
        promptEn: 'western comic book style, bold ink linework, halftone dot texture, dynamic action composition, flat vibrant colors, superhero illustration aesthetic, inked and colored panels',
        color: 'linear-gradient(135deg,#4169e1,#ff6b47)', thumb: '/style-thumbs/comic.jpg' },
      { label: '卡通',    value: 'cartoon',
        prompt:   '卡通插画风格，简洁粗犷轮廓线，平涂纯色块面，夸张表情与肢体动作，活泼友好的设计感，欧美动画片风格，干净的矢量感画质',
        promptEn: 'cartoon illustration, simple bold outlines, flat solid colors, exaggerated expressive features, playful friendly design, western animation style, clean vector-like quality',
        color: 'linear-gradient(135deg,#ffd700,#ff6b6b)', thumb: '/style-thumbs/cartoon.jpg' },
      { label: '2D 动画', value: '2d animation',
        prompt:   '二维动画风格，流畅动画单帧画面，干净平面设计感，粗犷轮廓线条，鲜艳饱和色彩，动画长片级别质量，关键帧插画美学',
        promptEn: '2D animation style, smooth animated frame, clean flat design, bold outlines, vibrant colors, animated feature film quality, keyframe illustration',
        color: 'linear-gradient(135deg,#43e97b,#38f9d7)', thumb: '/style-thumbs/2d-animation.jpg' },
      { label: '写实二次元', value: 'realistic anime',
        prompt:   '写实二次元风格，动漫角色比例与精致五官，真实皮肤与头发微细节，细腻赛璐璐与软写实混合上色，电影级体积光与环境反射，现代都市或室内真实场景，镜头感构图与浅景深，保留二次元清晰轮廓同时具备影视级材质质感，日漫与国漫高质量宣传视觉气质',
        promptEn: 'realistic anime style, anime character proportions with refined facial features, realistic skin texture and detailed hair strands, hybrid cel shading and soft semi-realistic rendering, cinematic volumetric lighting and environment reflections, modern urban or interior real-world setting, cinematic composition with shallow depth of field, keep clean anime linework while preserving film-grade material realism, high-end Japanese and Chinese anime promotional visual aesthetic',
        color: 'linear-gradient(135deg,#7c83fd,#2dd4bf)', thumb: '/style-thumbs/realisticanime.png' },
      { label: '都市3D风格', value: 'urban 3d',
        prompt:   '都市三维风格，当代摩天楼与玻璃幕墙街景，钢混结构与金属反光，PBR物理材质与柔和全局光照，天空与建筑环境反射，轻微景深虚化车流与行人轮廓，干净偏写实三维渲染，国产都市剧与商业广告CG常见气质，高细节环境光遮蔽与体积雾点缀',
        promptEn: 'urban contemporary 3D CGI, modern skyscrapers and glass curtain wall streetscape, steel concrete architecture with subtle metal reflections, PBR materials soft global illumination sky and building reflections, gentle depth of field for traffic and pedestrian silhouettes, clean semi-realistic 3D render Chinese urban drama and commercial CG aesthetic, high detail ambient occlusion light atmospheric haze',
        color: 'linear-gradient(135deg,#1e3a5f,#38bdf8)', thumb: '/style-thumbs/3d-render.jpg' },
    ]
  },
  {
    label: '中国风格',
    options: [
      { label: '国画水墨', value: 'ink wash',
        prompt:   '中国传统水墨画风格，泼墨写意技法，单色笔墨晕染，竹毫笔触肌理，极简留白构图，宣纸纸张质感，诗意朦胧云雾氛围，国画工笔与写意结合',
        promptEn: 'traditional Chinese ink wash painting, sumi-e style, monochrome brushwork, bamboo brush strokes, minimalist composition, generous negative space, xuan paper texture, poetic misty atmosphere, guohua style',
        color: 'linear-gradient(135deg,#e8e0d5,#8b7355)', thumb: '/style-thumbs/ink-wash.jpg' },
      { label: '中国风',  value: 'chinese style',
        prompt:   '中国传统美学，精致汉服服饰，朱红描金器物，精工刺绣纹样，明清朝代设计元素，古典建筑与亭台楼阁，景深悠远的意境',
        promptEn: 'Chinese traditional aesthetics, elegant hanfu costumes, red lacquer and gold ornaments, intricate embroidered patterns, Ming-Qing dynasty design elements, classical architecture, atmospheric depth',
        color: 'linear-gradient(135deg,#c0392b,#8b0000)', thumb: '/style-thumbs/chinese.jpg' },
      { label: '古装',    value: 'historical',
        prompt:   '中国历史古装剧风格，唐宋朝代电影美学，飘逸汉服广袖，皇宫殿宇建筑，古典园林景观，浓郁暖调色彩分级，高制作水准影视质感',
        promptEn: 'Chinese historical drama, ancient China setting, Tang-Song dynasty cinematic aesthetic, flowing traditional hanfu robes, imperial palace architecture, classical garden, rich warm color grading, high production value',
        color: 'linear-gradient(135deg,#d4af37,#8b5e14)', thumb: '/style-thumbs/historical.jpg' },
      { label: '武侠',    value: 'wuxia',
        prompt:   '武侠史诗画风，古代中国山河背景，丝绸长袍飞扬动感，云雾缥缈的山水胜景，戏剧性剑术对决姿态，水墨晕染氛围影响，侠客剑士英雄美学，史诗宽幅电影构图，烟雾光芒交织的悬疑气氛',
        promptEn: 'wuxia martial arts epic, ancient China, flowing silk robes in dynamic motion, misty mountain landscape, dramatic sword fighting pose, atmospheric ink wash influence, hero and swordsman aesthetic, cinematic epic wide shot, moody fog and light rays',
        color: 'linear-gradient(135deg,#2c3e50,#3498db)', thumb: '/style-thumbs/wuxia.jpg' },
    ]
  },
  {
    label: '国漫 / 现言',
    options: [
      { label: '2D 古风', value: '2d gufeng',
        prompt:   '国产二维古风插画，清瘦线稿与赛璐璐平涂，低饱和雅致配色，汉服与发饰精细刻画，亭台楼阁或山水留白，网文封面与番剧人设常见气质，干净无噪点数码绘',
        promptEn: 'Chinese 2D guofeng illustration, delicate linework and cel shading, soft muted elegant palette, detailed hanfu and hair ornaments, pavilion or misty landscape, web novel cover and donghua character art style, clean digital painting',
        color: 'linear-gradient(135deg,#e8dcc8,#9b7653)', thumb: '/style-thumbs/2d-gufeng.jpg' },
      { label: '仙侠 3D', value: 'xianxia 3d',
        prompt:   '仙侠玄幻三维渲染，空灵仙境氛围，灵力流光与法术粒子，广袖仙袍与玉冠发饰，云海奇峰与宫阙楼阁，国产仙侠剧与游戏CG审美，柔和体积光与景深',
        promptEn: 'Chinese xianxia fantasy 3D render, ethereal immortal realm, spiritual glow and spell particles, flowing immortal robes and jade hair crown, sea of clouds and celestial palace, Chinese fantasy drama and game CG aesthetic, soft volumetric light and depth of field',
        color: 'linear-gradient(135deg,#1a3a52,#7ec8e3)', thumb: '/style-thumbs/xianxia-3d.jpg' },
      { label: '古风 3D', value: 'gufeng 3d',
        prompt:   '古风写实三维角色与场景，次表面散射肤质与丝绸布料，高盘发与步摇细节，宫殿园林或市井街景，古装剧级服化道，暖调电影级调色，精致但不过分卡通',
        promptEn: 'Chinese historical 3D realistic character and scene, subsurface skin and silk fabric detail, elaborate hairpins and hanfu, palace garden or ancient street, costume drama level production design, warm cinematic color grading, refined semi-realistic 3D',
        color: 'linear-gradient(135deg,#5c4033,#c9a227)', thumb: '/style-thumbs/gufeng-3d.jpg' },
      { label: '新中式国潮', value: 'neo chinese guochao',
        prompt:   '新中式国潮视觉，传统纹样与书法笔触融入现代平面设计，高饱和撞色与霓虹点缀，祥云龙纹水墨几何化，海报插画感，年轻潮流与东方符号并存',
        promptEn: 'neo-Chinese guochao graphic style, traditional patterns and brush strokes in modern flat design, bold saturated colors with neon accents, stylized clouds dragons ink geometry, poster illustration vibe, youthful street fashion meets oriental motifs',
        color: 'linear-gradient(135deg,#c41e3a,#1a1a2e)', thumb: '/style-thumbs/neo-chinese-guochao.jpg' },
      { label: '新古风', value: 'neo gufeng',
        prompt:   '新古风插画，在古典意境上偏清新明亮，柔焦轮廓与细腻渐变，言情与仙侠题材常见，人物唯美表情细腻，背景水墨氤氲但不压抑，适合竖版封面',
        promptEn: 'neo guofeng illustration, classical mood with fresh bright tones, soft edges and smooth gradients, romance and xianxia novel aesthetic, delicate faces and expressive eyes, misty ink wash background, vertical cover art composition',
        color: 'linear-gradient(135deg,#f5e6d3,#b8860b)', thumb: '/style-thumbs/neo-gufeng.jpg' },
      { label: '都市现言漫画', value: 'urban romance comic',
        prompt:   '都市现代言情漫画风，明亮清透上色，写字楼咖啡厅街景，人物美型大眼简化鼻唇，条漫分镜感，点缀星光或柔焦浪漫光斑，国产现言漫常见甜宠气质',
        promptEn: 'urban contemporary romance manhua style, bright clean coloring, office cafe city street backgrounds, pretty stylized faces big eyes, webcomic panel feel, sparkle and soft bokeh romantic lighting, sweet modern Chinese romance comic aesthetic',
        color: 'linear-gradient(135deg,#ffeef8,#a78bfa)', thumb: '/style-thumbs/urban-romance-comic.jpg' },
      { label: '韩漫纯爱', value: 'korean romance webtoon',
        prompt:   '韩式条漫纯爱画风，极简干净线稿，柔和粉彩与渐变，角色清秀少年感，竖构图留白，心跳初恋氛围，柔边阴影与高光，类似韩国恋爱类网漫',
        promptEn: 'Korean romance webtoon style, clean minimal linework, soft pastel gradients, delicate youthful characters, vertical scroll composition, innocent first love mood, soft cel shading and highlights, Korean BL or romance manhwa aesthetic',
        color: 'linear-gradient(135deg,#ffd6e8,#b4a7d6)', thumb: '/style-thumbs/korean-romance-webtoon.jpg' },
    ]
  },
  {
    label: '绘画艺术',
    options: [
      { label: '水彩',    value: 'watercolor',
        prompt:   '水彩绘画风格，湿润叠色柔边，透明色彩晕染，流动颜料自然扩散，纸张纤维质感，印象派笔触，明亮柔和色调，精致手绘插画质量',
        promptEn: 'watercolor painting, soft wet-on-wet edges, transparent color washes, flowing pigment blooms, delicate paper texture, impressionistic strokes, luminous pastel tones, fine art illustration',
        color: 'linear-gradient(135deg,#a8d8ea,#ffd3b6)', thumb: '/style-thumbs/watercolor.jpg' },
      { label: '油画',    value: 'oil painting',
        prompt:   '布面油画风格，厚涂肌理质感，有力方向性笔触，深沉饱和色彩，古典大师明暗对比光法，博物馆级精品，文艺复兴美学传承',
        promptEn: 'oil painting on canvas, rich impasto textures, thick directional brushwork, deep saturated colors, old master chiaroscuro lighting, museum quality fine art, classical Renaissance aesthetic',
        color: 'linear-gradient(135deg,#d4a76a,#6b3728)', thumb: '/style-thumbs/oil-painting.jpg' },
      { label: '素描',    value: 'sketch',
        prompt:   '精细铅笔素描，石墨绘画质感，精准排线与交叉网线，明暗调子处理，美术速写本质量，黑白单色，原始艺术张力，炭笔纸面肌理',
        promptEn: 'detailed pencil sketch, graphite drawing, precise hatching and crosshatching, tonal shading, fine art sketchbook quality, monochrome, raw artistic energy, charcoal texture',
        color: 'linear-gradient(135deg,#f0f0f0,#888)',    thumb: '/style-thumbs/sketch.jpg' },
      { label: '版画',    value: 'woodblock print',
        prompt:   '传统木刻版画风格，浮世绘美学，大块平涂色域，有限和谐色系，日本版画制作美学，图形化线条，北斋构图风格',
        promptEn: 'traditional woodblock print, ukiyo-e inspired, bold flat color areas, limited harmonious palette, Japanese printmaking aesthetic, graphic linework, Hokusai style composition',
        color: 'linear-gradient(135deg,#4a3728,#c9a87c)', thumb: '/style-thumbs/woodblock.jpg' },
      { label: '印象派',  value: 'impressionist',
        prompt:   '印象派油画风格，松散表现性笔触，斑驳阳光光影效果，鲜明互补色彩，莫奈雷诺阿风格，户外写生自然光，大气光色交融',
        promptEn: 'impressionist oil painting, loose expressive brushstrokes, dappled sunlight effect, vibrant complementary colors, Monet-Renoir style, plein air outdoor painting, atmospheric light and color',
        color: 'linear-gradient(135deg,#7ec8e3,#f9c74f)', thumb: '/style-thumbs/impressionist.jpg' },
    ]
  },
  {
    label: '幻想 / 科幻',
    options: [
      { label: '奇幻',    value: 'fantasy',
        prompt:   '史诗奇幻数字艺术，神奇空灵大气，戏剧性黄金时刻光效，神话生物与魔法世界，壮阔全景风光，高度细腻概念艺术，绘画插图质量',
        promptEn: 'epic fantasy digital art, magical ethereal atmosphere, dramatic golden hour lighting, mythical creatures and enchanted world, sweeping landscape, highly detailed concept art, painterly illustration quality',
        color: 'linear-gradient(135deg,#6a0572,#e8b86d)', thumb: '/style-thumbs/fantasy.jpg' },
      { label: '暗黑奇幻', value: 'dark fantasy',
        prompt:   '黑暗奇幻艺术风格，哥特式阴郁氛围，压抑暗沉色调，戏剧性边缘补光，克苏鲁秘法元素，巴洛克繁复细节，严酷粗粝的世界观，恐怖奇幻交融',
        promptEn: 'dark fantasy art, gothic ominous atmosphere, brooding dark palette, dramatic rim lighting, eldritch and arcane elements, baroque ornate detail, grim and gritty world, horror fantasy crossover',
        color: 'linear-gradient(135deg,#0d0d0d,#6b0f1a)', thumb: '/style-thumbs/dark-fantasy.jpg' },
      { label: '科幻',    value: 'sci-fi',
        prompt:   '科幻概念艺术，未来科技元素，全息投影界面，先进文明设计美学，简洁科幻质感，太空时代材质，发光交互界面，硬科幻写实风格',
        promptEn: 'science fiction concept art, futuristic technology, holographic displays, sleek advanced civilization design, clean sci-fi aesthetic, space age materials, glowing interfaces, hard sci-fi realism',
        color: 'linear-gradient(135deg,#0a0a2e,#00d4ff)', thumb: '/style-thumbs/sci-fi.jpg' },
      { label: '赛博朋克', value: 'cyberpunk',
        prompt:   '赛博朋克美学，霓虹浸润雨后街道，反乌托邦巨型都市，高科技低生活世界，发光广告牌林立，漆黑雨夜氛围，霓虹粉紫与电光蓝，银翼杀手黑色电影气质',
        promptEn: 'cyberpunk aesthetic, neon-soaked rain-slicked streets, dystopian megacity, high tech low life, glowing advertising billboards, dark wet night, neon pink magenta and electric blue, blade runner noir atmosphere',
        color: 'linear-gradient(135deg,#0d0221,#ff00ff)', thumb: '/style-thumbs/cyberpunk.jpg' },
      { label: '蒸汽朋克', value: 'steampunk',
        prompt:   '蒸汽朋克美学，维多利亚时代工业幻想，光亮黄铜齿轮与铜管构件，蒸汽驱动机械装置，棕褐色暖调，精巧机械装置，护目镜与礼帽造型，华丽钟表机芯细节',
        promptEn: 'steampunk aesthetic, Victorian era industrial fantasy, polished brass gears and copper cogs, steam powered machinery, sepia warm tones, elaborate mechanical contraptions, goggles and top hats, ornate clockwork',
        color: 'linear-gradient(135deg,#3d2b1f,#c87941)', thumb: '/style-thumbs/steampunk.jpg' },
      { label: '末世废土', value: 'post-apocalyptic',
        prompt:   '末世废土荒漠，文明崩塌遗迹，灰暗低饱和色调，生存末日氛围，腐朽建筑与废墟，尘埃与碎石漫天，强烈戏剧光照，疯狂麦克斯美学',
        promptEn: 'post-apocalyptic wasteland, ruined crumbling civilization, harsh desaturated color palette, survival atmosphere, decayed architecture, dust and debris, harsh dramatic light, Mad Max aesthetic',
        color: 'linear-gradient(135deg,#3d3117,#8b7355)', thumb: '/style-thumbs/post-apoc.jpg' },
    ]
  },
  {
    label: '数字 / 现代',
    options: [
      { label: '3D 渲染', value: '3d render',
        prompt:   '三维CGI渲染，光线追踪全局光照，次表面散射写实质感，HDRI工作室照明，高精度多边形模型，物理渲染流程，Octane或Redshift级别品质，产品级可视化精度',
        promptEn: '3D CGI render, ray tracing global illumination, photorealistic subsurface scattering, studio HDRI lighting, high polygon model, physically based rendering, Octane or Redshift quality, product visualization',
        color: 'linear-gradient(135deg,#1a1a2e,#4facfe)', thumb: '/style-thumbs/3d-render.jpg' },
      { label: '像素风',  value: 'pixel art',
        prompt:   '像素艺术风格，16位复古游戏美学，有限色板，清晰硬边像素颗粒，精灵图艺术质感，经典日式RPG视觉风格，等距或横版游戏画面',
        promptEn: 'pixel art, 16-bit retro game aesthetic, limited color palette, crisp hard pixels, sprite art style, classic JRPG visual, isometric or side-scroll game art',
        color: 'linear-gradient(135deg,#6272a4,#50fa7b)', thumb: '/style-thumbs/pixel-art.jpg' },
      { label: '低多边形', value: 'low poly',
        prompt:   '低多边形几何艺术，平面三角形切面，极简多边形数量，干净彩色切面组合，现代几何美学，三维折纸风格，抽象数字艺术感',
        promptEn: 'low poly geometric art, flat triangular faceted surfaces, minimal polygon count, clean colorful facets, modern geometric aesthetic, 3D origami style, abstract digital art',
        color: 'linear-gradient(135deg,#2193b0,#6dd5ed)', thumb: '/style-thumbs/low-poly.jpg' },
      { label: '极简',    value: 'minimalist',
        prompt:   '极简主义设计美学，干净无杂乱构图，大量留白呼吸感，简洁几何形态，有限单色色系，包豪斯现代主义，优雅克制的简约美感',
        promptEn: 'minimalist design, clean uncluttered composition, generous negative space, simple geometric forms, limited monochromatic palette, modern Bauhaus aesthetic, sophisticated elegant simplicity',
        color: 'linear-gradient(135deg,#e0e0e0,#bdbdbd)', thumb: '/style-thumbs/minimalist.jpg' },
      { label: '唯美梦幻', value: 'dreamy',
        prompt:   '唯美梦幻美学，奶油色柔虚背景，粉彩柔和色调，空灵发光氛围，浪漫柔光打亮，细腻雾气与光晕，童话魔法质感，软焦梦境感',
        promptEn: 'dreamy aesthetic, creamy soft bokeh background, pastel color palette, ethereal glowing atmosphere, romantic soft lighting, delicate haze and glow, fairy tale magical quality, soft focus dreamy',
        color: 'linear-gradient(135deg,#ffecd2,#fcb69f)', thumb: '/style-thumbs/dreamy.jpg' },
    ]
  },
]

/**
 * 根据 value 查找风格选项对象
 * @param {string} val
 * @returns {object|null}
 */
export function findStyleOption(val) {
  for (const group of generationStyleOptions) {
    const found = group.options.find(o => o.value === val)
    if (found) return found
  }
  return null
}

/**
 * 获取传给图像/视频 AI 用的英文 prompt（效果最好）
 * @param {string} val - 风格 value
 * @returns {string|undefined}
 */
export function getStylePromptEn(val) {
  const v = (val || '').toString().trim()
  if (!v) return undefined
  // 无第二参数时无法拿到用户描述；勿把短标识 custom 当提示词
  if (v === CUSTOM_STYLE_VALUE) return undefined
  const opt = findStyleOption(v)
  if (opt) return opt.promptEn || opt.prompt || v
  return v
}

/**
 * 获取中文风格描述（用于界面展示或中文场景提示词拼接）
 * @param {string} val - 风格 value
 * @returns {string|undefined}
 */
export function getStylePromptZh(val) {
  const v = (val || '').toString().trim()
  if (!v) return undefined
  if (v === CUSTOM_STYLE_VALUE) return undefined
  const opt = findStyleOption(v)
  if (opt) return opt.prompt || opt.promptEn || v
  return v
}

/**
 * 保存剧集 metadata 时用：与后端约定字段 style_prompt_zh / style_prompt_en。
 * 未选风格时返回空串，写入后可覆盖旧 metadata 中的画风字段。
 * 自定义画风（custom）时第二参数为用户描述，zh/en 写入同一文本。
 */
export function stylePromptMetadataForSave(styleValue, customPrompt) {
  const v = (styleValue || '').toString().trim()
  if (!v) return { style_prompt_zh: '', style_prompt_en: '' }
  if (v === CUSTOM_STYLE_VALUE) {
    const text = (customPrompt != null ? String(customPrompt) : '').trim()
    return { style_prompt_zh: text, style_prompt_en: text }
  }
  const opt = findStyleOption(v)
  if (!opt) return { style_prompt_zh: v, style_prompt_en: v }
  return {
    style_prompt_zh: opt.prompt || opt.promptEn || '',
    style_prompt_en: opt.promptEn || opt.prompt || '',
  }
}

/** 列表/触发器展示用中文名 */
export function getStyleLabel(val) {
  const v = (val || '').toString().trim()
  if (!v) return ''
  if (v === CUSTOM_STYLE_VALUE) return '自定义'
  const opt = findStyleOption(v)
  return opt?.label || v
}

/**
 * 旧项目只有 dramas.style（value）而 metadata 里没有画风长文案时，自动 saveOutline 合并写入，
 * 便于后端 mergeCfgStyleWithDrama 能拿到 default_style_en。不覆盖已有 style_prompt_en。
 * @returns {Promise<object>} 更新后的剧集对象（失败或未改则原样返回 drama）
 */
export async function backfillDramaStylePromptMetadataIfNeeded(dramaAPI, dramaId, drama) {
  if (!drama || dramaId == null) return drama
  const styleVal = (drama.style || '').toString().trim()
  if (!styleVal) return drama
  if (styleVal === CUSTOM_STYLE_VALUE) return drama
  const hasEn = (drama.metadata?.style_prompt_en || '').toString().trim()
  if (hasEn) return drama
  const patch = stylePromptMetadataForSave(styleVal)
  if (!(patch.style_prompt_en || '').toString().trim()) return drama
  try {
    await dramaAPI.saveOutline(dramaId, { metadata: patch })
    return await dramaAPI.get(dramaId)
  } catch (_) {
    return drama
  }
}
