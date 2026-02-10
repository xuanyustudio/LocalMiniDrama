<template>
  <div class="film-create">
    <!-- 顶部 -->
    <header class="header">
      <div class="header-inner">
        <h1 class="logo" @click="goList">Filmaction.ai</h1>
        <span class="page-title">{{ dramaId ? (store.drama?.title || '项目') : '新建故事' }}</span>
        <el-button class="btn-new" @click="goList">
          <el-icon><Plus /></el-icon>
          新建项目
        </el-button>
      </div>
    </header>

    <main class="main">
      <!-- 角色/道具/场景上传图片用，单例放在外层避免 v-for 导致 ref 为数组 -->
      <input
        ref="resourceImageFileInput"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style="display: none"
        @change="onResourceImageFileChange"
      />
      <!-- 1. 故事生成 -->
      <section class="section card">
        <h2 class="section-title">故事生成</h2>
        <p class="section-desc">输入一段话，AI 帮你生成故事剧本</p>
        <el-input
          v-model="storyInput"
          type="textarea"
          :rows="4"
          placeholder="例如：一个少女在森林里遇见会说话的狐狸，一起寻找失落的宝石..."
          class="story-textarea"
        />
        <div class="row gap">
          <el-select v-model="storyStyle" placeholder="风格" clearable style="width: 140px">
            <el-option label="现代" value="modern" />
            <el-option label="古风" value="ancient" />
            <el-option label="奇幻" value="fantasy" />
            <el-option label="日常" value="daily" />
          </el-select>
          <el-select v-model="storyType" placeholder="类型" clearable style="width: 140px">
            <el-option label="剧情" value="drama" />
            <el-option label="喜剧" value="comedy" />
            <el-option label="冒险" value="adventure" />
          </el-select>
          <el-button type="primary" :loading="storyGenerating" @click="onGenerateStory">AI 生成</el-button>
        </div>
      </section>

      <!-- 2. 剧本生成 -->
      <section class="section card">
        <h2 class="section-title">剧本生成</h2>
        <div class="row gap" style="margin-bottom: 12px; flex-wrap: wrap;">
          <el-select
            v-model="selectedEpisodeId"
            placeholder="选择第几集"
            clearable
            style="width: 140px"
            :disabled="!dramaId"
            @change="onEpisodeSelect"
          >
            <el-option
              v-for="ep in (store.drama?.episodes || [])"
              :key="ep.id"
              :label="ep.title || '第' + (ep.episode_number || 0) + '集'"
              :value="ep.id"
            />
          </el-select>
          <el-input v-model="scriptTitle" placeholder="第几集" style="width: 160px" />
          <el-select v-model="scriptLanguage" placeholder="语言" clearable style="width: 120px">
            <el-option label="中文" value="zh" />
            <el-option label="英文" value="en" />
          </el-select>
          <el-select v-model="scriptStoryboardStyle" placeholder="分镜风格" clearable style="width: 140px">
            <el-option label="写实" value="realistic" />
            <el-option label="动漫" value="anime" />
          </el-select>
          <el-button
            type="primary"
            :loading="scriptGenerating"
            :disabled="!!dramaId && (store.drama?.episodes?.length > 0) && !currentEpisodeId"
            @click="onGenerateScript"
          >
            保存剧本
          </el-button>
          <el-button v-if="dramaId" @click="onAddEpisode">添加一集</el-button>
        </div>
        <el-input
          v-model="scriptContent"
          type="textarea"
          :rows="8"
          placeholder="剧本内容将显示在这里，可编辑..."
          class="story-textarea"
        />
      </section>

      <!-- 资源管理：角色 / 道具 / 场景 -->
      <section class="section card resource-panel">
        <div class="collapse-header" @click="resourcePanelCollapsed = !resourcePanelCollapsed">
          <h2 class="section-title">资源管理</h2>
          <el-icon class="collapse-icon"><ArrowUp v-if="!resourcePanelCollapsed" /><ArrowDown v-else /></el-icon>
        </div>
        <div v-show="!resourcePanelCollapsed" class="resource-panel-body">
          <!-- 角色生成 -->
          <div class="resource-block card">
            <div class="collapse-header resource-block-header" @click="charactersBlockCollapsed = !charactersBlockCollapsed">
              <h3 class="resource-block-title">角色生成</h3>
              <el-icon class="collapse-icon"><ArrowUp v-if="!charactersBlockCollapsed" /><ArrowDown v-else /></el-icon>
            </div>
            <div v-show="!charactersBlockCollapsed" class="resource-block-body">
              <div class="asset-actions">
                <el-button type="primary" size="small" :loading="charactersGenerating" :disabled="!dramaId" @click="onGenerateCharacters">
                  AI 生成角色
                </el-button>
              </div>
              <div class="asset-list asset-list-two">
                <div v-for="char in characters" :key="char.id" class="asset-item asset-item-left-right">
                  <div class="asset-info">
                    <div class="asset-name">{{ char.name }}</div>
                    <div class="asset-desc-full">{{ char.description || char.appearance || '暂无描述' }}</div>
                    <div class="asset-btns">
                      <el-button size="small" :loading="generatingCharId === char.id" @click="onGenerateCharacterImage(char)">
                        AI 生成
                      </el-button>
                      <el-button size="small" @click="editCharacter(char)">编辑</el-button>
                      <el-button size="small" :loading="uploadingResourceId === 'char-' + char.id" @click="onUploadResourceClick('character', char.id)">
                        上传
                      </el-button>
                      <el-button size="small" type="danger" plain @click="onDeleteCharacter(char)">删除</el-button>
                    </div>
                  </div>
                  <div
                    class="asset-cover"
                    :class="{ 'asset-cover--clickable': hasAssetImage(char) }"
                    role="button"
                    tabindex="0"
                    @click="hasAssetImage(char) && openImagePreview(assetImageUrl(char))"
                  >
                    <img v-if="hasAssetImage(char)" :src="assetImageUrl(char)" class="cover-img" alt="" />
                    <div v-else class="cover-placeholder">暂无图</div>
                  </div>
                </div>
                <div v-if="characters.length === 0" class="empty-tip">暂无角色，请先「AI 生成角色」或在上一步保存剧本后提取</div>
              </div>
            </div>
          </div>

          <!-- 道具生成 -->
          <div class="resource-block card">
            <div class="collapse-header resource-block-header" @click="propsBlockCollapsed = !propsBlockCollapsed">
              <h3 class="resource-block-title">道具生成</h3>
              <el-icon class="collapse-icon"><ArrowUp v-if="!propsBlockCollapsed" /><ArrowDown v-else /></el-icon>
            </div>
            <div v-show="!propsBlockCollapsed" class="resource-block-body">
              <div class="asset-actions">
                <el-button size="small" :disabled="!currentEpisodeId" @click="onExtractProps">从剧本提取道具</el-button>
                <el-button type="primary" size="small" :disabled="!dramaId" @click="showAddProp = true">添加道具</el-button>
              </div>
              <div class="asset-list asset-list-two">
                <div v-for="prop in props" :key="prop.id" class="asset-item asset-item-left-right">
                  <div class="asset-info">
                    <div class="asset-name">{{ prop.name }}</div>
                    <div class="asset-desc-full">{{ prop.description || prop.prompt || '暂无描述' }}</div>
                    <div class="asset-btns">
                      <el-button size="small" :loading="generatingPropId === prop.id" @click="onGeneratePropImage(prop)">
                        AI 生成
                      </el-button>
                      <el-button size="small" @click="editProp(prop)">编辑</el-button>
                      <el-button size="small" :loading="uploadingResourceId === 'prop-' + prop.id" @click="onUploadResourceClick('prop', prop.id)">
                        上传
                      </el-button>
                      <el-button size="small" type="danger" plain @click="onDeleteProp(prop)">删除</el-button>
                    </div>
                  </div>
                  <div
                    class="asset-cover"
                    :class="{ 'asset-cover--clickable': hasAssetImage(prop) }"
                    role="button"
                    tabindex="0"
                    @click="hasAssetImage(prop) && openImagePreview(assetImageUrl(prop))"
                  >
                    <img v-if="hasAssetImage(prop)" :src="assetImageUrl(prop)" class="cover-img" alt="" />
                    <div v-else class="cover-placeholder">暂无图</div>
                  </div>
                </div>
                <div v-if="props.length === 0" class="empty-tip">暂无道具，可从剧本提取或添加</div>
              </div>
            </div>
          </div>

          <!-- 场景生成 -->
          <div class="resource-block card">
            <div class="collapse-header resource-block-header" @click="scenesBlockCollapsed = !scenesBlockCollapsed">
              <h3 class="resource-block-title">场景生成</h3>
              <el-icon class="collapse-icon"><ArrowUp v-if="!scenesBlockCollapsed" /><ArrowDown v-else /></el-icon>
            </div>
            <div v-show="!scenesBlockCollapsed" class="resource-block-body">
              <div class="asset-actions">
                <el-button type="primary" size="small" :loading="scenesExtracting" :disabled="!currentEpisodeId" @click="onExtractScenes">
                  从剧本提取场景
                </el-button>
              </div>
              <div class="asset-list asset-list-two">
                <div v-for="scene in scenes" :key="scene.id" class="asset-item asset-item-left-right">
                  <div class="asset-info">
                    <div class="asset-name">{{ scene.location }}</div>
                    <div class="asset-desc-full">{{ scene.description || scene.prompt || scene.time || '暂无描述' }}</div>
                    <div class="asset-btns">
                      <el-button size="small" :loading="generatingSceneId === scene.id" @click="onGenerateSceneImage(scene)">
                        AI 生成
                      </el-button>
                      <el-button size="small" @click="editScene(scene)">编辑</el-button>
                      <el-button size="small" :loading="uploadingResourceId === 'scene-' + scene.id" @click="onUploadResourceClick('scene', scene.id)">
                        上传
                      </el-button>
                      <el-button size="small" type="danger" plain @click="onDeleteScene(scene)">删除</el-button>
                    </div>
                  </div>
                  <div
                    class="asset-cover"
                    :class="{ 'asset-cover--clickable': hasAssetImage(scene) }"
                    role="button"
                    tabindex="0"
                    @click="hasAssetImage(scene) && openImagePreview(assetImageUrl(scene))"
                  >
                    <img v-if="hasAssetImage(scene)" :src="assetImageUrl(scene)" class="cover-img" alt="" />
                    <div v-else class="cover-placeholder">暂无图</div>
                  </div>
                </div>
                <div v-if="scenes.length === 0" class="empty-tip">暂无场景，请从剧本提取</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 6. 分镜生成 -->
      <section class="section card">
        <h2 class="section-title">分镜生成</h2>
        <div class="asset-actions">
          <el-button type="primary" :loading="storyboardGenerating" :disabled="!currentEpisodeId" @click="onGenerateStoryboard">
            生成分镜
          </el-button>
        </div>
        <template v-if="storyboards.length > 0">
          <div v-for="(sb, i) in storyboards" :key="sb.id" class="storyboard-row">
            <div class="sb-num-badge">{{ i + 1 }}</div>
            <!-- 左：分镜脚本 -->
            <div class="sb-panel sb-script">
              <div class="sb-panel-title">
                <el-icon><Document /></el-icon>
                <span>分镜脚本</span>
                <span v-if="sb.title" class="sb-panel-title-name">{{ sb.title }}</span>
              </div>
              <div class="sb-script-row sb-script-selects">
                <el-select
                  :model-value="getSbCharacterIds(sb.id)"
                  placeholder="选择角色"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  size="small"
                  class="sb-select"
                  @update:model-value="(v) => setSbCharacterIds(sb.id, v)"
                >
                  <el-option
                    v-for="c in (characters || [])"
                    :key="String(c.id)"
                    :label="c.name || '未命名'"
                    :value="c.id"
                  />
                  <template v-if="!(characters || []).length" #empty>
                    <span class="sb-select-empty">请先在「角色生成」中添加角色</span>
                  </template>
                </el-select>
                <el-select
                  v-model="sbSceneId[sb.id]"
                  placeholder="选择场景"
                  clearable
                  size="small"
                  class="sb-select"
                  @change="() => onStoryboardSceneChange(sb.id)"
                >
                  <el-option
                    v-for="s in (scenes || [])"
                    :key="s.id"
                    :label="s.location"
                    :value="s.id"
                  />
                </el-select>
                <el-select
                  :model-value="getSbPropIds(sb.id)"
                  placeholder="选择物品"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  size="small"
                  class="sb-select"
                  @update:model-value="(v) => setSbPropIds(sb.id, v)"
                >
                  <el-option
                    v-for="p in (props || [])"
                    :key="String(p.id)"
                    :label="p.name || '未命名'"
                    :value="p.id"
                  />
                  <template v-if="!(props || []).length" #empty>
                    <span class="sb-select-empty">请先在「道具生成」中添加物品</span>
                  </template>
                </el-select>
              </div>
              <!-- 当前选中：场景 / 角色 / 物品缩略图 -->
              <div v-if="getSbSelectedScene(sb.id) || getSbSelectedCharacters(sb.id).length || getSbSelectedProps(sb.id).length" class="sb-selected-thumbs">
                <div v-if="getSbSelectedScene(sb.id)" class="sb-thumb-row">
                  <span class="sb-thumb-label">场景</span>
                  <div class="sb-thumb-list">
                    <div
                      v-for="s in [getSbSelectedScene(sb.id)]"
                      :key="s.id"
                      class="sb-thumb-item sb-thumb-scene"
                      :class="{ 'sb-thumb-clickable': hasAssetImage(s) }"
                      :title="s.location"
                      role="button"
                      @click="hasAssetImage(s) && openImagePreview(assetImageUrl(s))"
                    >
                      <img v-if="hasAssetImage(s)" :src="assetImageUrl(s)" alt="" />
                      <span v-else class="sb-thumb-placeholder">{{ (s.location || '')[0] }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="getSbSelectedCharacters(sb.id).length" class="sb-thumb-row">
                  <span class="sb-thumb-label">角色</span>
                  <div class="sb-thumb-list">
                    <div
                      v-for="c in getSbSelectedCharacters(sb.id)"
                      :key="c.id"
                      class="sb-thumb-item sb-thumb-avatar"
                      :class="{ 'sb-thumb-clickable': hasAssetImage(c) }"
                      :title="c.name"
                      role="button"
                      @click="hasAssetImage(c) && openImagePreview(assetImageUrl(c))"
                    >
                      <img v-if="hasAssetImage(c)" :src="assetImageUrl(c)" alt="" />
                      <span v-else class="sb-thumb-placeholder">{{ (c.name || '')[0] }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="getSbSelectedProps(sb.id).length" class="sb-thumb-row">
                  <span class="sb-thumb-label">物品</span>
                  <div class="sb-thumb-list">
                    <div
                      v-for="p in getSbSelectedProps(sb.id)"
                      :key="p.id"
                      class="sb-thumb-item sb-thumb-prop"
                      :class="{ 'sb-thumb-clickable': hasAssetImage(p) }"
                      :title="p.name"
                      role="button"
                      @click="hasAssetImage(p) && openImagePreview(assetImageUrl(p))"
                    >
                      <img v-if="hasAssetImage(p)" :src="assetImageUrl(p)" alt="" />
                      <span v-else class="sb-thumb-placeholder">{{ (p.name || '')[0] }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="sb-script-label">
                <el-icon><Grid /></el-icon>
                <span>构图参考</span>
                <el-icon class="sb-upload-icon"><Upload /></el-icon>
              </div>
              <div class="sb-narration">
                <span class="sb-narration-type">旁白</span>
                <el-button size="small" text type="primary">选择声音</el-button>
              </div>
              <el-input
                v-model="sbDialogue[sb.id]"
                type="textarea"
                :rows="3"
                placeholder="输入旁白内容, 描述场景、情感或角色对话..."
                class="sb-dialogue-input"
                @input="() => updateStoryboardDialogue(sb.id)"
              />
              <div class="sb-meta">
                <span>字数: {{ (sbDialogue[sb.id] || '').length }}</span>
                <span>预计时长: {{ sb.duration || 0 }}s / 3s</span>
              </div>
            </div>
            <!-- 中：分镜图（优先用 /images?storyboard_id 拉取到的图，否则用 composed_image） -->
            <div class="sb-panel sb-image">
              <div class="sb-panel-title">
                <el-icon><Picture /></el-icon>
                <span>分镜图</span>
              </div>
              <input
                ref="sbImageFileInput"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                class="sb-image-file-input"
                @change="onSbImageFileChange"
              />
              <div class="sb-image-area">
                <template v-if="getSbImage(sb.id)">
                  <img
                    :src="assetImageUrl(getSbImage(sb.id))"
                    class="sb-generated-img"
                    alt=""
                    @click="openImagePreview(assetImageUrl(getSbImage(sb.id)))"
                  />
                </template>
                <template v-else-if="sb.composed_image || sb.image_url">
                  <img
                    :src="imageUrl(sb.composed_image || sb.image_url)"
                    class="sb-generated-img"
                    alt=""
                    @click="openImagePreview(imageUrl(sb.composed_image || sb.image_url))"
                  />
                </template>
                <template v-else>
                  <el-button type="primary" size="small" class="sb-gen-btn" :loading="generatingSbImageId === sb.id" @click="onGenerateSbImage(sb)">
                    <el-icon><MagicStick /></el-icon>
                    生成分镜
                  </el-button>
                  <el-button size="small" :loading="uploadingSbImageId === sb.id" @click="onUploadSbImageClick(sb)">上传</el-button>
                </template>
              </div>
              <div v-if="hasSbImage(sb)" class="sb-image-actions">
                <el-button size="small" :loading="generatingSbImageId === sb.id" @click="onGenerateSbImage(sb)">重新生成</el-button>
                <el-button size="small" :loading="uploadingSbImageId === sb.id" @click="onUploadSbImageClick(sb)">上传</el-button>
              </div>
            </div>
            <!-- 右：分镜视频（由 /videos?storyboard_id 拉取） -->
            <div class="sb-panel sb-video">
              <div class="sb-panel-title">
                <el-icon><VideoCamera /></el-icon>
                <span>分镜视频</span>
              </div>
              <div v-if="getSbVideo(sb.id)" class="sb-video-area">
                <video
                  v-if="assetVideoUrl(getSbVideo(sb.id))"
                  :src="assetVideoUrl(getSbVideo(sb.id))"
                  controls
                  class="sb-video-player"
                  preload="metadata"
                />
              </div>
              <template v-else>
                <div class="sb-video-prompt-label">
                  <span class="sb-dot"></span>
                  <span>视频提示词</span>
                  <el-select v-model="sbShotType[sb.id]" placeholder="固定镜头" size="small" class="sb-camera-select">
                    <el-option label="固定镜头" value="fixed" />
                    <el-option label="推镜头" value="push" />
                    <el-option label="拉镜头" value="pull" />
                  </el-select>
                </div>
                <div class="sb-video-prompt-text">{{ sb.video_prompt || '暂无视频提示词' }}</div>
                <el-button
                  type="primary"
                  size="small"
                  class="sb-generate-video-btn"
                  :loading="generatingSbVideoId === sb.id"
                  :disabled="!sb.video_prompt"
                  @click="onGenerateSbVideo(sb)"
                >
                  生成视频
                </el-button>
              </template>
            </div>
          </div>
        </template>
        <div v-else class="empty-tip">请先生成分镜</div>
      </section>

      <!-- 7. 视频配置 + AI 模型配置 -->
      <section class="section card">
        <h2 class="section-title">视频配置</h2>
        <div class="config-grid">
          <el-form-item label="分辨率">
            <el-select v-model="videoResolution" style="width: 160px">
              <el-option label="1920x1080" value="1920x1080" />
              <el-option label="1280x720" value="1280x720" />
            </el-select>
          </el-form-item>
          <el-form-item label="配乐">
            <el-select v-model="videoMusic" placeholder="无" clearable style="width: 160px">
              <el-option label="无" value="" />
            </el-select>
          </el-form-item>
          <el-form-item label="音效">
            <el-select v-model="videoSfx" placeholder="无" clearable style="width: 160px">
              <el-option label="无" value="" />
            </el-select>
          </el-form-item>
          <el-form-item label="画质">
            <el-select v-model="videoQuality" style="width: 120px">
              <el-option label="高" value="high" />
              <el-option label="中" value="medium" />
            </el-select>
          </el-form-item>
          <el-form-item label="字幕">
            <el-switch v-model="videoSubtitle" />
          </el-form-item>
          <el-form-item label="水印">
            <el-switch v-model="videoWatermark" />
          </el-form-item>
        </div>
        <h3 class="sub-title">AI 模型配置</h3>
        <div class="config-grid">
          <el-form-item label="图片生成模型">
            <el-select v-model="selectedImageModel" placeholder="请选择" style="width: 220px" @focus="loadImageModels">
              <el-option v-for="m in imageModelOptions" :key="m.value" :label="m.label" :value="m.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="视频生成模型">
            <el-select v-model="selectedVideoModel" placeholder="请选择" style="width: 220px" @focus="loadVideoModels">
              <el-option v-for="m in videoModelOptions" :key="m.value" :label="m.label" :value="m.value" />
            </el-select>
          </el-form-item>
        </div>
      </section>

      <!-- 8. 生成视频 -->
      <section class="section card">
        <h2 class="section-title">生成视频</h2>
        <el-button type="primary" size="large" :loading="videoStatus === 'generating'" :disabled="!currentEpisodeId || storyboards.length === 0" @click="onGenerateVideo">
          生成视频
        </el-button>
        <div v-if="videoStatus === 'generating'" class="video-progress">
          <el-progress :percentage="videoProgress" :status="videoProgress >= 100 ? 'success' : undefined" />
          <p>视频生成中...</p>
        </div>
        <div v-if="videoStatus === 'done'" class="video-done">
          <el-alert type="success" title="视频生成完成" show-icon />
        </div>
        <div v-else-if="videoStatus === 'error'" class="video-error">
          <el-alert type="error" :title="videoErrorMsg" show-icon />
        </div>
      </section>
    </main>

    <!-- 添加道具弹窗 -->
    <el-dialog v-model="showAddProp" title="添加道具" width="400px" @close="addPropForm = { name: '', description: '', prompt: '' }">
      <el-form label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="addPropForm.name" placeholder="道具名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="addPropForm.description" type="textarea" :rows="2" placeholder="描述" />
        </el-form-item>
        <el-form-item label="图生提示词">
          <el-input v-model="addPropForm.prompt" type="textarea" :rows="2" placeholder="用于 AI 生成图片的提示词" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddProp = false">取消</el-button>
        <el-button type="primary" :disabled="!addPropForm.name.trim()" @click="submitAddProp">确定</el-button>
      </template>
    </el-dialog>

    <!-- 编辑角色弹窗 -->
    <el-dialog v-model="showEditCharacter" title="编辑角色" width="480px" @close="showEditCharacter = false">
      <el-form v-if="editCharacterForm" label-width="90px">
        <el-form-item label="名称" required>
          <el-input v-model="editCharacterForm.name" placeholder="角色名称" />
        </el-form-item>
        <el-form-item label="身份/定位">
          <el-input v-model="editCharacterForm.role" placeholder="如：女主角" />
        </el-form-item>
        <el-form-item label="外貌描述">
          <el-input v-model="editCharacterForm.appearance" type="textarea" :rows="2" placeholder="用于 AI 生成形象的描述" />
        </el-form-item>
        <el-form-item label="性格">
          <el-input v-model="editCharacterForm.personality" type="textarea" :rows="2" placeholder="性格特点" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="editCharacterForm.description" type="textarea" :rows="2" placeholder="角色简介" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditCharacter = false">取消</el-button>
        <el-button type="primary" :loading="editCharacterSaving" :disabled="!editCharacterForm?.name?.trim()" @click="submitEditCharacter">保存</el-button>
      </template>
    </el-dialog>

    <!-- 编辑道具弹窗 -->
    <el-dialog v-model="showEditProp" title="编辑道具" width="480px" @close="showEditProp = false">
      <el-form v-if="editPropForm" label-width="90px">
        <el-form-item label="名称" required>
          <el-input v-model="editPropForm.name" placeholder="道具名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-input v-model="editPropForm.type" placeholder="如：物品、建筑" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editPropForm.description" type="textarea" :rows="2" placeholder="描述" />
        </el-form-item>
        <el-form-item label="图生提示词">
          <el-input v-model="editPropForm.prompt" type="textarea" :rows="2" placeholder="用于 AI 生成图片的提示词" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditProp = false">取消</el-button>
        <el-button type="primary" :loading="editPropSaving" :disabled="!editPropForm?.name?.trim()" @click="submitEditProp">保存</el-button>
      </template>
    </el-dialog>

    <!-- 编辑场景弹窗 -->
    <el-dialog v-model="showEditScene" title="编辑场景" width="480px" @close="showEditScene = false">
      <el-form v-if="editSceneForm" label-width="90px">
        <el-form-item label="地点" required>
          <el-input v-model="editSceneForm.location" placeholder="如：森林、教室" />
        </el-form-item>
        <el-form-item label="时间">
          <el-input v-model="editSceneForm.time" placeholder="如：白天、傍晚" />
        </el-form-item>
        <el-form-item label="图生提示词">
          <el-input v-model="editSceneForm.prompt" type="textarea" :rows="3" placeholder="用于 AI 生成场景图的提示词" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditScene = false">取消</el-button>
        <el-button type="primary" :loading="editSceneSaving" :disabled="!editSceneForm?.location?.trim()" @click="submitEditScene">保存</el-button>
      </template>
    </el-dialog>

    <!-- 图片放大预览：点击遮罩或图片关闭 -->
    <Teleport to="body">
      <div
        v-if="previewImageUrl"
        class="image-preview-overlay"
        @click="closeImagePreview"
      >
        <img :src="previewImageUrl" alt="" class="image-preview-img" @click.stop="closeImagePreview" />
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowUp, ArrowDown } from '@element-plus/icons-vue'
import { useFilmStore } from '@/stores/film'
import { dramaAPI } from '@/api/drama'
import { generationAPI } from '@/api/generation'
import { aiAPI } from '@/api/ai'
import { characterAPI } from '@/api/characters'
import { propAPI } from '@/api/props'
import { sceneAPI } from '@/api/scenes'
import { taskAPI } from '@/api/task'
import { imagesAPI } from '@/api/images'
import { videosAPI } from '@/api/videos'
import { uploadAPI } from '@/api/upload'

const route = useRoute()
const router = useRouter()
const store = useFilmStore()
const { videoResolution: storeVideoResolution } = storeToRefs(store)

function goList() {
  router.push('/')
}

const storyInput = ref('')
const storyStyle = ref('')
const storyType = ref('')
const storyGenerating = ref(false)
const scriptTitle = ref('')
const selectedEpisodeId = ref(null)
/** 保存剧本后用于恢复选中集（后端重插后 id 会变，用 episode_number 匹配） */
const savedCurrentEpisodeNumber = ref(1)
const scriptLanguage = ref('zh')
const scriptStoryboardStyle = ref('')
const scriptGenerating = ref(false)
const scriptContent = computed({
  get: () => store.scriptContent,
  set: (v) => store.setScriptContent(v)
})
const selectedImageModel = computed({
  get: () => store.selectedImageModel,
  set: (v) => store.setSelectedImageModel(v)
})
const selectedVideoModel = computed({
  get: () => store.selectedVideoModel,
  set: (v) => store.setSelectedVideoModel(v)
})
const videoResolution = storeVideoResolution
const videoMusic = ref('')
const videoSfx = ref('')
const videoQuality = ref('high')
const videoSubtitle = ref(true)
const videoWatermark = ref(false)

const dramaId = computed(() => store.dramaId)
const characters = computed(() => store.characters)
const scenes = computed(() => store.scenes)
const props = computed(() => store.props)
const storyboards = computed(() => store.storyboards)
const currentEpisode = computed(() => store.currentEpisode)
const currentEpisodeId = computed(() => store.currentEpisode?.id ?? null)
const videoProgress = computed(() => store.videoProgress)
const videoStatus = computed(() => store.videoStatus)

const charactersGenerating = ref(false)
const generatingCharId = ref(null)
const generatingPropId = ref(null)
const generatingSceneId = ref(null)
const scenesExtracting = ref(false)
const storyboardGenerating = ref(false)
const videoErrorMsg = ref('')
const imageModelOptions = ref([])
const videoModelOptions = ref([])
const showAddProp = ref(false)
const addPropForm = ref({ name: '', description: '', prompt: '' })

const showEditCharacter = ref(false)
const editCharacterForm = ref(null)
const editCharacterSaving = ref(false)

const showEditProp = ref(false)
const editPropForm = ref(null)
const editPropSaving = ref(false)

const showEditScene = ref(false)
const editSceneForm = ref(null)
const editSceneSaving = ref(false)

// 资源管理大面板及子区块折叠状态
const resourcePanelCollapsed = ref(false)
const charactersBlockCollapsed = ref(false)
const propsBlockCollapsed = ref(false)
const scenesBlockCollapsed = ref(false)

// 分镜行内编辑状态（按 storyboard id 存储）
const sbCharacterIds = ref({})  // sbId -> number[] 多选角色
const sbPropIds = ref({})       // sbId -> number[] 多选物品
const sbSceneId = ref({})
const sbDialogue = ref({})
const sbShotType = ref({})
// 分镜图片/视频列表（由 /images?storyboard_id=xx 和 /videos?storyboard_id=xx 拉取）
const sbImages = ref({})
const sbVideos = ref({})
const generatingSbImageId = ref(null)
const generatingSbVideoId = ref(null)
const uploadingSbImageId = ref(null)
const sbImageFileInput = ref(null)
const sbImageUploadForId = ref(null)
// 角色/道具/场景 上传图片
const resourceImageFileInput = ref(null)
const resourceUploadType = ref(null) // 'character' | 'prop' | 'scene'
const resourceUploadId = ref(null)
const uploadingResourceId = ref(null) // 'char-1' | 'prop-2' | 'scene-3'

const baseUrl = ref('')
const previewImageUrl = ref(null)
function imageUrl(url) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  const base = (baseUrl.value || '').replace(/\/$/, '')
  return base ? base + '/' + url.replace(/^\//, '') : url
}
/** 优先使用本地地址，避免远程图失效。item 为 { image_url, local_path } 或字符串 url */
function assetImageUrl(item) {
  if (!item) return ''
  if (typeof item === 'string') return imageUrl(item)
  const localPath = item.local_path && String(item.local_path).trim()
  if (localPath) {
    const p = localPath.replace(/^\//, '')
    return '/static/' + p
  }
  if (item.image_url) return imageUrl(item.image_url)
  return ''
}
function hasAssetImage(item) {
  if (!item) return false
  return !!(item.image_url || item.local_path)
}
function openImagePreview(url) {
  previewImageUrl.value = url
}
function closeImagePreview() {
  previewImageUrl.value = null
}
/** 视频地址：优先 local_path（/static/），否则 video_url */
function assetVideoUrl(item) {
  if (!item) return ''
  const localPath = item.local_path && String(item.local_path).trim()
  if (localPath) return '/static/' + localPath.replace(/^\//, '')
  if (item.video_url) return imageUrl(item.video_url)
  return ''
}
/** 该分镜是否有图（接口拉取的或 composed_image） */
function hasSbImage(sb) {
  return !!(getSbImage(sb.id) || (sb && (sb.composed_image || sb.image_url)))
}
/** 取该分镜下第一条已完成的图片记录（供展示） */
function getSbImage(storyboardId) {
  const list = sbImages.value[storyboardId]
  if (!Array.isArray(list)) return null
  const completed = list.find((i) => i.status === 'completed' && (i.image_url || i.local_path))
  return completed || null
}
/** 取该分镜下第一条已完成的视频记录（供展示） */
function getSbVideo(storyboardId) {
  const list = sbVideos.value[storyboardId]
  if (!Array.isArray(list)) return null
  const completed = list.find((i) => i.status === 'completed' && (i.video_url || i.local_path))
  return completed || null
}

async function loadStoryboardMedia() {
  const boards = store.storyboards || []
  if (boards.length === 0) {
    sbImages.value = {}
    sbVideos.value = {}
    return
  }
  const nextImages = { ...sbImages.value }
  const nextVideos = { ...sbVideos.value }
  await Promise.all(
    boards.map(async (sb) => {
      try {
        const [imgRes, vidRes] = await Promise.all([
          imagesAPI.list({ storyboard_id: sb.id, page: 1, page_size: 100 }),
          videosAPI.list({ storyboard_id: sb.id, page: 1, page_size: 50 })
        ])
        nextImages[sb.id] = (imgRes && imgRes.items) ? imgRes.items : []
        nextVideos[sb.id] = (vidRes && vidRes.items) ? vidRes.items : []
      } catch (_) {
        nextImages[sb.id] = []
        nextVideos[sb.id] = []
      }
    })
  )
  sbImages.value = nextImages
  sbVideos.value = nextVideos
}

async function onGenerateSbImage(sb) {
  if (!dramaId.value || !sb?.id) return
  generatingSbImageId.value = sb.id
  try {
    await imagesAPI.create({
      storyboard_id: sb.id,
      drama_id: dramaId.value,
      prompt: sb.image_prompt || sb.description || '',
      model: selectedImageModel.value || undefined
    })
    ElMessage.success('分镜图生成任务已提交')
    await pollSbImageThenRefetch(sb.id)
  } catch (e) {
    ElMessage.error(e.message || '生成失败')
  } finally {
    generatingSbImageId.value = null
  }
}

async function pollSbImageThenRefetch(storyboardId) {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    await loadStoryboardMedia()
    const list = sbImages.value[storyboardId]
    const done = list && list.some((x) => x.status === 'completed' && (x.image_url || x.local_path))
    if (done) return
  }
}

function onUploadSbImageClick(sb) {
  if (!sb?.id) return
  sbImageUploadForId.value = sb.id
  sbImageFileInput.value?.click()
}

async function onSbImageFileChange(ev) {
  const file = ev.target?.files?.[0]
  const sid = sbImageUploadForId.value
  if (!file || !sid || !dramaId.value) {
    ev.target.value = ''
    return
  }
  uploadingSbImageId.value = sid
  try {
    const res = await uploadAPI.uploadImage(file)
    const url = res?.url || res?.path
    const localPath = res?.local_path
    if (!url && !localPath) {
      ElMessage.error('上传未返回地址')
      return
    }
    await imagesAPI.upload({
      storyboard_id: sid,
      drama_id: dramaId.value,
      image_url: url || '',
      local_path: localPath || undefined
    })
    ElMessage.success('上传成功')
    await loadStoryboardMedia()
  } catch (e) {
    ElMessage.error(e.message || '上传失败')
  } finally {
    uploadingSbImageId.value = null
    sbImageUploadForId.value = null
    ev.target.value = ''
  }
}

function syncStoryboardStateFromEpisode(ep) {
  const boards = ep?.storyboards || []
  const nextCharIds = {}
  const nextPropIds = {}
  const nextScene = {}
  const nextDialogue = {}
  const nextShot = {}
  for (const sb of boards) {
    nextScene[sb.id] = sb.scene_id ?? null
    nextDialogue[sb.id] = sb.dialogue ?? ''
    nextShot[sb.id] = sb.shot_type || 'fixed'
    const charList = Array.isArray(sb.characters) ? sb.characters : (sb.characters != null ? [sb.characters] : [])
    nextCharIds[sb.id] = charList.map((c) => (typeof c === 'object' && c != null ? Number(c.id) : Number(c))).filter((n) => Number.isFinite(n))
    nextPropIds[sb.id] = Array.isArray(sb.prop_ids) ? sb.prop_ids : []
  }
  sbCharacterIds.value = nextCharIds
  sbPropIds.value = nextPropIds
  sbSceneId.value = nextScene
  sbDialogue.value = nextDialogue
  sbShotType.value = nextShot
}

function onEpisodeSelect(epId) {
  if (epId == null) {
    store.setCurrentEpisode(null)
    store.setScriptContent('')
    scriptTitle.value = ''
    syncStoryboardStateFromEpisode(null)
    return
  }
  const list = store.drama?.episodes || []
  const ep = list.find((e) => Number(e.id) === Number(epId))
  if (!ep) return
  store.setCurrentEpisode(ep)
  store.setScriptContent(ep.script_content || '')
  scriptTitle.value = ep.title || '第' + (ep.episode_number || 0) + '集'
  syncStoryboardStateFromEpisode(ep)
  loadStoryboardMedia()
}

async function loadDrama() {
  if (!store.dramaId) return
  try {
    const d = await dramaAPI.get(store.dramaId)
    store.setDrama(d)
    const list = d.episodes || []
    // 优先保持当前选中的集（按 id 在最新列表中查找），避免 AI 生成角色等操作后误切到其他集
    const currentId = selectedEpisodeId.value
    let ep = currentId != null ? list.find((e) => Number(e.id) === Number(currentId)) : null
    if (!ep) {
      const wantNum = savedCurrentEpisodeNumber.value
      ep = list.find((e) => Number(e.episode_number) === Number(wantNum)) || list[0] || null
    }
    store.setCurrentEpisode(ep)
    if (ep) {
      store.setScriptContent(ep.script_content || '')
      scriptTitle.value = ep.title || '第' + (ep.episode_number || 0) + '集'
      selectedEpisodeId.value = ep.id
    } else {
      store.setScriptContent('')
      scriptTitle.value = ''
      selectedEpisodeId.value = null
    }
    syncStoryboardStateFromEpisode(ep)
    await loadStoryboardMedia()
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  }
}

const EMPTY_ARR = []
/** 当前分镜已选角色 id 列表（供 el-select 绑定） */
function getSbCharacterIds(sbId) {
  const arr = sbCharacterIds.value[sbId]
  return Array.isArray(arr) && arr.length > 0 ? arr : EMPTY_ARR
}

function setSbCharacterIds(sbId, v) {
  const next = Array.isArray(v) ? v : []
  sbCharacterIds.value = { ...sbCharacterIds.value, [sbId]: next }
  onStoryboardCharacterChange(sbId)
}

/** 当前分镜已选物品 id 列表 */
function getSbPropIds(sbId) {
  const arr = sbPropIds.value[sbId]
  return Array.isArray(arr) && arr.length > 0 ? arr : EMPTY_ARR
}

function setSbPropIds(sbId, v) {
  sbPropIds.value = { ...sbPropIds.value, [sbId]: Array.isArray(v) ? v : [] }
}

/** 当前分镜选中的场景对象（用于下方缩略图） */
function getSbSelectedScene(sbId) {
  const sceneId = sbSceneId.value[sbId]
  if (sceneId == null) return null
  const list = scenes.value ?? []
  return list.find((s) => Number(s.id) === Number(sceneId)) || null
}

/** 当前分镜选中的角色对象列表（用于下方缩略图） */
function getSbSelectedCharacters(sbId) {
  const ids = getSbCharacterIds(sbId)
  if (!ids.length) return []
  const list = characters.value ?? []
  return ids.map((id) => list.find((c) => Number(c.id) === Number(id))).filter(Boolean)
}

/** 当前分镜选中的物品对象列表（用于下方缩略图） */
function getSbSelectedProps(sbId) {
  const ids = getSbPropIds(sbId)
  if (!ids.length) return []
  const list = props.value ?? []
  return ids.map((id) => list.find((p) => Number(p.id) === Number(id))).filter(Boolean)
}

function onStoryboardCharacterChange(sbId) {
  // 可在此调用后端更新分镜关联角色
}

function onStoryboardSceneChange(sbId) {
  // 可在此调用后端更新分镜场景
}

function updateStoryboardDialogue(sbId) {
  // 可在此防抖后调用后端更新 dialogue
}

async function onGenerateStory() {
  const text = (storyInput.value || '').trim()
  if (!text) {
    ElMessage.warning('请先输入故事梗概')
    return
  }
  storyGenerating.value = true
  try {
    const res = await generationAPI.generateStory({
      premise: text,
      style: storyStyle.value || undefined,
      type: storyType.value || undefined
    })
    const content = res?.content || ''
    store.setScriptContent(content)
    if (!scriptTitle.value?.trim()) {
      scriptTitle.value = '第1集'
    }
    ElMessage.success('剧本已生成，请到下方「剧本生成」查看并保存')
  } catch (e) {
    ElMessage.error(e.message || '故事生成失败')
  } finally {
    storyGenerating.value = false
  }
}

async function onGenerateScript() {
  const content = (scriptContent.value ?? store.scriptContent ?? '').toString().trim()
  if (!content) {
    ElMessage.warning('请先在「故事生成」中点击 AI 生成，或手动输入剧本内容')
    return
  }
  scriptGenerating.value = true
  try {
    let dramaId = store.dramaId
    const curEp = store.currentEpisode
    if (!dramaId) {
      const drama = await dramaAPI.create({
        title: scriptTitle.value || '新故事',
        description: storyInput.value?.trim() || content.slice(0, 200),
        genre: storyType.value || undefined
      })
      store.setDrama(drama)
      dramaId = drama.id
      savedCurrentEpisodeNumber.value = 1
      const episodes = [{ episode_number: 1, title: scriptTitle.value || '第1集', script_content: content }]
      await dramaAPI.saveEpisodes(dramaId, episodes)
      await loadDrama()
      ElMessage.success('项目已创建，剧本已保存')
      if (route.params.id === 'new') {
        router.replace('/film/' + dramaId)
      }
    } else {
      const episodes = store.drama?.episodes || []
      savedCurrentEpisodeNumber.value = curEp?.episode_number ?? 1
      const updated = episodes.map((ep, i) => {
        const num = ep.episode_number ?? i + 1
        const isCurrent = curEp && Number(ep.id) === Number(curEp.id)
        return {
          episode_number: num,
          title: isCurrent ? (scriptTitle.value || '第' + num + '集') : (ep.title || ''),
          script_content: isCurrent ? content : (ep.script_content || ''),
          description: ep.description,
          duration: ep.duration
        }
      })
      if (updated.length === 0) {
        updated.push({ episode_number: 1, title: scriptTitle.value || '第1集', script_content: content })
      }
      await dramaAPI.saveEpisodes(dramaId, updated)
      await loadDrama()
      ElMessage.success('剧本已保存')
    }
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    scriptGenerating.value = false
  }
}

async function onAddEpisode() {
  if (!store.dramaId) return
  const list = store.drama?.episodes || []
  const nextNum = list.length > 0
    ? Math.max(...list.map((e) => Number(e.episode_number) || 0), 0) + 1
    : 1
  const updated = list.map((ep, i) => ({
    episode_number: ep.episode_number ?? i + 1,
    title: ep.title || '第' + (ep.episode_number ?? i + 1) + '集',
    script_content: ep.script_content || '',
    description: ep.description,
    duration: ep.duration
  }))
  updated.push({
    episode_number: nextNum,
    title: '第' + nextNum + '集',
    script_content: '',
    description: null,
    duration: 0
  })
  try {
    await dramaAPI.saveEpisodes(store.dramaId, updated)
    savedCurrentEpisodeNumber.value = nextNum
    await loadDrama()
    ElMessage.success('已添加第' + nextNum + '集')
  } catch (e) {
    ElMessage.error(e.message || '添加失败')
  }
}

async function onGenerateCharacters() {
  if (!store.dramaId) return
  charactersGenerating.value = true
  try {
    const outline =
      (store.scriptContent || '').toString().trim() ||
      (storyInput.value || '').toString().trim() ||
      undefined
    const res = await generationAPI.generateCharacters(store.dramaId, {
      episode_id: store.currentEpisode?.id ?? undefined,
      outline: outline || undefined
    })
    const taskId = res?.task_id
    if (taskId) {
      await pollTask(taskId, () => loadDrama())
      ElMessage.success('角色生成完成')
    } else {
      await loadDrama()
    }
  } catch (e) {
    ElMessage.error(e.message || '生成失败')
  } finally {
    charactersGenerating.value = false
  }
}

function editCharacter(char) {
  editCharacterForm.value = {
    id: char.id,
    name: char.name || '',
    role: char.role || '',
    appearance: char.appearance || '',
    personality: char.personality || '',
    description: char.description || ''
  }
  showEditCharacter.value = true
}

async function submitEditCharacter() {
  if (!editCharacterForm.value?.id) return
  editCharacterSaving.value = true
  try {
    await characterAPI.update(editCharacterForm.value.id, {
      name: editCharacterForm.value.name?.trim(),
      role: editCharacterForm.value.role || undefined,
      appearance: editCharacterForm.value.appearance || undefined,
      personality: editCharacterForm.value.personality || undefined,
      description: editCharacterForm.value.description || undefined
    })
    await loadDrama()
    showEditCharacter.value = false
    ElMessage.success('角色已保存')
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    editCharacterSaving.value = false
  }
}

function onUploadResourceClick(type, id) {
  resourceUploadType.value = type
  resourceUploadId.value = id
  resourceImageFileInput.value?.click()
}

async function onResourceImageFileChange(ev) {
  const file = ev.target?.files?.[0]
  const type = resourceUploadType.value
  const id = resourceUploadId.value
  if (!file || !type || id == null) {
    ev.target.value = ''
    return
  }
  const key = type === 'character' ? 'char-' : type === 'prop' ? 'prop-' : 'scene-'
  uploadingResourceId.value = key + id
  try {
    const res = await uploadAPI.uploadImage(file)
    const data = res?.data ?? res
    const url = data?.url || data?.path || data?.local_path
    if (!url) {
      ElMessage.error('上传未返回地址')
      return
    }
    if (type === 'character') {
      await characterAPI.putImage(id, { image_url: url })
    } else if (type === 'prop') {
      await propAPI.update(id, { image_url: url })
    } else if (type === 'scene') {
      await sceneAPI.update(id, { image_url: url })
    }
    await loadDrama()
    ElMessage.success('上传成功')
  } catch (e) {
    ElMessage.error(e.message || '上传失败')
  } finally {
    uploadingResourceId.value = null
    resourceUploadType.value = null
    resourceUploadId.value = null
    ev.target.value = ''
  }
}

async function onDeleteCharacter(char) {
  try {
    await ElMessageBox.confirm(
      `确定要删除角色「${(char.name || '未命名').slice(0, 20)}」吗？此操作不可恢复。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    await characterAPI.delete(char.id)
    await loadDrama()
    ElMessage.success('角色已删除')
  } catch (e) {
    if (e === 'cancel') return
    ElMessage.error(e.message || '删除失败')
  }
}

async function onGenerateCharacterImage(char) {
  generatingCharId.value = char.id
  try {
    const res = await characterAPI.generateImage(char.id, store.selectedImageModel || undefined)
    const taskId = res?.image_generation?.task_id ?? res?.task_id
    if (taskId) {
      await pollTask(taskId, () => loadDrama())
      ElMessage.success('角色图片已生成')
    } else {
      await loadDrama()
      await pollUntilResourceHasImage(() => {
        const list = store.drama?.characters ?? store.currentEpisode?.characters ?? []
        const c = list.find((x) => Number(x.id) === Number(char.id))
        return !!(c && (c.image_url || c.local_path))
      })
      ElMessage.success('角色图片已生成')
    }
  } catch (e) {
    ElMessage.error(e.message || '提交失败')
  } finally {
    generatingCharId.value = null
  }
}

async function onExtractProps() {
  if (!currentEpisodeId.value) {
    ElMessage.warning('请先完成剧本并保存')
    return
  }
  try {
    const res = await propAPI.extractFromScript(currentEpisodeId.value)
    if (res?.task_id) await pollTask(res.task_id, () => loadDrama())
    await loadDrama()
    ElMessage.success('道具提取任务已提交')
  } catch (e) {
    ElMessage.error(e.message || '提取失败')
  }
}

function editProp(prop) {
  editPropForm.value = {
    id: prop.id,
    name: prop.name || '',
    type: prop.type || '',
    description: prop.description || '',
    prompt: prop.prompt || ''
  }
  showEditProp.value = true
}

async function submitEditProp() {
  if (!editPropForm.value?.id) return
  editPropSaving.value = true
  try {
    await propAPI.update(editPropForm.value.id, {
      name: editPropForm.value.name?.trim(),
      type: editPropForm.value.type || undefined,
      description: editPropForm.value.description || undefined,
      prompt: editPropForm.value.prompt || undefined
    })
    await loadDrama()
    showEditProp.value = false
    ElMessage.success('道具已保存')
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    editPropSaving.value = false
  }
}

async function onDeleteProp(prop) {
  try {
    await ElMessageBox.confirm(
      `确定要删除道具「${(prop.name || '未命名').slice(0, 20)}」吗？此操作不可恢复。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    await propAPI.delete(prop.id)
    await loadDrama()
    ElMessage.success('道具已删除')
  } catch (e) {
    if (e === 'cancel') return
    ElMessage.error(e.message || '删除失败')
  }
}

async function onGeneratePropImage(prop) {
  generatingPropId.value = prop.id
  try {
    const model = store.selectedImageModel || undefined
    const res = await propAPI.generateImage(prop.id, model)
    const taskId = res?.task_id
    if (taskId) {
      await pollTask(taskId, () => loadDrama())
      ElMessage.success('道具图片已生成')
    } else {
      await loadDrama()
      await pollUntilResourceHasImage(() => {
        const list = store.drama?.props ?? store.currentEpisode?.props ?? []
        const p = list.find((x) => Number(x.id) === Number(prop.id))
        return !!(p && (p.image_url || p.local_path))
      })
      ElMessage.success('道具图片已生成')
    }
  } catch (e) {
    ElMessage.error(e.message || '提交失败')
  } finally {
    generatingPropId.value = null
  }
}

async function onExtractScenes() {
  if (!currentEpisodeId.value) return
  scenesExtracting.value = true
  try {
    const res = await dramaAPI.extractBackgrounds(currentEpisodeId.value, {
      model: store.selectedImageModel || undefined
    })
    const taskId = res?.task_id
    if (taskId) {
      await pollTask(taskId, () => loadDrama())
      ElMessage.success('场景提取完成')
    } else {
      await loadDrama()
      ElMessage.success('场景提取任务已提交')
    }
  } catch (e) {
    ElMessage.error(e.message || '提取失败')
  } finally {
    scenesExtracting.value = false
  }
}

function editScene(scene) {
  editSceneForm.value = {
    id: scene.id,
    location: scene.location || '',
    time: scene.time || '',
    prompt: scene.prompt || ''
  }
  showEditScene.value = true
}

async function submitEditScene() {
  if (!editSceneForm.value?.id) return
  editSceneSaving.value = true
  try {
    await sceneAPI.update(editSceneForm.value.id, {
      location: editSceneForm.value.location?.trim(),
      time: editSceneForm.value.time || undefined,
      prompt: editSceneForm.value.prompt || undefined
    })
    await loadDrama()
    showEditScene.value = false
    ElMessage.success('场景已保存')
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    editSceneSaving.value = false
  }
}

async function onDeleteScene(scene) {
  try {
    await ElMessageBox.confirm(
      `确定要删除场景「${(scene.location || scene.time || '未命名').slice(0, 20)}」吗？此操作不可恢复。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    await sceneAPI.delete(scene.id)
    await loadDrama()
    ElMessage.success('场景已删除')
  } catch (e) {
    if (e === 'cancel') return
    ElMessage.error(e.message || '删除失败')
  }
}

async function onGenerateSceneImage(scene) {
  generatingSceneId.value = scene.id
  try {
    const res = await sceneAPI.generateImage({
      scene_id: scene.id,
      model: store.selectedImageModel || undefined
    })
    const taskId = res?.image_generation?.task_id ?? res?.task_id
    if (taskId) {
      await pollTask(taskId, () => loadDrama())
      ElMessage.success('场景图片已生成')
    } else {
      await loadDrama()
      await pollUntilResourceHasImage(() => {
        const list = store.drama?.scenes ?? store.currentEpisode?.scenes ?? []
        const s = list.find((x) => Number(x.id) === Number(scene.id))
        return !!(s && (s.image_url || s.local_path))
      })
      ElMessage.success('场景图片已生成')
    }
  } catch (e) {
    ElMessage.error(e.message || '提交失败')
  } finally {
    generatingSceneId.value = null
  }
}

/** 获取该分镜首图 URL，供视频生成接口使用（优先已完成图，否则 composed_image） */
function getSbFirstFrameUrl(sb) {
  const img = getSbImage(sb.id)
  if (img && (img.image_url || img.local_path)) return assetImageUrl(img)
  if (sb.composed_image || sb.image_url) return imageUrl(sb.composed_image || sb.image_url)
  return ''
}

/** 转为视频接口可请求的绝对 URL（后端/第三方需能访问） */
function toAbsoluteImageUrl(url) {
  if (!url || !String(url).trim()) return ''
  const s = String(url).trim()
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  const base = (baseUrl.value || '').replace(/\/$/, '') || (typeof window !== 'undefined' ? window.location.origin : '')
  return base ? base + (s.startsWith('/') ? s : '/' + s) : s
}

async function onGenerateSbVideo(sb) {
  if (!dramaId.value || !sb?.id || !sb.video_prompt) return
  const firstFrameUrl = getSbFirstFrameUrl(sb)
  if (!firstFrameUrl) {
    ElMessage.warning('请先生成或上传该分镜的图片，再生成视频')
    return
  }
  generatingSbVideoId.value = sb.id
  try {
    const absoluteUrl = toAbsoluteImageUrl(firstFrameUrl)
    const res = await videosAPI.create({
      drama_id: dramaId.value,
      storyboard_id: sb.id,
      prompt: sb.video_prompt,
      image_url: absoluteUrl || undefined,
      reference_image_urls: absoluteUrl ? [absoluteUrl] : undefined,
      model: store.selectedVideoModel || undefined
    })
    if (res?.task_id) {
      await pollTask(res.task_id, () => loadStoryboardMedia())
      ElMessage.success('视频生成完成')
    } else {
      await loadStoryboardMedia()
      ElMessage.success('视频生成已提交，请稍后查看')
    }
  } catch (e) {
    ElMessage.error(e.message || '提交失败')
  } finally {
    generatingSbVideoId.value = null
  }
}

async function onGenerateStoryboard() {
  if (!currentEpisodeId.value) return
  storyboardGenerating.value = true
  try {
    const res = await dramaAPI.generateStoryboard(currentEpisodeId.value, store.selectedImageModel || undefined)
    if (res?.task_id) await pollTask(res.task_id, () => loadDrama())
    await loadDrama()
    ElMessage.success('分镜生成任务已提交')
  } catch (e) {
    ElMessage.error(e.message || '生成失败')
  } finally {
    storyboardGenerating.value = false
  }
}

async function onGenerateVideo() {
  if (!currentEpisodeId.value) return
  store.setVideoStatus('generating')
  store.setVideoProgress(0)
  videoErrorMsg.value = ''
  try {
    const result = await dramaAPI.finalizeEpisode(currentEpisodeId.value)
    store.setVideoProgress(100)
    store.setVideoStatus('done')
    ElMessage.success('视频合成任务已提交，请稍后在下载处查看')
  } catch (e) {
    videoErrorMsg.value = e.message || '生成失败'
    store.setVideoStatus('error')
  }
}

/** 无 task_id 时轮询刷新直到资源出现图片或超时（用于角色/道具/场景图生成） */
async function pollUntilResourceHasImage(checker, maxAttempts = 20, intervalMs = 3000) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs))
    await loadDrama()
    if (checker()) return
  }
}

function pollTask(taskId, onDone) {
  const maxAttempts = 60
  const interval = 2000
  let attempts = 0
  return new Promise((resolve) => {
    const tick = async () => {
      attempts++
      try {
        const t = await taskAPI.get(taskId)
        if (t.status === 'completed') {
          if (onDone) await onDone()
          return resolve()
        }
        if (t.status === 'failed') {
          ElMessage.error(t.error || '任务失败')
          return resolve()
        }
      } catch (_) {}
      if (attempts < maxAttempts) setTimeout(tick, interval)
      else resolve()
    }
    setTimeout(tick, interval)
  })
}

async function loadImageModels() {
  if (imageModelOptions.value.length > 0) return
  try {
    const list = await aiAPI.list('image')
    const active = (list || []).filter((c) => c.is_active !== false)
    const opts = []
    for (const c of active) {
      const models = Array.isArray(c.model) ? c.model : c.model != null ? [c.model] : []
      for (const m of models) opts.push({ label: `${c.name || c.provider} - ${m}`, value: m })
    }
    imageModelOptions.value = opts
  } catch (_) {
    imageModelOptions.value = []
  }
}

async function loadVideoModels() {
  if (videoModelOptions.value.length > 0) return
  try {
    const list = await aiAPI.list('video')
    const active = (list || []).filter((c) => c.is_active !== false)
    const opts = []
    for (const c of active) {
      const models = Array.isArray(c.model) ? c.model : c.model != null ? [c.model] : []
      for (const m of models) opts.push({ label: `${c.name || c.provider} - ${m}`, value: m })
    }
    videoModelOptions.value = opts
  } catch (_) {
    videoModelOptions.value = []
  }
}

async function submitAddProp() {
  const name = (addPropForm.value.name || '').trim()
  if (!name || !store.dramaId) return
  try {
    await propAPI.create({
      drama_id: store.dramaId,
      name,
      description: addPropForm.value.description || undefined,
      prompt: addPropForm.value.prompt || undefined
    })
    showAddProp.value = false
    await loadDrama()
    ElMessage.success('道具已添加')
  } catch (e) {
    ElMessage.error(e.message || '添加失败')
  }
}

onMounted(() => {
  const id = route.params.id
  if (id && id !== 'new') {
    store.setDrama({ id: Number(id) })
    loadDrama()
  } else {
    store.reset()
    storyInput.value = ''
    scriptTitle.value = ''
    selectedEpisodeId.value = null
    savedCurrentEpisodeNumber.value = 1
    storyStyle.value = ''
    storyType.value = ''
    scriptLanguage.value = 'zh'
    scriptStoryboardStyle.value = ''
  }
})
</script>

<style scoped>
.film-create {
  min-height: 100vh;
  background: #0f0f12;
  color: #e4e4e7;
}
.header {
  background: #18181b;
  border-bottom: 1px solid #27272a;
  padding: 12px 24px;
}
.header-inner {
  max-width: min(1400px, 96vw);
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 16px;
}
.logo {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: #fafafa;
}
.page-title {
  color: #a1a1aa;
  font-size: 0.95rem;
}
.main {
  max-width: min(1400px, 96vw);
  margin: 0 auto;
  padding: 24px 16px 48px;
}
.section {
  margin-bottom: 24px;
}
.card {
  background: #18181b;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #27272a;
}
.section-title {
  font-size: 1.1rem;
  margin: 0 0 4px;
  color: #fafafa;
}
/* 资源管理大面板 + 可折叠标题 */
.resource-panel {
  padding: 0;
  overflow: hidden;
}
.collapse-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}
.collapse-header:hover {
  background: rgba(255, 255, 255, 0.04);
}
.resource-panel .collapse-header {
  border-bottom: 1px solid #27272a;
}
.resource-panel .collapse-header .section-title {
  margin: 0;
}
.collapse-icon {
  font-size: 1.1rem;
  color: #a1a1aa;
  flex-shrink: 0;
  margin-left: 8px;
}
.resource-panel-body {
  padding: 16px 20px 20px;
}
.resource-block {
  margin-bottom: 20px;
  padding: 0;
  overflow: hidden;
}
.resource-block:last-child {
  margin-bottom: 0;
}
.resource-block-header {
  padding: 10px 14px;
  border-bottom: 1px solid #27272a;
}
.resource-block-header .collapse-icon {
  font-size: 1rem;
}
.resource-block-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: #e4e4e7;
}
.resource-block-body {
  padding: 12px 14px 14px;
}
.resource-block-body .asset-actions {
  margin-bottom: 12px;
}
.resource-block-body .asset-list-two {
  gap: 16px;
}
.section-desc {
  color: #71717a;
  font-size: 0.85rem;
  margin: 0 0 12px;
}
.story-textarea {
  margin-bottom: 12px;
}
.row { display: flex; flex-wrap: wrap; align-items: center; }
.gap { gap: 12px; }
.asset-actions { margin-bottom: 12px; }
.asset-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}
.asset-list-two {
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}
.asset-item {
  background: #27272a;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.asset-item-left-right {
  flex-direction: row;
  align-items: stretch;
}
.asset-item-left-right .asset-info {
  flex: 1;
  min-width: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
}
.asset-item-left-right .asset-name {
  font-size: 1.05rem;
  margin-bottom: 8px;
}
.asset-item-left-right .asset-desc-full {
  flex: 1;
  font-size: 0.875rem;
  color: #a1a1aa;
  line-height: 1.5;
  margin-bottom: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}
.asset-item-left-right .asset-cover {
  width: 200px;
  min-width: 200px;
  height: 200px;
  flex-shrink: 0;
  align-self: flex-start;
}
.asset-item-left-right .asset-cover.asset-cover--clickable {
  cursor: pointer;
}
.asset-cover {
  width: 100%;
  aspect-ratio: 1;
  background: #3f3f46;
  position: relative;
  overflow: hidden;
}
.asset-item-left-right .asset-cover .cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #71717a;
  font-size: 0.85rem;
}
.image-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.image-preview-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  cursor: pointer;
  pointer-events: auto;
}
.asset-info { padding: 10px; }
.asset-name { font-weight: 600; margin-bottom: 4px; color: #e4e4e7; }
.asset-desc {
  font-size: 0.8rem;
  color: #a1a1aa;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asset-desc-full {
  font-size: 0.875rem;
  color: #a1a1aa;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.asset-btns { display: flex; gap: 6px; flex-wrap: wrap; margin-top: auto; }
.empty-tip {
  color: #71717a;
  font-size: 0.9rem;
  padding: 16px 0;
}
/* 分镜：每行一个，三列布局 */
.storyboard-row {
  display: flex;
  align-items: stretch;
  gap: 0;
  margin-bottom: 20px;
  background: #1c1c1e;
  border-radius: 10px;
  border: 1px solid #27272a;
  overflow: hidden;
  position: relative;
}
.storyboard-row:last-child { margin-bottom: 0; }
.sb-num-badge {
  position: absolute;
  left: 12px;
  top: 12px;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
.sb-panel {
  flex: 1;
  min-width: 0;
  padding: 12px 14px;
  border-right: 1px solid #27272a;
  display: flex;
  flex-direction: column;
}
.sb-panel:last-child { border-right: none; }
.sb-panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  color: #e4e4e7;
  margin-bottom: 10px;
}
.sb-panel-title .el-icon { font-size: 1rem; color: #a1a1aa; }
.sb-panel-title-name {
  margin-left: 4px;
  color: #a1a1aa;
  font-weight: 500;
  max-width: 12em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sb-script { padding-top: 36px; }
.sb-script-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.sb-select { flex: 1; min-width: 0; }
.sb-select-empty { font-size: 0.8rem; color: #71717a; padding: 8px; }
.sb-selected-thumbs {
  margin: 10px 0;
  padding: 8px 0;
  border-top: 1px solid #27272a;
}
.sb-thumb-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.sb-thumb-row:last-child { margin-bottom: 0; }
.sb-thumb-label {
  font-size: 0.8rem;
  color: #71717a;
  flex-shrink: 0;
  width: 36px;
}
.sb-thumb-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.sb-thumb-item {
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  background: #27272a;
}
.sb-thumb-item.sb-thumb-clickable {
  cursor: pointer;
}
.sb-thumb-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}
.sb-thumb-prop,
.sb-thumb-scene {
  width: 36px;
  height: 36px;
}
.sb-script-row.sb-script-selects {
  gap: 6px;
}
.sb-script-row.sb-script-selects .sb-select {
  min-width: 0;
}
.sb-script-row.sb-script-selects .el-select { flex: 1; min-width: 0; }
.sb-thumb-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sb-thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #a1a1aa;
  background: #3f3f46;
}
.sb-script-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: #71717a;
  margin-bottom: 6px;
}
.sb-script-label .el-icon { font-size: 0.9rem; }
.sb-upload-icon { margin-left: auto; cursor: pointer; color: #a1a1aa; }
.sb-narration {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 4px;
}
.sb-narration-type { font-size: 0.85rem; color: #a1a1aa; }
.sb-dialogue-input { margin-bottom: 6px; }
.sb-meta {
  font-size: 0.75rem;
  color: #71717a;
  display: flex;
  gap: 12px;
}
.sb-image-area {
  flex: 1;
  min-height: 140px;
  max-height: 220px;
  background: #27272a;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  overflow: hidden;
}
.sb-generated-img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
}
.sb-image-file-input { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
.sb-gen-btn { margin-top: 4px; }
.sb-image-area img.sb-generated-img { cursor: pointer; }
.sb-image-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-shrink: 0;
  padding-top: 6px;
}
.sb-video-area {
  flex: 1;
  min-height: 140px;
  background: #27272a;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sb-video-player {
  width: 100%;
  max-height: 240px;
  border-radius: 8px;
}
.sb-video-prompt-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.sb-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #a855f7;
  flex-shrink: 0;
}
.sb-video-prompt-label > span:not(.sb-dot) { font-size: 0.85rem; color: #e4e4e7; }
.sb-camera-select { width: 100px; }
.sb-video-prompt-text {
  font-size: 0.85rem;
  color: #a1a1aa;
  line-height: 1.5;
  padding: 8px 0;
}
.sb-generate-video-btn { margin-top: 8px; }
.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px 24px;
  margin-bottom: 16px;
}
.sub-title {
  font-size: 1rem;
  margin: 16px 0 8px;
  color: #e4e4e7;
}
.video-progress, .video-done, .video-error {
  margin-top: 16px;
}
</style>
