<template>
  <div class="film-create">
    <!-- 顶部 -->
    <header class="header">
      <div class="header-inner">
        <h1 class="logo" @click="goList">LocalMiniDrama.ai</h1>
        <span class="page-title">{{ dramaId ? (store.drama?.title || '项目') : '新建故事' }}</span>
        <el-button v-if="dramaId" class="btn-back-drama" @click="router.push('/drama/' + dramaId)">
          <el-icon><ArrowLeft /></el-icon>
          返回剧集
        </el-button>
        <el-button class="btn-theme" :title="isDark ? '切换到白天模式' : '切换到暗色模式'" @click="toggleTheme">
          <el-icon><Sunny v-if="isDark" /><Moon v-else /></el-icon>
          {{ isDark ? '白天' : '暗色' }}
        </el-button>
        <el-button class="btn-ai-config" @click="showAiConfigDialog = true">
          <el-icon><Setting /></el-icon>
          AI配置
        </el-button>
      </div>
    </header>

    <!-- 左侧快捷目录 -->
    <nav class="quick-nav" :class="{ collapsed: navCollapsed }" aria-label="快捷导航">
      <div class="nav-toggle" :title="navCollapsed ? '展开导航' : '收起导航'" @click="navCollapsed = !navCollapsed">
        <el-icon><ArrowLeft v-if="!navCollapsed" /><ArrowRight v-else /></el-icon>
      </div>
      <div class="nav-item" @click="scrollToTop">
        <span class="nav-label">顶部</span>
      </div>
      <div class="nav-item" @click="scrollToAnchor('anchor-script')">
        <span class="nav-label">剧本</span>
      </div>
      <div class="nav-item" @click="scrollToAnchor('anchor-characters')">
        <span class="nav-label">角色</span>
      </div>
      <div class="nav-item" @click="scrollToAnchor('anchor-props')">
        <span class="nav-label">道具</span>
      </div>
      <div class="nav-item" @click="scrollToAnchor('anchor-scenes')">
        <span class="nav-label">场景</span>
      </div>
      
      <div class="nav-group">
        <div class="nav-item" @click="scrollToAnchor('anchor-storyboard')">
          <span class="nav-expand-icon" @click.stop="storyboardMenuExpanded = !storyboardMenuExpanded">
            <el-icon><Minus v-if="storyboardMenuExpanded" /><Plus v-else /></el-icon>
          </span>
          <span class="nav-label">分镜</span>
        </div>
        <div v-show="storyboardMenuExpanded" class="nav-sub-list">
          <div 
            v-for="(sb, i) in storyboards" 
            :key="sb.id" 
            class="nav-sub-item"
            :title="sb.title || '分镜 ' + (i + 1)"
            @click="scrollToAnchor('sb-' + sb.id)"
          >
            {{ i + 1 }}. {{ sb.title || '分镜' }}
          </div>
        </div>
      </div>
      
      <div class="nav-item" @click="scrollToAnchor('anchor-video')">
        <span class="nav-label">视频</span>
      </div>
    </nav>

    <main class="main">
      <!-- 角色/道具/场景上传图片用，单例放在外层避免 v-for 导致 ref 为数组 -->
      <input
        ref="resourceImageFileInput"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style="display: none"
        @change="onResourceImageFileChange"
      />
      <!-- 分镜图上传图片用，单例放在外层避免 v-for 导致 ref 为数组 -->
      <input
        ref="sbImageFileInput"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style="display: none"
        @change="onSbImageFileChange"
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
          <el-select v-model="storyStyle" placeholder="风格" clearable style="width: 140px" @change="saveProjectSettings">
            <el-option label="现代" value="modern" />
            <el-option label="古风" value="ancient" />
            <el-option label="奇幻" value="fantasy" />
            <el-option label="日常" value="daily" />
          </el-select>
          <el-select v-model="storyType" placeholder="类型" clearable style="width: 140px" @change="saveProjectSettings">
            <el-option label="剧情" value="drama" />
            <el-option label="喜剧" value="comedy" />
            <el-option label="冒险" value="adventure" />
          </el-select>
          <el-button type="primary" :loading="storyGenerating" @click="onGenerateStory">AI 生成</el-button>
        </div>
      </section>

      <!-- 2. 剧本生成 -->
      <section id="anchor-script" class="section card">
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
        <div class="one-click-actions">
          <el-select v-model="projectAspectRatio" style="width: 130px" @change="saveProjectSettings">
            <el-option label="16:9 横屏" value="16:9" />
            <el-option label="9:16 竖屏" value="9:16" />
            <el-option label="1:1 方形" value="1:1" />
            <el-option label="4:3" value="4:3" />
            <el-option label="21:9 宽银幕" value="21:9" />
          </el-select>
          <el-select v-model="videoClipDuration" style="width: 105px" @change="saveProjectSettings">
            <el-option label="4秒/段" :value="4" />
            <el-option label="5秒/段" :value="5" />
            <el-option label="8秒/段" :value="8" />
            <el-option label="10秒/段" :value="10" />
          </el-select>
          <el-select v-model="generationStyle" placeholder="图片/视频风格" clearable style="width: 160px" @change="saveProjectSettings">
            <el-option v-for="opt in generationStyleOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <el-button
            type="primary"
            :loading="pipelineRunning && !pipelinePaused"
            :disabled="!currentEpisodeId || pipelineRunning"
            @click="startOneClickPipeline"
          >
            一键生成视频
          </el-button>
          <el-button
            type="success"
            plain
            :loading="pipelineRunning && !pipelinePaused"
            :disabled="!currentEpisodeId || pipelineRunning"
            @click="startRepairPipeline"
          >
            补全并生成
          </el-button>
          <template v-if="pipelineRunning">
            <el-button v-if="!pipelinePaused" type="warning" @click="pipelinePaused = true">暂停</el-button>
            <el-button v-else type="success" @click="onPipelineResume">继续</el-button>
          </template>
        </div>
        <div v-if="pipelineRunning || pipelineErrorLog.length > 0" class="pipeline-status">
          <div v-if="pipelineCurrentStep" class="pipeline-current-step">
            当前进度：{{ pipelineCurrentStep }}
          </div>
          <div v-if="pipelineErrorLog.length > 0" class="pipeline-error-log">
            <div class="pipeline-error-title">执行过程中的错误：</div>
            <div v-for="(entry, idx) in pipelineErrorLog" :key="idx" class="pipeline-error-line">
              [{{ entry.step }}] {{ entry.message }}
            </div>
          </div>
        </div>
      </section>

      <!-- 资源管理：角色 / 道具 / 场景 -->
      <section class="section card resource-panel">
        <div class="collapse-header" @click="resourcePanelCollapsed = !resourcePanelCollapsed">
          <h2 class="section-title">资源管理</h2>
          <el-icon class="collapse-icon"><ArrowUp v-if="!resourcePanelCollapsed" /><ArrowDown v-else /></el-icon>
        </div>
        <div v-show="!resourcePanelCollapsed" class="resource-panel-body">
          <!-- 角色生成 -->
          <div id="anchor-characters" class="resource-block card">
            <div class="collapse-header resource-block-header" @click="charactersBlockCollapsed = !charactersBlockCollapsed">
              <h3 class="resource-block-title">角色生成</h3>
              <el-icon class="collapse-icon"><ArrowUp v-if="!charactersBlockCollapsed" /><ArrowDown v-else /></el-icon>
            </div>
            <div v-show="!charactersBlockCollapsed" class="resource-block-body">
              <div class="asset-actions">
                <el-button type="primary" size="small" :loading="charactersGenerating" :disabled="!dramaId" @click="onGenerateCharacters">
                  剧本自动提取角色
                </el-button>
                <el-button size="small" :disabled="!dramaId" @click="openAddCharacter">添加角色</el-button>
                <el-button size="small" @click="showCharLibrary = true">本剧角色库</el-button>
              </div>
              <div class="asset-list asset-list-two">
                <div v-for="char in characters" :key="char.id" class="asset-item asset-item-left-right">
                  <div class="asset-info">
                    <div class="asset-name">{{ char.name }}</div>
                    <div class="asset-desc-full">{{ char.appearance || char.description || '暂无描述' }}</div>
                    <div class="asset-btns">
                      <el-button size="small" :loading="generatingCharId === char.id" @click="onGenerateCharacterImage(char)">
                        AI 生成
                      </el-button>
                      <el-button size="small" @click="editCharacter(char)">编辑</el-button>
                      <el-button size="small" :loading="uploadingResourceId === 'char-' + char.id" @click="onUploadResourceClick('character', char.id)">
                        上传
                      </el-button>
                      <el-button size="small" :loading="addingCharToLibraryId === char.id" :disabled="!hasAssetImage(char)" @click="onAddCharacterToLibrary(char)">
                        加入本剧库
                      </el-button>
                      <el-button size="small" :loading="addingCharToMaterialId === char.id" :disabled="!hasAssetImage(char)" @click="onAddCharacterToMaterialLibrary(char)">
                        加入素材库
                      </el-button>
                      <el-button size="small" type="danger" plain @click="onDeleteCharacter(char)">删除</el-button>
                    </div>
                  </div>
                  <div
                    class="asset-cover"
                    :class="{ 'asset-cover--clickable': hasAssetImage(char), 'asset-cover--dragover': dragOverResourceKey === 'char-' + char.id }"
                    role="button"
                    tabindex="0"
                    @click="hasAssetImage(char) && openImagePreview(assetImageUrl(char))"
                    @dragover="onResourceDragOver($event, 'character', char.id)"
                    @dragleave="onResourceDragLeave($event, 'char-' + char.id)"
                    @drop="onResourceDrop($event, 'character', char.id)"
                  >
                    <img v-if="hasAssetImage(char)" :src="assetImageUrl(char)" class="cover-img" alt="" />
                    <div v-else-if="char.error_msg || char.errorMsg" class="cover-placeholder error" :title="char.error_msg || char.errorMsg">{{ char.error_msg || char.errorMsg }}</div>
                    <div v-else class="cover-placeholder">暂无图</div>
                    <div v-if="dragOverResourceKey === 'char-' + char.id" class="asset-cover-drop-hint">松开上传</div>
                  </div>
                </div>
                <div v-if="characters.length === 0" class="empty-tip">暂无角色，请先「AI 生成角色」或在上一步保存剧本后提取</div>
              </div>
            </div>
          </div>

          <!-- 道具生成 -->
          <div id="anchor-props" class="resource-block card">
            <div class="collapse-header resource-block-header" @click="propsBlockCollapsed = !propsBlockCollapsed">
              <h3 class="resource-block-title">道具生成</h3>
              <el-icon class="collapse-icon"><ArrowUp v-if="!propsBlockCollapsed" /><ArrowDown v-else /></el-icon>
            </div>
            <div v-show="!propsBlockCollapsed" class="resource-block-body">
              <div class="asset-actions">
                <el-button type="primary" size="small" :loading="propsExtracting" :disabled="!currentEpisodeId" @click="onExtractProps">从剧本提取道具</el-button>
                <el-button size="small" :disabled="!dramaId" @click="showAddProp = true">添加道具</el-button>
                <el-button size="small" @click="showPropLibrary = true">本剧道具库</el-button>
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
                      <el-button size="small" :loading="addingPropToLibraryId === prop.id" :disabled="!hasAssetImage(prop)" @click="onAddPropToLibrary(prop)">
                        加入本剧库
                      </el-button>
                      <el-button size="small" :loading="addingPropToMaterialId === prop.id" :disabled="!hasAssetImage(prop)" @click="onAddPropToMaterialLibrary(prop)">
                        加入素材库
                      </el-button>
                      <el-button size="small" type="danger" plain @click="onDeleteProp(prop)">删除</el-button>
                    </div>
                  </div>
                  <div
                    class="asset-cover"
                    :class="{ 'asset-cover--clickable': hasAssetImage(prop), 'asset-cover--dragover': dragOverResourceKey === 'prop-' + prop.id }"
                    role="button"
                    tabindex="0"
                    @click="hasAssetImage(prop) && openImagePreview(assetImageUrl(prop))"
                    @dragover="onResourceDragOver($event, 'prop', prop.id)"
                    @dragleave="onResourceDragLeave($event, 'prop-' + prop.id)"
                    @drop="onResourceDrop($event, 'prop', prop.id)"
                  >
                    <img v-if="hasAssetImage(prop)" :src="assetImageUrl(prop)" class="cover-img" alt="" />
                    <div v-else-if="prop.error_msg || prop.errorMsg" class="cover-placeholder error" :title="prop.error_msg || prop.errorMsg">{{ prop.error_msg || prop.errorMsg }}</div>
                    <div v-else class="cover-placeholder">暂无图</div>
                    <div v-if="dragOverResourceKey === 'prop-' + prop.id" class="asset-cover-drop-hint">松开上传</div>
                  </div>
                </div>
                <div v-if="props.length === 0" class="empty-tip">暂无道具，可从剧本提取或添加</div>
              </div>
            </div>
          </div>

          <!-- 场景生成 -->
          <div id="anchor-scenes" class="resource-block card">
            <div class="collapse-header resource-block-header" @click="scenesBlockCollapsed = !scenesBlockCollapsed">
              <h3 class="resource-block-title">场景生成</h3>
              <el-icon class="collapse-icon"><ArrowUp v-if="!scenesBlockCollapsed" /><ArrowDown v-else /></el-icon>
            </div>
            <div v-show="!scenesBlockCollapsed" class="resource-block-body">
              <div class="asset-actions">
                <el-button type="primary" size="small" :loading="scenesExtracting" :disabled="!currentEpisodeId" @click="onExtractScenes">
                  从剧本提取场景
                </el-button>
                <el-button size="small" :disabled="!dramaId" @click="openAddScene">添加场景</el-button>
                <el-button size="small" @click="showSceneLibrary = true">本剧场景库</el-button>
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
                      <el-button size="small" :loading="addingSceneToLibraryId === scene.id" :disabled="!hasAssetImage(scene)" @click="onAddSceneToLibrary(scene)">
                        加入本剧库
                      </el-button>
                      <el-button size="small" :loading="addingSceneToMaterialId === scene.id" :disabled="!hasAssetImage(scene)" @click="onAddSceneToMaterialLibrary(scene)">
                        加入素材库
                      </el-button>
                      <el-button size="small" type="danger" plain @click="onDeleteScene(scene)">删除</el-button>
                    </div>
                  </div>
                  <div
                    class="asset-cover"
                    :class="{ 'asset-cover--clickable': hasAssetImage(scene), 'asset-cover--dragover': dragOverResourceKey === 'scene-' + scene.id }"
                    role="button"
                    tabindex="0"
                    @click="hasAssetImage(scene) && openImagePreview(assetImageUrl(scene))"
                    @dragover="onResourceDragOver($event, 'scene', scene.id)"
                    @dragleave="onResourceDragLeave($event, 'scene-' + scene.id)"
                    @drop="onResourceDrop($event, 'scene', scene.id)"
                  >
                    <img v-if="hasAssetImage(scene)" :src="assetImageUrl(scene)" class="cover-img" alt="" />
                    <div v-else-if="scene.error_msg || scene.errorMsg" class="cover-placeholder error" :title="scene.error_msg || scene.errorMsg">{{ scene.error_msg || scene.errorMsg }}</div>
                    <div v-else class="cover-placeholder">暂无图</div>
                    <div v-if="dragOverResourceKey === 'scene-' + scene.id" class="asset-cover-drop-hint">松开上传</div>
                  </div>
                </div>
                <div v-if="scenes.length === 0" class="empty-tip">暂无场景，请从剧本提取</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 6. 分镜生成 -->
      <section id="anchor-storyboard" class="section card">
        <h2 class="section-title">
          <span>5. 分镜生成</span>
          <span class="step-desc">根据剧本、角色、场景自动生成分镜头脚本</span>
        </h2>
        <div class="sb-config-row">
          <label class="sb-config-item">
            <span class="sb-config-label">分镜数量</span>
            <el-input-number v-model="storyboardCount" :min="1" :max="50" :step="5" placeholder="自动" class="sb-config-input" />
            <span class="sb-config-hint">留空由 AI 决定</span>
          </label>
          <span class="sb-config-divider">｜</span>
          <label class="sb-config-item">
            <span class="sb-config-label">视频时长(秒)</span>
            <el-input-number v-model="videoDuration" :min="10" :max="600" :step="5" placeholder="自动" class="sb-config-input" />
            <span class="sb-config-hint">留空由 AI 决定</span>
          </label>
        </div>
        <div class="asset-actions">
          <el-button
            type="primary"
            size="large"
            :loading="storyboardGenerating"
            :disabled="!currentEpisodeId || storyboardGenerating"
            @click="onGenerateStoryboard"
          >
            {{ storyboards.length > 0 ? '重新生成分镜' : 'AI 生成分镜' }}
          </el-button>
        </div>
        <div v-if="storyboardGenerating" class="storyboard-generating-tip">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>正在分析剧本并拆解分镜，请稍候...</span>
        </div>
        <template v-if="storyboards.length > 0">
          <div v-for="(sb, i) in storyboards" :key="sb.id" :id="'sb-' + sb.id" class="storyboard-row">
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
              <div class="sb-prompt-label">
                <span class="sb-dot"></span>
                <span>图片提示词</span>
              </div>
              <div v-if="editingSbImagePromptId === sb.id" class="sb-image-prompt-edit">
                <el-input v-model="editingSbImagePromptText" type="textarea" :rows="3" placeholder="图片提示词（用于生成分镜图）" />
                <div class="sb-prompt-edit-actions">
                  <el-button size="small" type="primary" @click="onSaveSbImagePrompt(sb)">保存</el-button>
                  <el-button size="small" @click="editingSbImagePromptId = null">取消</el-button>
                </div>
              </div>
              <div v-else class="sb-prompt-row">
                <span class="sb-prompt-text">{{ sb.image_prompt || '暂无图片提示词' }}</span>
                <el-button size="small" link type="primary" @click="onEditSbImagePrompt(sb)">编辑</el-button>
              </div>
            </div>
            <!-- 中：分镜图（优先用 /images?storyboard_id 拉取到的图，否则用 composed_image） -->
            <div class="sb-panel sb-image">
              <div class="sb-panel-title">
                <el-icon><Picture /></el-icon>
                <span>分镜图</span>
              </div>
              <div
                class="sb-image-area"
                :class="{ 'sb-image-area--dragover': dragOverSbId === sb.id }"
                @dragover="onSbImageDragOver($event, sb.id)"
                @dragleave="onSbImageDragLeave($event, sb.id)"
                @drop="onSbImageDrop($event, sb)"
              >
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
                <template v-else-if="sb.error_msg || sb.errorMsg">
                  <div class="sb-image-error" :title="sb.error_msg || sb.errorMsg">{{ sb.error_msg || sb.errorMsg }}</div>
                  <el-button type="primary" size="small" class="sb-gen-btn" :loading="generatingSbImageId === sb.id" @click="onGenerateSbImage(sb)">
                    <el-icon><Refresh /></el-icon>
                    重试
                  </el-button>
                  <el-button size="small" :loading="uploadingSbImageId === sb.id" @click="onUploadSbImageClick(sb)">上传</el-button>
                </template>
                <template v-else>
                  <el-button type="primary" size="small" class="sb-gen-btn" :loading="generatingSbImageId === sb.id" @click="onGenerateSbImage(sb)">
                    <el-icon><MagicStick /></el-icon>
                    生成分镜
                  </el-button>
                  <el-button size="small" :loading="uploadingSbImageId === sb.id" @click="onUploadSbImageClick(sb)">上传</el-button>
                </template>
                <div v-if="dragOverSbId === sb.id" class="sb-image-area-drop-hint">松开上传</div>
              </div>
              <div v-if="hasSbImage(sb)" class="sb-image-actions">
                <el-button size="small" :loading="generatingSbImageId === sb.id" @click="onGenerateSbImage(sb)">重新生成</el-button>
                <el-button size="small" :loading="uploadingSbImageId === sb.id" @click="onUploadSbImageClick(sb)">上传</el-button>
              </div>
            </div>
            <!-- 右：分镜视频（由 /videos?storyboard_id 拉取）；有视频时仍显示提示词与生成按钮便于调整后重新生成 -->
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
              <div v-else class="sb-video-area sb-video-placeholder">
                <span v-if="generatingSbVideoId === sb.id" class="sb-video-generating-text">
                  <el-icon class="is-loading"><Loading /></el-icon>
                  正在生成视频...
                </span>
                <template v-else>
                  <span>等待生成</span>
                  <div v-if="getSbVideoError(sb.id)" class="sb-video-error">
                    {{ getSbVideoError(sb.id) }}
                  </div>
                </template>
              </div>
              <div class="sb-video-prompt-label">
                <span class="sb-dot"></span>
                <span>视频提示词</span>
              </div>
              <el-collapse class="sb-video-fields-collapse">
                <el-collapse-item :name="'fields-' + sb.id">
                  <template #title>
                    <span class="sb-collapse-title">视频提示词组成（可编辑）</span>
                  </template>
                  <div class="sb-video-fields">
                    <div class="sb-field">
                      <span class="sb-field-label">标题</span>
                      <el-input v-model="sbTitle[sb.id]" size="small" placeholder="镜头标题" />
                    </div>
                    <div class="sb-field">
                      <span class="sb-field-label">地点</span>
                      <el-input v-model="sbLocation[sb.id]" size="small" placeholder="场景地点" />
                    </div>
                    <div class="sb-field">
                      <span class="sb-field-label">时间</span>
                      <el-input v-model="sbTime[sb.id]" size="small" placeholder="如：清晨/午后" />
                    </div>
                    <div class="sb-field">
                      <span class="sb-field-label">时长(秒)</span>
                      <el-input-number v-model="sbDuration[sb.id]" :min="1" :max="30" size="small" />
                    </div>
                    <div class="sb-field sb-field-full">
                      <span class="sb-field-label">动作</span>
                      <el-input v-model="sbAction[sb.id]" type="textarea" :rows="2" placeholder="动作描述" />
                    </div>
                    <div class="sb-field sb-field-full">
                      <span class="sb-field-label">对白</span>
                      <el-input v-model="sbDialogue[sb.id]" type="textarea" :rows="2" placeholder="角色对白" />
                    </div>
                    <div class="sb-field sb-field-full">
                      <span class="sb-field-label">画面结果</span>
                      <el-input v-model="sbResult[sb.id]" type="textarea" :rows="2" placeholder="动作完成后的画面结果" />
                    </div>
                    <div class="sb-field sb-field-full">
                      <span class="sb-field-label">氛围</span>
                      <el-input v-model="sbAtmosphere[sb.id]" size="small" placeholder="氛围/情绪" />
                    </div>
                    <div class="sb-field">
                      <span class="sb-field-label">景别</span>
                      <el-select v-model="sbShotType[sb.id]" placeholder="景别" size="small" class="sb-field-select">
                        <el-option label="大远景" value="大远景" />
                        <el-option label="远景" value="远景" />
                        <el-option label="中景" value="中景" />
                        <el-option label="近景" value="近景" />
                        <el-option label="特写" value="特写" />
                      </el-select>
                    </div>
                    <div class="sb-field">
                      <span class="sb-field-label">镜头角度</span>
                      <el-input v-model="sbAngle[sb.id]" size="small" placeholder="如：平视/仰视" />
                    </div>
                    <div class="sb-field">
                      <span class="sb-field-label">运镜</span>
                      <el-input v-model="sbMovement[sb.id]" size="small" placeholder="如：固定/推镜/跟镜" />
                    </div>
                    <div class="sb-video-fields-actions">
                      <el-button size="small" type="primary" @click="onSaveSbVideoFields(sb)">保存并更新视频提示词</el-button>
                    </div>
                  </div>
                </el-collapse-item>
              </el-collapse>
              <div v-if="editingSbVideoPromptId === sb.id" class="sb-video-prompt-edit">
                <el-input v-model="editingSbVideoPromptText" type="textarea" :rows="6" placeholder="视频提示词（手工编辑）" />
                <div class="sb-video-prompt-edit-actions">
                  <el-button size="small" type="primary" @click="onSaveSbVideoPrompt(sb)">保存</el-button>
                  <el-button size="small" @click="editingSbVideoPromptId = null">取消</el-button>
                </div>
              </div>
              <div v-else class="sb-video-prompt-row">
                <span class="sb-video-prompt-text sb-video-prompt-text--preview">{{ sb.video_prompt || '暂无视频提示词' }}</span>
                <el-button size="small" link type="primary" @click="onEditSbVideoPrompt(sb)">手工编辑</el-button>
              </div>
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
              <el-option label="480p" value="480p" />
              <el-option label="720p" value="720p" />
              <el-option label="1080p" value="1080p" />
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
        <p class="config-tip">文本/图片/视频使用的模型以「<el-link type="primary" :underline="false" @click="showAiConfigDialog = true">AI 配置</el-link>」中设为默认的为准。</p>
      </section>

      <!-- 8. 合成视频 -->
      <section id="anchor-video" class="section card">
        <h2 class="section-title">合成视频</h2>
        <el-button
          type="primary"
          size="large"
          :loading="videoStatus === 'generating'"
          :disabled="!currentEpisodeId || storyboards.length === 0 || videoStatus === 'generating'"
          @click="onGenerateVideo"
        >
          合成视频
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
        <div v-if="currentEpisodeVideoUrl" class="video-preview-wrap">
          <p class="video-preview-label">本集合成视频预览</p>
          <video
            :src="currentEpisodeVideoUrl"
            controls
            class="video-preview-player"
            preload="metadata"
          />
        </div>
      </section>
    </main>

    <!-- 添加道具弹窗 -->
    <el-dialog v-model="showAddProp" title="添加道具" width="440px" @close="addPropForm = { name: '', type: '', description: '', prompt: '' }">
      <el-form label-width="90px">
        <el-form-item label="名称" required>
          <el-input v-model="addPropForm.name" placeholder="道具名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-input v-model="addPropForm.type" placeholder="如：物品、建筑" />
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
        <el-button type="primary" :loading="addPropSaving" :disabled="!addPropForm.name.trim()" @click="submitAddProp">确定</el-button>
      </template>
    </el-dialog>

    <!-- 添加/编辑角色弹窗 -->
    <el-dialog v-model="showEditCharacter" :title="editCharacterForm?.id ? '编辑角色' : '添加角色'" width="480px" @close="showEditCharacter = false">
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
        <el-button type="primary" :loading="editCharacterSaving" :disabled="!editCharacterForm?.name?.trim()" @click="submitEditCharacter">{{ editCharacterForm?.id ? '保存' : '添加' }}</el-button>
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

    <!-- 添加/编辑场景弹窗 -->
    <el-dialog v-model="showEditScene" :title="editSceneForm?.id ? '编辑场景' : '添加场景'" width="480px" @close="showEditScene = false">
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
        <el-button type="primary" :loading="editSceneSaving" :disabled="!editSceneForm?.location?.trim()" @click="submitEditScene">{{ editSceneForm?.id ? '保存' : '添加' }}</el-button>
      </template>
    </el-dialog>

    <!-- 本剧角色库 -->
    <el-dialog v-model="showCharLibrary" title="本剧角色库" width="720px" destroy-on-close class="library-dialog" @open="loadCharLibraryList">
      <div class="library-toolbar">
        <el-input v-model="charLibraryKeyword" placeholder="搜索名称或描述" clearable style="width: 200px" @input="debouncedLoadCharLibrary()" />
      </div>
      <div v-loading="charLibraryLoading" class="library-list">
        <div v-for="item in charLibraryList" :key="item.id" class="library-item">
          <div class="library-item-cover" @click="openImagePreview(assetImageUrl(item))">
            <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
            <span v-else class="library-item-placeholder">暂无图</span>
          </div>
          <div class="library-item-info">
            <div class="library-item-name">{{ item.name || '未命名' }}</div>
            <div class="library-item-desc">{{ (item.description || '').slice(0, 60) }}{{ (item.description || '').length > 60 ? '…' : '' }}</div>
            <div class="library-item-actions">
              <el-button size="small" type="primary" :loading="addingCharFromLibraryId === item.id" :disabled="!currentEpisodeId" @click="onAddCharFromLibrary(item)">加入本集</el-button>
              <el-button size="small" @click="openEditCharLibrary(item)">编辑</el-button>
              <el-button size="small" type="danger" plain @click="onDeleteCharLibrary(item)">删除</el-button>
            </div>
          </div>
        </div>
        <div v-if="!charLibraryLoading && charLibraryList.length === 0" class="library-empty">暂无本剧角色库记录，可将本剧角色「加入本剧库」后在此查看</div>
      </div>
      <div class="library-pagination">
        <el-pagination
          v-model:current-page="charLibraryPage"
          v-model:page-size="charLibraryPageSize"
          :total="charLibraryTotal"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="loadCharLibraryList"
          @size-change="loadCharLibraryList"
        />
      </div>
      <template #footer>
        <el-button @click="showCharLibrary = false">关闭</el-button>
      </template>
    </el-dialog>
    <!-- 编辑公共角色 -->
    <el-dialog v-model="showEditCharLibrary" title="编辑公共角色" width="440px" @close="editCharLibraryForm = null">
      <el-form v-if="editCharLibraryForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="editCharLibraryForm.name" placeholder="角色名称" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="editCharLibraryForm.category" placeholder="可选" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editCharLibraryForm.description" type="textarea" :rows="3" placeholder="可选" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="editCharLibraryForm.tags" placeholder="可选，逗号分隔" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditCharLibrary = false">取消</el-button>
        <el-button type="primary" :loading="editCharLibrarySaving" @click="submitEditCharLibrary">保存</el-button>
      </template>
    </el-dialog>

    <!-- 本剧道具库 -->
    <el-dialog v-model="showPropLibrary" title="本剧道具库" width="720px" destroy-on-close class="library-dialog" @open="loadPropLibraryList">
      <div class="library-toolbar">
        <el-input v-model="propLibraryKeyword" placeholder="搜索名称或描述" clearable style="width: 200px" @input="debouncedLoadPropLibrary()" />
      </div>
      <div v-loading="propLibraryLoading" class="library-list">
        <div v-for="item in propLibraryList" :key="item.id" class="library-item">
          <div class="library-item-cover" @click="openImagePreview(assetImageUrl(item))">
            <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
            <span v-else class="library-item-placeholder">暂无图</span>
          </div>
          <div class="library-item-info">
            <div class="library-item-name">{{ item.name || '未命名' }}</div>
            <div class="library-item-desc">{{ (item.description || item.prompt || '').slice(0, 60) }}{{ (item.description || item.prompt || '').length > 60 ? '…' : '' }}</div>
            <div class="library-item-actions">
              <el-button size="small" @click="openEditPropLibrary(item)">编辑</el-button>
              <el-button size="small" type="danger" plain @click="onDeletePropLibrary(item)">删除</el-button>
            </div>
          </div>
        </div>
        <div v-if="!propLibraryLoading && propLibraryList.length === 0" class="library-empty">暂无本剧道具库记录，可将本剧道具「加入本剧库」后在此查看</div>
      </div>
      <div class="library-pagination">
        <el-pagination
          v-model:current-page="propLibraryPage"
          v-model:page-size="propLibraryPageSize"
          :total="propLibraryTotal"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="loadPropLibraryList"
          @size-change="loadPropLibraryList"
        />
      </div>
      <template #footer>
        <el-button @click="showPropLibrary = false">关闭</el-button>
      </template>
    </el-dialog>
    <!-- 编辑公共道具 -->
    <el-dialog v-model="showEditPropLibrary" title="编辑公共道具" width="440px" @close="editPropLibraryForm = null">
      <el-form v-if="editPropLibraryForm" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="editPropLibraryForm.name" placeholder="道具名称" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="editPropLibraryForm.category" placeholder="可选" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editPropLibraryForm.description" type="textarea" :rows="3" placeholder="可选" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="editPropLibraryForm.tags" placeholder="可选，逗号分隔" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditPropLibrary = false">取消</el-button>
        <el-button type="primary" :loading="editPropLibrarySaving" @click="submitEditPropLibrary">保存</el-button>
      </template>
    </el-dialog>

    <!-- 本剧场景库 -->
    <el-dialog v-model="showSceneLibrary" title="本剧场景库" width="720px" destroy-on-close class="library-dialog" @open="loadSceneLibraryList">
      <div class="library-toolbar">
        <el-input v-model="sceneLibraryKeyword" placeholder="搜索地点或描述" clearable style="width: 200px" @input="debouncedLoadSceneLibrary()" />
      </div>
      <div v-loading="sceneLibraryLoading" class="library-list">
        <div v-for="item in sceneLibraryList" :key="item.id" class="library-item">
          <div class="library-item-cover" @click="openImagePreview(assetImageUrl(item))">
            <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
            <span v-else class="library-item-placeholder">暂无图</span>
          </div>
          <div class="library-item-info">
            <div class="library-item-name">{{ item.location || item.time || '未命名' }}</div>
            <div class="library-item-desc">{{ (item.description || item.prompt || '').slice(0, 60) }}{{ (item.description || item.prompt || '').length > 60 ? '…' : '' }}</div>
            <div class="library-item-actions">
              <el-button size="small" @click="openEditSceneLibrary(item)">编辑</el-button>
              <el-button size="small" type="danger" plain @click="onDeleteSceneLibrary(item)">删除</el-button>
            </div>
          </div>
        </div>
        <div v-if="!sceneLibraryLoading && sceneLibraryList.length === 0" class="library-empty">暂无本剧场景库记录，可将本剧场景「加入本剧库」后在此查看</div>
      </div>
      <div class="library-pagination">
        <el-pagination
          v-model:current-page="sceneLibraryPage"
          v-model:page-size="sceneLibraryPageSize"
          :total="sceneLibraryTotal"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="loadSceneLibraryList"
          @size-change="loadSceneLibraryList"
        />
      </div>
      <template #footer>
        <el-button @click="showSceneLibrary = false">关闭</el-button>
      </template>
    </el-dialog>
    <!-- 编辑公共场景 -->
    <el-dialog v-model="showEditSceneLibrary" title="编辑公共场景" width="440px" @close="editSceneLibraryForm = null">
      <el-form v-if="editSceneLibraryForm" label-width="80px">
        <el-form-item label="地点">
          <el-input v-model="editSceneLibraryForm.location" placeholder="场景地点" />
        </el-form-item>
        <el-form-item label="时间">
          <el-input v-model="editSceneLibraryForm.time" placeholder="如：白天/夜晚" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="editSceneLibraryForm.category" placeholder="可选" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editSceneLibraryForm.description" type="textarea" :rows="3" placeholder="可选" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="editSceneLibraryForm.tags" placeholder="可选，逗号分隔" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditSceneLibrary = false">取消</el-button>
        <el-button type="primary" :loading="editSceneLibrarySaving" @click="submitEditSceneLibrary">保存</el-button>
      </template>
    </el-dialog>

    <!-- AI 配置弹窗（不跳转，避免本页内容丢失） -->
    <el-dialog v-model="showAiConfigDialog" title="AI 配置" width="90%" destroy-on-close class="ai-config-dialog">
      <AIConfigContent v-if="showAiConfigDialog" />
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
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Setting, Plus, Minus, Sunny, Moon } from '@element-plus/icons-vue'
import { useTheme } from '@/composables/useTheme'
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
import { storyboardsAPI } from '@/api/storyboards'
import { uploadAPI } from '@/api/upload'
import { characterLibraryAPI } from '@/api/characterLibrary'
import { sceneLibraryAPI } from '@/api/sceneLibrary'
import { propLibraryAPI } from '@/api/propLibrary'
import AIConfigContent from '@/components/AIConfigContent.vue'

const route = useRoute()
const router = useRouter()
const store = useFilmStore()
const { isDark, toggle: toggleTheme } = useTheme()
const { videoResolution: storeVideoResolution } = storeToRefs(store)

function goList() {
  router.push('/')
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function scrollToAnchor(id) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const showAiConfigDialog = ref(false)
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
const generationStyle = ref('')
const projectAspectRatio = ref('16:9')
const videoClipDuration = ref(5)
const generationStyleOptions = [
  { label: '日本动漫', value: 'anime style' },
  { label: '写实', value: 'realistic' },
  { label: '电影感', value: 'cinematic' },
  { label: '赛博朋克', value: 'cyberpunk' },
  { label: '水彩', value: 'watercolor' },
  { label: '油画', value: 'oil painting' },
  { label: '3D 渲染', value: '3d render' },
  { label: '像素风', value: 'pixel art' }
]
const scriptContent = computed({
  get: () => store.scriptContent,
  set: (v) => store.setScriptContent(v)
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
/** 当前集合成视频的播放地址（用于按钮下方预览） */
const currentEpisodeVideoUrl = computed(() => {
  const url = currentEpisode.value?.video_url
  if (!url || !String(url).trim()) return ''
  const s = String(url).trim()
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  return '/static/' + s.replace(/^\//, '')
})

const charactersGenerating = ref(false)
const generatingCharId = ref(null)
const generatingPropId = ref(null)
const generatingSceneId = ref(null)
const propsExtracting = ref(false)
const scenesExtracting = ref(false)
const storyboardGenerating = ref(false)
const videoErrorMsg = ref('')
// 一键生成视频流水线
const pipelineRunning = ref(false)
const pipelinePaused = ref(false)
const pipelineErrorLog = ref([])
const pipelineCurrentStep = ref('')
let pipelineResolveResume = null
const showAddProp = ref(false)
const addPropSaving = ref(false)
const addPropForm = ref({ name: '', type: '', description: '', prompt: '' })

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
const storyboardMenuExpanded = ref(false)
const navCollapsed = ref(false)
const sbCharacterIds = ref({})  // sbId -> number[] 多选角色
const sbPropIds = ref({})       // sbId -> number[] 多选物品
const sbSceneId = ref({})
const sbDialogue = ref({})
const sbShotType = ref({})
/** 视频提示词组成（可编辑），key 为分镜 id */
const sbTitle = ref({})
const sbLocation = ref({})
const sbTime = ref({})
const sbDuration = ref({})
const sbAction = ref({})
const sbResult = ref({})
const sbAtmosphere = ref({})
const sbAngle = ref({})
const sbMovement = ref({})
// 分镜图片/视频列表（由 /images?storyboard_id=xx 和 /videos?storyboard_id=xx 拉取）
const sbImages = ref({})
const sbVideos = ref({})
const sbVideoErrors = ref({})
const generatingSbImageId = ref(null)
const generatingSbVideoId = ref(null)
/** 正在编辑视频提示词的分镜 id；编辑中显示文本框与保存/取消 */
const editingSbVideoPromptId = ref(null)
const editingSbVideoPromptText = ref('')
/** 正在编辑图片提示词的分镜 id */
const editingSbImagePromptId = ref(null)
const editingSbImagePromptText = ref('')
const uploadingSbImageId = ref(null)
const sbImageFileInput = ref(null)
const sbImageUploadForId = ref(null)
// 角色/道具/场景 上传图片
const resourceImageFileInput = ref(null)
const resourceUploadType = ref(null) // 'character' | 'prop' | 'scene'
const resourceUploadId = ref(null)
const uploadingResourceId = ref(null) // 'char-1' | 'prop-2' | 'scene-3'
const dragOverResourceKey = ref(null) // 'char-1' | 'prop-2' | 'scene-3'
const dragOverSbId = ref(null)
// 公共库弹窗
const showCharLibrary = ref(false)
const showPropLibrary = ref(false)
const showSceneLibrary = ref(false)
const charLibraryList = ref([])
const charLibraryLoading = ref(false)
const charLibraryPage = ref(1)
const charLibraryPageSize = ref(20)
const charLibraryTotal = ref(0)
const charLibraryKeyword = ref('')
const storyboardCount = ref(null) // 分镜数量
const videoDuration = ref(null) // 视频总长度
const showEditCharLibrary = ref(false)
const editCharLibraryForm = ref(null)
const editCharLibrarySaving = ref(false)
const addingCharToLibraryId = ref(null)
const addingCharToMaterialId = ref(null)
const addingCharFromLibraryId = ref(null)
const addingPropToLibraryId = ref(null)
const addingPropToMaterialId = ref(null)
const addingSceneToLibraryId = ref(null)
const addingSceneToMaterialId = ref(null)
// 公共道具库
const propLibraryList = ref([])
const propLibraryLoading = ref(false)
const propLibraryPage = ref(1)
const propLibraryPageSize = ref(20)
const propLibraryTotal = ref(0)
const propLibraryKeyword = ref('')
const showEditPropLibrary = ref(false)
const editPropLibraryForm = ref(null)
const editPropLibrarySaving = ref(false)
let propLibraryKeywordTimer = null
// 公共场景库
const sceneLibraryList = ref([])
const sceneLibraryLoading = ref(false)
const sceneLibraryPage = ref(1)
const sceneLibraryPageSize = ref(20)
const sceneLibraryTotal = ref(0)
const sceneLibraryKeyword = ref('')
const showEditSceneLibrary = ref(false)
const editSceneLibraryForm = ref(null)
const editSceneLibrarySaving = ref(false)
let sceneLibraryKeywordTimer = null
let charLibraryKeywordTimer = null

function getFirstImageFile(dataTransfer) {
  if (!dataTransfer?.files?.length) return null
  const file = Array.from(dataTransfer.files).find((f) => f.type.startsWith('image/'))
  return file || null
}
function onResourceDragOver(e, type, id) {
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  const key = type === 'character' ? 'char-' : type === 'prop' ? 'prop-' : 'scene-'
  dragOverResourceKey.value = key + id
}
function onResourceDragLeave(e, key) {
  e.preventDefault()
  if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return
  if (key && dragOverResourceKey.value !== key) return
  dragOverResourceKey.value = null
}
function onResourceDrop(e, type, id) {
  e.preventDefault()
  e.stopPropagation()
  dragOverResourceKey.value = null
  const file = getFirstImageFile(e.dataTransfer)
  if (file) doUploadResourceImage(type, id, file)
}
function onSbImageDragOver(e, sbId) {
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  dragOverSbId.value = sbId
}
function onSbImageDragLeave(e, sbId) {
  e.preventDefault()
  if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return
  if (sbId != null && dragOverSbId.value !== sbId) return
  dragOverSbId.value = null
}
function onSbImageDrop(e, sb) {
  e.preventDefault()
  e.stopPropagation()
  dragOverSbId.value = null
  const file = getFirstImageFile(e.dataTransfer)
  if (file && sb?.id) doUploadSbImage(sb.id, file)
}

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
function getSelectedStyle() {
  const value = (generationStyle.value || '').toString().trim()
  return value || undefined
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
/** 取该分镜最近一次视频生成的错误信息（从 API 返回的记录或本地即时错误） */
function getSbVideoError(storyboardId) {
  if (sbVideoErrors.value[storyboardId]) return sbVideoErrors.value[storyboardId]
  const list = sbVideos.value[storyboardId]
  if (!Array.isArray(list) || list.length === 0) return ''
  const hasCompleted = list.some((i) => i.status === 'completed' && (i.video_url || i.local_path))
  if (hasCompleted) return ''
  const failed = list.filter((i) => i.status === 'failed' && i.error_msg)
  if (failed.length === 0) return ''
  return failed[0].error_msg
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
  sb.errorMsg = ''
  sb.error_msg = ''
  generatingSbImageId.value = sb.id
  try {
    const res = await imagesAPI.create({
      storyboard_id: sb.id,
      drama_id: dramaId.value,
      prompt: sb.image_prompt || sb.description || '',
      model: undefined,
      style: getSelectedStyle()
    })
    ElMessage.success('分镜图生成任务已提交')
    if (res?.task_id) {
      const pollRes = await pollTask(res.task_id, () => loadStoryboardMedia())
      if (pollRes?.status === 'failed') {
        sb.errorMsg = pollRes.error || '生成失败'
      } else {
        ElMessage.success('分镜图生成完成')
      }
    } else {
      await loadStoryboardMedia()
    }
  } catch (e) {
    console.error(e)
    sb.errorMsg = e.message || '生成失败'
    ElMessage.error(e.message || '生成失败')
  } finally {
    generatingSbImageId.value = null
  }
}

function onUploadSbImageClick(sb) {
  if (!sb?.id) return
  sbImageUploadForId.value = sb.id
  if (sbImageFileInput.value) {
    sbImageFileInput.value.value = ''
    sbImageFileInput.value.click()
  }
}

async function doUploadSbImage(sbId, file) {
  if (!file || !sbId || !dramaId.value) return
  uploadingSbImageId.value = sbId
  try {
    const res = await uploadAPI.uploadImage(file)
    const url = res?.url || res?.path
    const localPath = res?.local_path
    if (!url && !localPath) {
      ElMessage.error('上传未返回地址')
      return
    }
    await imagesAPI.upload({
      storyboard_id: sbId,
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
  }
}

function onSbImageFileChange(ev) {
  const file = ev.target?.files?.[0]
  const sid = sbImageUploadForId.value
  if (!file || !sid) {
    ev.target.value = ''
    return
  }
  doUploadSbImage(sid, file).finally(() => {
    sbImageUploadForId.value = null
    ev.target.value = ''
  })
}

function syncStoryboardStateFromEpisode(ep) {
  const boards = ep?.storyboards || []
  const nextCharIds = {}
  const nextPropIds = {}
  const nextScene = {}
  const nextDialogue = {}
  const nextShot = {}
  const nextTitle = {}
  const nextLocation = {}
  const nextTime = {}
  const nextDuration = {}
  const nextAction = {}
  const nextResult = {}
  const nextAtmosphere = {}
  const nextAngle = {}
  const nextMovement = {}
  for (const sb of boards) {
    nextScene[sb.id] = sb.scene_id ?? null
    nextDialogue[sb.id] = sb.dialogue ?? ''
    nextShot[sb.id] = (sb.shot_type ?? '').toString() || ''
    nextTitle[sb.id] = (sb.title ?? '').toString()
    nextLocation[sb.id] = (sb.location ?? '').toString()
    nextTime[sb.id] = (sb.time ?? '').toString()
    nextDuration[sb.id] = sb.duration != null ? Number(sb.duration) : 5
    nextAction[sb.id] = (sb.action ?? '').toString()
    nextResult[sb.id] = (sb.result ?? '').toString()
    nextAtmosphere[sb.id] = (sb.atmosphere ?? '').toString()
    nextAngle[sb.id] = (sb.angle ?? '').toString()
    nextMovement[sb.id] = (sb.movement ?? '').toString()
    const charList = Array.isArray(sb.characters) ? sb.characters : (sb.characters != null ? [sb.characters] : [])
    nextCharIds[sb.id] = charList.map((c) => (typeof c === 'object' && c != null ? Number(c.id) : Number(c))).filter((n) => Number.isFinite(n))
    nextPropIds[sb.id] = Array.isArray(sb.prop_ids) ? sb.prop_ids : []
  }
  sbCharacterIds.value = nextCharIds
  sbPropIds.value = nextPropIds
  sbSceneId.value = nextScene
  sbDialogue.value = nextDialogue
  sbShotType.value = nextShot
  sbTitle.value = nextTitle
  sbLocation.value = nextLocation
  sbTime.value = nextTime
  sbDuration.value = nextDuration
  sbAction.value = nextAction
  sbResult.value = nextResult
  sbAtmosphere.value = nextAtmosphere
  sbAngle.value = nextAngle
  sbMovement.value = nextMovement
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
    // 恢复「故事生成」框的梗概（项目 description 存的是故事梗概）
    storyInput.value = (d.description || '').toString().trim()
    storyStyle.value = (d.metadata && d.metadata.story_style) ? d.metadata.story_style : ''
    storyType.value = d.genre || ''
    generationStyle.value = d.style || ''
    projectAspectRatio.value = (d.metadata && d.metadata.aspect_ratio) ? d.metadata.aspect_ratio : '16:9'
    videoClipDuration.value = (d.metadata && d.metadata.video_clip_duration) ? Number(d.metadata.video_clip_duration) : 5
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

/** 将当前剧本内容保存到后端（创建/更新项目与集数），供「保存剧本」与「AI 生成」后自动保存共用 */
async function saveScriptToBackend(content) {
  const trimmed = (content ?? '').toString().trim()
  if (!trimmed) return
  let dramaId = store.dramaId
  const curEp = store.currentEpisode
  if (!dramaId) {
    const drama = await dramaAPI.create({
      title: scriptTitle.value || '新故事',
      description: storyInput.value?.trim() || trimmed.slice(0, 200),
      genre: storyType.value || undefined,
      style: generationStyle.value || undefined,
      metadata: { story_style: storyStyle.value || undefined, aspect_ratio: projectAspectRatio.value || '16:9' }
    })
    store.setDrama(drama)
    dramaId = drama.id
    savedCurrentEpisodeNumber.value = 1
    const episodes = [{ episode_number: 1, title: scriptTitle.value || '第1集', script_content: trimmed }]
    await dramaAPI.saveEpisodes(dramaId, episodes)
    await loadDrama()
    if (route.params.id === 'new') {
      router.replace('/film/' + dramaId)
    }
    return { created: true }
  }
  const episodes = store.drama?.episodes || []
  savedCurrentEpisodeNumber.value = curEp?.episode_number ?? 1
  const updated = episodes.map((ep, i) => {
    const num = ep.episode_number ?? i + 1
    const isCurrent = curEp && Number(ep.id) === Number(curEp.id)
    return {
      episode_number: num,
      title: isCurrent ? (scriptTitle.value || '第' + num + '集') : (ep.title || ''),
      script_content: isCurrent ? trimmed : (ep.script_content || ''),
      description: ep.description,
      duration: ep.duration
    }
  })
  if (updated.length === 0) {
    updated.push({ episode_number: 1, title: scriptTitle.value || '第1集', script_content: trimmed })
  }
  await dramaAPI.saveEpisodes(dramaId, updated)
  if (storyInput.value?.trim()) {
    await dramaAPI.saveOutline(dramaId, {
      summary: storyInput.value.trim(),
      genre: storyType.value || undefined,
      style: generationStyle.value || undefined,
      metadata: { story_style: storyStyle.value || undefined, aspect_ratio: projectAspectRatio.value || '16:9' }
    }).catch(() => {})
  }
  await loadDrama()
  return { created: false }
}

async function saveProjectSettings() {
  if (!store.dramaId) return
  dramaAPI.saveOutline(store.dramaId, {
    genre: storyType.value || undefined,
    style: generationStyle.value || undefined,
    metadata: {
      story_style: storyStyle.value || undefined,
      aspect_ratio: projectAspectRatio.value || '16:9',
      video_clip_duration: videoClipDuration.value || 5,
    }
  }).catch(e => console.error('Settings auto-save failed', e))
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
    scriptGenerating.value = true
    try {
      const result = await saveScriptToBackend(content)
      if (result?.created) {
        ElMessage.success('剧本已生成，项目已创建并保存第1集')
      } else {
        ElMessage.success('剧本已生成并已保存当前集')
      }
      // 把当前故事梗概保存到项目，下次打开可恢复
      if (store.dramaId && text) {
        await dramaAPI.saveOutline(store.dramaId, {
          summary: text,
          genre: storyType.value || undefined,
          style: generationStyle.value || undefined,
          metadata: { story_style: storyStyle.value || undefined, aspect_ratio: projectAspectRatio.value || '16:9' }
        }).catch(() => {})
      }
    } catch (e) {
      ElMessage.error(e.message || '保存剧本失败')
    } finally {
      scriptGenerating.value = false
    }
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
    const result = await saveScriptToBackend(content)
    if (result?.created) {
      ElMessage.success('项目已创建，剧本已保存')
    } else {
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

function openAddCharacter() {
  editCharacterForm.value = {
    name: '',
    role: '',
    appearance: '',
    personality: '',
    description: ''
  }
  showEditCharacter.value = true
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
  const form = editCharacterForm.value
  if (!form?.name?.trim() || !store.dramaId) return
  editCharacterSaving.value = true
  try {
    if (form.id) {
      await characterAPI.update(form.id, {
        name: form.name.trim(),
        role: form.role || undefined,
        appearance: form.appearance || undefined,
        personality: form.personality || undefined,
        description: form.description || undefined
      })
      ElMessage.success('角色已保存')
    } else {
      const existing = (store.drama?.characters || []).map((c) => ({
        id: c.id,
        name: c.name || '',
        role: c.role || undefined,
        description: c.description || undefined,
        personality: c.personality || undefined,
        appearance: c.appearance || undefined,
        image_url: c.image_url || undefined
      }))
      await dramaAPI.saveCharacters(store.dramaId, {
        characters: [...existing, { name: form.name.trim(), role: form.role || undefined, appearance: form.appearance || undefined, personality: form.personality || undefined, description: form.description || undefined }],
        episode_id: currentEpisodeId.value ?? undefined
      })
      ElMessage.success('角色已添加')
    }
    await loadDrama()
    showEditCharacter.value = false
  } catch (e) {
    ElMessage.error(e.message || (form.id ? '保存失败' : '添加失败'))
  } finally {
    editCharacterSaving.value = false
  }
}

function onUploadResourceClick(type, id) {
  resourceUploadType.value = type
  resourceUploadId.value = id
  resourceImageFileInput.value?.click()
}

async function doUploadResourceImage(type, id, file) {
  if (!file || !type || id == null) return
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
      await characterAPI.putImage(id, { image_url: url, local_path: null })
    } else if (type === 'prop') {
      await propAPI.update(id, { image_url: url, local_path: null })
    } else if (type === 'scene') {
      await sceneAPI.update(id, { image_url: url, local_path: null })
    }
    await loadDrama()
    ElMessage.success('上传成功')
  } catch (e) {
    ElMessage.error(e.message || '上传失败')
  } finally {
    uploadingResourceId.value = null
  }
}

function onResourceImageFileChange(ev) {
  const file = ev.target?.files?.[0]
  const type = resourceUploadType.value
  const id = resourceUploadId.value
  if (!file || !type || id == null) {
    ev.target.value = ''
    return
  }
  doUploadResourceImage(type, id, file).finally(() => {
    resourceUploadType.value = null
    resourceUploadId.value = null
    ev.target.value = ''
  })
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

async function loadCharLibraryList() {
  charLibraryLoading.value = true
  try {
    const res = await characterLibraryAPI.list({
      drama_id: dramaId.value,
      page: charLibraryPage.value,
      page_size: charLibraryPageSize.value,
      keyword: charLibraryKeyword.value || undefined
    })
    charLibraryList.value = res?.items ?? []
    const pagination = res?.pagination ?? {}
    charLibraryTotal.value = pagination.total ?? 0
    if (pagination.page != null) charLibraryPage.value = pagination.page
    if (pagination.page_size != null) charLibraryPageSize.value = pagination.page_size
  } catch (e) {
    charLibraryList.value = []
  } finally {
    charLibraryLoading.value = false
  }
}
function debouncedLoadCharLibrary() {
  if (charLibraryKeywordTimer) clearTimeout(charLibraryKeywordTimer)
  charLibraryKeywordTimer = setTimeout(() => {
    charLibraryPage.value = 1
    loadCharLibraryList()
  }, 300)
}
function openEditCharLibrary(item) {
  editCharLibraryForm.value = {
    id: item.id,
    name: item.name ?? '',
    category: item.category ?? '',
    description: item.description ?? '',
    tags: item.tags ?? ''
  }
  showEditCharLibrary.value = true
}
async function submitEditCharLibrary() {
  if (!editCharLibraryForm.value?.id) return
  editCharLibrarySaving.value = true
  try {
    await characterLibraryAPI.update(editCharLibraryForm.value.id, {
      name: editCharLibraryForm.value.name,
      category: editCharLibraryForm.value.category || null,
      description: editCharLibraryForm.value.description || null,
      tags: editCharLibraryForm.value.tags || null
    })
    ElMessage.success('已保存')
    showEditCharLibrary.value = false
    loadCharLibraryList()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    editCharLibrarySaving.value = false
  }
}
async function onDeleteCharLibrary(item) {
  try {
    await ElMessageBox.confirm(`确定删除公共角色「${(item.name || '未命名').slice(0, 20)}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    await characterLibraryAPI.delete(item.id)
    ElMessage.success('已删除')
    loadCharLibraryList()
  } catch (e) {
    if (e === 'cancel') return
    ElMessage.error(e.message || '删除失败')
  }
}

async function onAddCharacterToLibrary(char) {
  if (!hasAssetImage(char)) { ElMessage.warning('请先为该角色生成或上传图片'); return }
  addingCharToLibraryId.value = char.id
  try {
    await characterAPI.addToLibrary(char.id, {})
    ElMessage.success('已加入本剧角色库')
    if (showCharLibrary.value) loadCharLibraryList()
  } catch (e) {
    ElMessage.error(e.message || '加入失败')
  } finally {
    addingCharToLibraryId.value = null
  }
}
async function onAddCharacterToMaterialLibrary(char) {
  if (!hasAssetImage(char)) { ElMessage.warning('请先为该角色生成或上传图片'); return }
  addingCharToMaterialId.value = char.id
  try {
    await characterAPI.addToMaterialLibrary(char.id)
    ElMessage.success('已加入全局素材库')
  } catch (e) {
    ElMessage.error(e.message || '加入失败')
  } finally {
    addingCharToMaterialId.value = null
  }
}

// 从本剧角色库加入本集
async function onAddCharFromLibrary(item) {
  if (!store.dramaId) return
  addingCharFromLibraryId.value = item.id
  try {
    const existing = (store.characters || []).map((c) => ({
      name: c.name || '',
      role: c.role || undefined,
      appearance: c.appearance || undefined,
      personality: c.personality || undefined,
      description: c.description || undefined,
      image_url: c.image_url || undefined,
    }))
    await dramaAPI.saveCharacters(store.dramaId, {
      characters: [...existing, {
        name: item.name || '未命名',
        description: item.description || undefined,
        appearance: item.description || undefined,
        image_url: item.image_url || undefined,
      }],
      episode_id: currentEpisodeId.value ?? undefined,
    })
    await loadDrama()
    ElMessage.success(`「${item.name || '角色'}」已加入本集`)
  } catch (e) {
    ElMessage.error(e.message || '加入失败')
  } finally {
    addingCharFromLibraryId.value = null
  }
}

async function loadPropLibraryList() {
  propLibraryLoading.value = true
  try {
    const res = await propLibraryAPI.list({
      drama_id: dramaId.value,
      page: propLibraryPage.value,
      page_size: propLibraryPageSize.value,
      keyword: propLibraryKeyword.value || undefined
    })
    propLibraryList.value = res?.items ?? []
    const pagination = res?.pagination ?? {}
    propLibraryTotal.value = pagination.total ?? 0
    if (pagination.page != null) propLibraryPage.value = pagination.page
    if (pagination.page_size != null) propLibraryPageSize.value = pagination.page_size
  } catch (e) {
    propLibraryList.value = []
  } finally {
    propLibraryLoading.value = false
  }
}
function debouncedLoadPropLibrary() {
  if (propLibraryKeywordTimer) clearTimeout(propLibraryKeywordTimer)
  propLibraryKeywordTimer = setTimeout(() => {
    propLibraryPage.value = 1
    loadPropLibraryList()
  }, 300)
}
function openEditPropLibrary(item) {
  editPropLibraryForm.value = {
    id: item.id,
    name: item.name ?? '',
    category: item.category ?? '',
    description: item.description ?? '',
    tags: item.tags ?? ''
  }
  showEditPropLibrary.value = true
}
async function submitEditPropLibrary() {
  if (!editPropLibraryForm.value?.id) return
  editPropLibrarySaving.value = true
  try {
    await propLibraryAPI.update(editPropLibraryForm.value.id, {
      name: editPropLibraryForm.value.name,
      category: editPropLibraryForm.value.category || null,
      description: editPropLibraryForm.value.description || null,
      tags: editPropLibraryForm.value.tags || null
    })
    ElMessage.success('已保存')
    showEditPropLibrary.value = false
    loadPropLibraryList()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    editPropLibrarySaving.value = false
  }
}
async function onDeletePropLibrary(item) {
  try {
    await ElMessageBox.confirm(`确定删除公共道具「${(item.name || '未命名').slice(0, 20)}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    await propLibraryAPI.delete(item.id)
    ElMessage.success('已删除')
    loadPropLibraryList()
  } catch (e) {
    if (e === 'cancel') return
    ElMessage.error(e.message || '删除失败')
  }
}
async function onAddPropToLibrary(prop) {
  if (!hasAssetImage(prop)) { ElMessage.warning('请先为该道具生成或上传图片'); return }
  addingPropToLibraryId.value = prop.id
  try {
    await propAPI.addToLibrary(prop.id, {})
    ElMessage.success('已加入本剧道具库')
    if (showPropLibrary.value) loadPropLibraryList()
  } catch (e) {
    ElMessage.error(e.message || '加入失败')
  } finally {
    addingPropToLibraryId.value = null
  }
}
async function onAddPropToMaterialLibrary(prop) {
  if (!hasAssetImage(prop)) { ElMessage.warning('请先为该道具生成或上传图片'); return }
  addingPropToMaterialId.value = prop.id
  try {
    await propAPI.addToMaterialLibrary(prop.id)
    ElMessage.success('已加入全局素材库')
  } catch (e) {
    ElMessage.error(e.message || '加入失败')
  } finally {
    addingPropToMaterialId.value = null
  }
}

async function loadSceneLibraryList() {
  sceneLibraryLoading.value = true
  try {
    const res = await sceneLibraryAPI.list({
      drama_id: dramaId.value,
      page: sceneLibraryPage.value,
      page_size: sceneLibraryPageSize.value,
      keyword: sceneLibraryKeyword.value || undefined
    })
    sceneLibraryList.value = res?.items ?? []
    const pagination = res?.pagination ?? {}
    sceneLibraryTotal.value = pagination.total ?? 0
    if (pagination.page != null) sceneLibraryPage.value = pagination.page
    if (pagination.page_size != null) sceneLibraryPageSize.value = pagination.page_size
  } catch (e) {
    sceneLibraryList.value = []
  } finally {
    sceneLibraryLoading.value = false
  }
}
function debouncedLoadSceneLibrary() {
  if (sceneLibraryKeywordTimer) clearTimeout(sceneLibraryKeywordTimer)
  sceneLibraryKeywordTimer = setTimeout(() => {
    sceneLibraryPage.value = 1
    loadSceneLibraryList()
  }, 300)
}
function openEditSceneLibrary(item) {
  editSceneLibraryForm.value = {
    id: item.id,
    location: item.location ?? '',
    time: item.time ?? '',
    category: item.category ?? '',
    description: item.description ?? '',
    tags: item.tags ?? ''
  }
  showEditSceneLibrary.value = true
}
async function submitEditSceneLibrary() {
  if (!editSceneLibraryForm.value?.id) return
  editSceneLibrarySaving.value = true
  try {
    await sceneLibraryAPI.update(editSceneLibraryForm.value.id, {
      location: editSceneLibraryForm.value.location,
      time: editSceneLibraryForm.value.time || null,
      category: editSceneLibraryForm.value.category || null,
      description: editSceneLibraryForm.value.description || null,
      tags: editSceneLibraryForm.value.tags || null
    })
    ElMessage.success('已保存')
    showEditSceneLibrary.value = false
    loadSceneLibraryList()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    editSceneLibrarySaving.value = false
  }
}
async function onDeleteSceneLibrary(item) {
  try {
    const name = (item.location || item.time || '未命名').slice(0, 20)
    await ElMessageBox.confirm(`确定删除公共场景「${name}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    await sceneLibraryAPI.delete(item.id)
    ElMessage.success('已删除')
    loadSceneLibraryList()
  } catch (e) {
    if (e === 'cancel') return
    ElMessage.error(e.message || '删除失败')
  }
}
async function onAddSceneToLibrary(scene) {
  if (!hasAssetImage(scene)) { ElMessage.warning('请先为该场景生成或上传图片'); return }
  addingSceneToLibraryId.value = scene.id
  try {
    await sceneAPI.addToLibrary(scene.id, {})
    ElMessage.success('已加入本剧场景库')
    if (showSceneLibrary.value) loadSceneLibraryList()
  } catch (e) {
    ElMessage.error(e.message || '加入失败')
  } finally {
    addingSceneToLibraryId.value = null
  }
}
async function onAddSceneToMaterialLibrary(scene) {
  if (!hasAssetImage(scene)) { ElMessage.warning('请先为该场景生成或上传图片'); return }
  addingSceneToMaterialId.value = scene.id
  try {
    await sceneAPI.addToMaterialLibrary(scene.id)
    ElMessage.success('已加入全局素材库')
  } catch (e) {
    ElMessage.error(e.message || '加入失败')
  } finally {
    addingSceneToMaterialId.value = null
  }
}

async function onGenerateCharacterImage(char) {
  char.errorMsg = ''
  char.error_msg = ''
  generatingCharId.value = char.id
  try {
    const res = await characterAPI.generateImage(char.id, undefined, getSelectedStyle())
    const taskId = res?.image_generation?.task_id ?? res?.task_id
    if (taskId) {
      const pollRes = await pollTask(taskId, () => loadDrama())
      if (pollRes?.status === 'failed') {
        char.errorMsg = pollRes.error || '生成失败'
      } else {
        ElMessage.success('角色图片已生成')
      }
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
    console.error(e)
    char.errorMsg = e.message || '生成失败'
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
  propsExtracting.value = true
  try {
    const res = await propAPI.extractFromScript(currentEpisodeId.value)
    const taskId = res?.task_id
    if (taskId) {
      const pollRes = await pollTask(taskId, () => loadDrama())
      if (pollRes?.status !== 'failed') {
        ElMessage.success('道具提取完成')
      }
    } else {
      await loadDrama()
      ElMessage.success('道具提取任务已提交')
    }
  } catch (e) {
    ElMessage.error(e.message || '提取失败')
  } finally {
    propsExtracting.value = false
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
  prop.errorMsg = ''
  prop.error_msg = ''
  generatingPropId.value = prop.id
  try {
    const model = undefined
    const res = await propAPI.generateImage(prop.id, model, getSelectedStyle())
    const taskId = res?.task_id
    if (taskId) {
      const pollRes = await pollTask(taskId, () => loadDrama())
      if (pollRes?.status === 'failed') {
        prop.errorMsg = pollRes.error || '生成失败'
      } else {
        ElMessage.success('道具图片已生成')
      }
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
    console.error(e)
    prop.errorMsg = e.message || '生成失败'
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
      model: undefined,
      style: getSelectedStyle(),
      language: scriptLanguage.value
    })
    const taskId = res?.task_id
    if (taskId) {
      const pollRes = await pollTask(taskId, () => loadDrama())
      if (pollRes?.status !== 'failed') {
        ElMessage.success('场景提取完成')
      }
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

function openAddScene() {
  editSceneForm.value = {
    location: '',
    time: '',
    prompt: ''
  }
  showEditScene.value = true
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
  const form = editSceneForm.value
  if (!form?.location?.trim() || !store.dramaId) return
  editSceneSaving.value = true
  try {
    if (form.id) {
      await sceneAPI.update(form.id, {
        location: form.location.trim(),
        time: form.time || undefined,
        prompt: form.prompt || undefined
      })
      ElMessage.success('场景已保存')
    } else {
      await sceneAPI.create({
        drama_id: store.dramaId,
        location: form.location.trim(),
        time: form.time || undefined,
        prompt: form.prompt || undefined
      })
      ElMessage.success('场景已添加')
    }
    await loadDrama()
    showEditScene.value = false
  } catch (e) {
    ElMessage.error(e.message || (form.id ? '保存失败' : '添加失败'))
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
  scene.errorMsg = ''
  scene.error_msg = ''
  generatingSceneId.value = scene.id
  try {
    const res = await sceneAPI.generateImage({
      scene_id: scene.id,
      model: undefined,
      style: getSelectedStyle()
    })
    const taskId = res?.image_generation?.task_id ?? res?.task_id
    if (taskId) {
      const pollRes = await pollTask(taskId, () => loadDrama())
      if (pollRes?.status === 'failed') {
        scene.errorMsg = pollRes.error || '生成失败'
      } else {
        ElMessage.success('场景图片已生成')
      }
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
    console.error(e)
    scene.errorMsg = e.message || '生成失败'
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

function onEditSbImagePrompt(sb) {
  if (!sb?.id) return
  editingSbImagePromptId.value = sb.id
  editingSbImagePromptText.value = (sb.image_prompt || '').toString()
}

async function onSaveSbImagePrompt(sb) {
  if (!sb?.id) return
  try {
    await storyboardsAPI.update(sb.id, { image_prompt: (editingSbImagePromptText.value || '').toString().trim() || null })
    await loadDrama()
    editingSbImagePromptId.value = null
    ElMessage.success('图片提示词已保存')
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}

function onEditSbVideoPrompt(sb) {
  if (!sb?.id) return
  editingSbVideoPromptId.value = sb.id
  editingSbVideoPromptText.value = (sb.video_prompt || '').toString()
}

/** 根据当前分镜的「视频提示词组成」字段拼出完整 video_prompt 文案（与后端 generateVideoPrompt 顺序一致） */
function buildVideoPromptFromFields(sbId) {
  const parts = []
  const loc = (sbLocation.value[sbId] || '').toString().trim()
  const time = (sbTime.value[sbId] || '').toString().trim()
  if (loc) parts.push('Scene: ' + (time ? loc + ', ' + time : loc))
  const title = (sbTitle.value[sbId] || '').toString().trim()
  if (title) parts.push('Title: ' + title)
  const action = (sbAction.value[sbId] || '').toString().trim()
  if (action) parts.push('Action: ' + action)
  const dialogue = (sbDialogue.value[sbId] || '').toString().trim()
  if (dialogue) parts.push('Dialogue: ' + dialogue)
  const shotType = (sbShotType.value[sbId] || '').toString().trim()
  if (shotType) parts.push('Shot type: ' + shotType)
  const angle = (sbAngle.value[sbId] || '').toString().trim()
  if (angle) parts.push('Camera angle: ' + angle)
  const movement = (sbMovement.value[sbId] || '').toString().trim()
  if (movement) parts.push('Camera movement: ' + movement)
  const atmosphere = (sbAtmosphere.value[sbId] || '').toString().trim()
  if (atmosphere) parts.push('Atmosphere: ' + atmosphere)
  const result = (sbResult.value[sbId] || '').toString().trim()
  if (result) parts.push('Result: ' + result)
  const duration = Number(sbDuration.value[sbId])
  const sec = Number.isFinite(duration) && duration > 0 ? duration : 5
  parts.push('Duration: ' + sec + ' seconds')
  return parts.length ? parts.join('. ') : 'Video scene'
}

async function onSaveSbVideoFields(sb) {
  if (!sb?.id) return
  try {
    const video_prompt = buildVideoPromptFromFields(sb.id)
    await storyboardsAPI.update(sb.id, {
      title: (sbTitle.value[sb.id] || '').toString().trim() || null,
      location: (sbLocation.value[sb.id] || '').toString().trim() || null,
      time: (sbTime.value[sb.id] || '').toString().trim() || null,
      duration: Number(sbDuration.value[sb.id]) || 5,
      action: (sbAction.value[sb.id] || '').toString().trim() || null,
      dialogue: (sbDialogue.value[sb.id] || '').toString().trim() || null,
      atmosphere: (sbAtmosphere.value[sb.id] || '').toString().trim() || null,
      result: (sbResult.value[sb.id] || '').toString().trim() || null,
      angle: (sbAngle.value[sb.id] || '').toString().trim() || null,
      movement: (sbMovement.value[sb.id] || '').toString().trim() || null,
      shot_type: (sbShotType.value[sb.id] || '').toString().trim() || null,
      video_prompt
    })
    await loadDrama()
    ElMessage.success('已保存并更新视频提示词')
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}

async function onSaveSbVideoPrompt(sb) {
  if (!sb?.id) return
  try {
    await storyboardsAPI.update(sb.id, { video_prompt: (editingSbVideoPromptText.value || '').toString().trim() || null })
    await loadDrama()
    editingSbVideoPromptId.value = null
    ElMessage.success('视频提示词已保存')
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}

async function onGenerateSbVideo(sb) {
  if (!dramaId.value || !sb?.id || !sb.video_prompt) return
  const firstFrameUrl = getSbFirstFrameUrl(sb)
  if (!firstFrameUrl) {
    ElMessage.warning('请先生成或上传该分镜的图片，再生成视频')
    return
  }
  generatingSbVideoId.value = sb.id
  sbVideoErrors.value[sb.id] = ''
  try {
    const absoluteUrl = toAbsoluteImageUrl(firstFrameUrl)
    const res = await videosAPI.create({
      drama_id: dramaId.value,
      storyboard_id: sb.id,
      prompt: sb.video_prompt,
      image_url: absoluteUrl || undefined,
      reference_image_urls: absoluteUrl ? [absoluteUrl] : undefined,
      model: undefined,
      style: getSelectedStyle(),
      aspect_ratio: projectAspectRatio.value,
      resolution: videoResolution.value || undefined,
      duration: videoClipDuration.value || undefined,
    })
    if (res?.task_id) {
      const pollRes = await pollTask(res.task_id, () => loadStoryboardMedia())
      if (pollRes?.status === 'failed') {
        sbVideoErrors.value[sb.id] = pollRes.error || '视频生成失败'
      } else if (pollRes?.status === 'completed') {
        sbVideoErrors.value[sb.id] = ''
        ElMessage.success('视频生成完成')
      }
    } else {
      await loadStoryboardMedia()
      ElMessage.success('视频生成已提交，请稍后查看')
    }
  } catch (e) {
    sbVideoErrors.value[sb.id] = e.message || '提交失败'
    ElMessage.error(e.message || '提交失败')
  } finally {
    generatingSbVideoId.value = null
    await loadStoryboardMedia()
  }
}

async function onGenerateStoryboard() {
  if (!currentEpisodeId.value) return
  storyboardGenerating.value = true
  try {
    const res = await dramaAPI.generateStoryboard(currentEpisodeId.value, {
      model: undefined,
      style: getSelectedStyle(),
      storyboard_count: storyboardCount.value || undefined,
      video_duration: videoDuration.value || undefined,
      aspect_ratio: projectAspectRatio.value
    })
    const taskId = res?.task_id ?? (typeof res === 'string' ? res : null)
    if (taskId) await pollTask(taskId, () => loadDrama())
    await loadDrama()
    ElMessage.success('分镜生成完成')
  } catch (e) {
    ElMessage.error(e.message || '生成失败')
  } finally {
    storyboardGenerating.value = false
  }
}

async function onGenerateVideo() {
  if (!currentEpisodeId.value) return
  store.setVideoStatus('generating')
  store.setVideoProgress(5)
  videoErrorMsg.value = ''
  try {
    const result = await dramaAPI.finalizeEpisode(currentEpisodeId.value)
    if (result?.task_id != null) {
      store.setVideoProgress(10)
      ElMessage.success(result?.message || '视频合成任务已提交，请稍后查看')
      const pollResult = await pollTask(result.task_id, () => loadDrama())
      await loadDrama()
      if (pollResult?.status === 'completed') {
        store.setVideoProgress(100)
        if (currentEpisodeVideoUrl.value) {
          store.setVideoStatus('done')
          ElMessage.success('视频生成完成')
        } else {
          store.setVideoStatus('error')
          videoErrorMsg.value = '视频生成完成但未获取到播放地址，请稍后刷新'
          ElMessage.warning(videoErrorMsg.value)
        }
      } else if (pollResult?.status === 'failed') {
        store.setVideoStatus('error')
        videoErrorMsg.value = pollResult?.error || '视频生成失败'
      } else if (pollResult?.status === 'timeout') {
        store.setVideoStatus('generating')
        videoErrorMsg.value = '任务仍在排队或生成中，请稍后刷新查看'
        ElMessage.warning(videoErrorMsg.value)
      }
    } else {
      store.setVideoStatus('error')
      const msg = result?.message || '本集没有可合成的视频片段'
      videoErrorMsg.value = msg
      ElMessage.warning(msg)
    }
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
  const maxAttempts = 180
  const interval = 2000
  let attempts = 0
  return new Promise((resolve) => {
    const tick = async () => {
      attempts++
      try {
        const t = await taskAPI.get(taskId)
        if (t.status === 'completed') {
          if (onDone) await onDone()
          return resolve({ status: 'completed' })
        }
        if (t.status === 'failed') {
          const errMsg = t.error || '任务失败'
          ElMessage.error(errMsg)
          return resolve({ status: 'failed', error: errMsg })
        }
      } catch (_) {}
      if (attempts < maxAttempts) setTimeout(tick, interval)
      else {
        ElMessage.warning('任务查询超时，请刷新页面查看最新状态')
        resolve({ status: 'timeout' })
      }
    }
    setTimeout(tick, interval)
  })
}

/** 一键生成视频：暂停时等待，返回 { paused: true } 表示被暂停中断 */
function pollTaskWithPause(taskId, onDone) {
  const maxAttempts = 180
  const interval = 2000
  let attempts = 0
  return new Promise((resolve) => {
    const tick = async () => {
      if (pipelinePaused.value) {
        resolve({ paused: true })
        return
      }
      attempts++
      try {
        const t = await taskAPI.get(taskId)
        if (t.status === 'completed') {
          if (onDone) await onDone()
          resolve()
          return
        }
        if (t.status === 'failed') {
          resolve({ error: t.error || '任务失败' })
          return
        }
      } catch (_) {}
      if (attempts < maxAttempts) setTimeout(tick, interval)
      else {
        resolve({ error: '任务查询超时' })
      }
    }
    setTimeout(tick, interval)
  })
}

function waitForResume() {
  return new Promise((resolve) => {
    pipelineResolveResume = resolve
  })
}

function onPipelineResume() {
  pipelinePaused.value = false
  if (pipelineResolveResume) {
    pipelineResolveResume()
    pipelineResolveResume = null
  }
}

function addPipelineError(step, message) {
  const time = new Date().toLocaleTimeString('zh-CN')
  pipelineErrorLog.value = [...pipelineErrorLog.value, { time, step, message }]
}

async function checkPause() {
  while (pipelinePaused.value) {
    await waitForResume()
  }
}

/** 每生成好一个图片或内容后休息，防止任务队列过紧 */
function pipelineRest() {
  return new Promise((r) => setTimeout(r, 1000))
}

/** 执行可失败步骤，失败时重试最多 maxRetries 次；fn 返回 { paused: true } 表示暂停不重试；返回 true 表示成功；抛错会触发重试 */
async function pipelineWithRetry(stepName, fn, maxRetries = 3) {
  let lastErr
  for (let r = 0; r < maxRetries; r++) {
    try {
      const result = await fn()
      if (result && result.paused === true) return result
      return true
    } catch (e) {
      lastErr = e
      if (r < maxRetries - 1) await pipelineRest()
    }
  }
  addPipelineError(stepName, '重试3次均失败: ' + (lastErr?.message || String(lastErr)))
  return false
}

async function startOneClickPipeline() {
  if (!currentEpisodeId.value || pipelineRunning.value) return
  pipelineErrorLog.value = []
  pipelineCurrentStep.value = ''
  pipelineRunning.value = true
  pipelinePaused.value = false
  try {
    await runOneClickPipeline()
  } finally {
    pipelineRunning.value = false
  }
}

async function runOneClickPipeline() {
  const episodeId = currentEpisodeId.value
  const dramaIdVal = dramaId.value
  if (!episodeId || !dramaIdVal) return
  const style = getSelectedStyle()

  try {
    // 1. 剧本生成角色
    await checkPause()
    pipelineCurrentStep.value = '正在生成角色列表...'
    try {
      const outline = (store.scriptContent || '').toString().trim() || (storyInput.value || '').toString().trim() || undefined
      const res = await generationAPI.generateCharacters(dramaIdVal, { episode_id: store.currentEpisode?.id ?? undefined, outline: outline || undefined })
      const taskId = res?.task_id
      if (taskId) {
        const result = await pollTaskWithPause(taskId, () => loadDrama())
        if (result?.paused) { await waitForResume(); return }
        if (result?.error) { addPipelineError('生成角色', result.error); return }
      } else {
        await loadDrama()
      }
      await pipelineRest()
    } catch (e) {
      addPipelineError('生成角色', e.message || String(e))
      return
    }

    // 2. 为每个角色生成图片
    await checkPause()
    let chars = store.currentEpisode?.characters ?? []
    const charsWithoutImage = chars.filter((c) => !hasAssetImage(c))
    for (const char of charsWithoutImage) {
      await checkPause()
      pipelineCurrentStep.value = '正在生成角色图：' + (char.name || char.id)
      const stepName = '角色图 ' + (char.name || char.id)
      const ok = await pipelineWithRetry(stepName, async () => {
        const res = await characterAPI.generateImage(char.id, undefined, style)
        const taskId = res?.image_generation?.task_id ?? res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.paused) return { paused: true }
          if (result?.error) throw new Error(result.error)
        } else {
          await loadDrama()
          await pollUntilResourceHasImage(() => {
            const list = store.currentEpisode?.characters ?? []
            const c = list.find((x) => Number(x.id) === Number(char.id))
            return !!(c && (c.image_url || c.local_path))
          })
        }
      })
      if (ok && typeof ok === 'object' && ok.paused) { await waitForResume(); continue }
      if (ok) await pipelineRest()
    }

    // 3. 从剧本提取场景
    await checkPause()
    pipelineCurrentStep.value = '正在从剧本提取场景...'
    try {
      const res = await dramaAPI.extractBackgrounds(episodeId, { model: undefined, style, language: scriptLanguage.value })
      const taskId = res?.task_id
      if (taskId) {
        const result = await pollTaskWithPause(taskId, () => loadDrama())
        if (result?.paused) { await waitForResume(); return }
        if (result?.error) { addPipelineError('提取场景', result.error); return }
      } else {
        await loadDrama()
      }
      await pipelineRest()
    } catch (e) {
      addPipelineError('提取场景', e.message || String(e))
      return
    }

    // 4. 为每个场景生成图片
    await checkPause()
    let sceneList = store.currentEpisode?.scenes ?? []
    const scenesWithoutImage = sceneList.filter((s) => !hasAssetImage(s))
    for (const scene of scenesWithoutImage) {
      await checkPause()
      pipelineCurrentStep.value = '正在生成场景图：' + (scene.location || scene.id)
      const stepName = '场景图 ' + (scene.location || scene.id)
      const ok = await pipelineWithRetry(stepName, async () => {
        const res = await sceneAPI.generateImage({ scene_id: scene.id, model: undefined, style })
        const taskId = res?.image_generation?.task_id ?? res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.paused) return { paused: true }
          if (result?.error) throw new Error(result.error)
        } else {
          await loadDrama()
          await pollUntilResourceHasImage(() => {
            const list = store.currentEpisode?.scenes ?? []
            const s = list.find((x) => Number(x.id) === Number(scene.id))
            return !!(s && (s.image_url || s.local_path))
          })
        }
      })
      if (ok && typeof ok === 'object' && ok.paused) { await waitForResume(); continue }
      if (ok) await pipelineRest()
    }

    // 5. 分镜生成
    await checkPause()
    pipelineCurrentStep.value = '正在生成分镜...'
    try {
      const res = await dramaAPI.generateStoryboard(episodeId, { style, aspect_ratio: projectAspectRatio.value })
      const taskId = res?.task_id ?? (typeof res === 'string' ? res : null)
      if (taskId) {
        const result = await pollTaskWithPause(taskId, () => loadDrama())
        if (result?.paused) { await waitForResume(); return }
        if (result?.error) { addPipelineError('分镜生成', result.error); return }
      }
      await loadDrama()
      await pipelineRest()
    } catch (e) {
      addPipelineError('分镜生成', e.message || String(e))
      return
    }

    // 6. 逐个生成分镜图（先拉取分镜图/视频列表再判断是否有图）
    await checkPause()
    await loadStoryboardMedia()
    const boards = store.storyboards || []
    for (const sb of boards) {
      await checkPause()
      const hasImg = hasSbImage(sb)
      if (hasImg) continue
      pipelineCurrentStep.value = '正在生成分镜图 #' + (sb.storyboard_number ?? sb.id)
      const stepName = '分镜图 #' + (sb.storyboard_number ?? sb.id)
      const ok = await pipelineWithRetry(stepName, async () => {
        const res = await imagesAPI.create({
          storyboard_id: sb.id,
          drama_id: dramaIdVal,
          prompt: sb.image_prompt || sb.description || '',
          model: undefined,
          style
        })
        if (res?.task_id) {
          const result = await pollTaskWithPause(res.task_id, () => loadStoryboardMedia())
          if (result?.paused) return { paused: true }
          if (result?.error) throw new Error(result.error)
        } else await loadStoryboardMedia()
      })
      if (ok && typeof ok === 'object' && ok.paused) { await waitForResume(); continue }
      if (ok) await pipelineRest()
    }

    // 7. 逐个生成分镜视频
    await checkPause()
    await loadStoryboardMedia()
    const boards2 = store.storyboards || []
    for (const sb of boards2) {
      await checkPause()
      const firstFrameUrl = getSbFirstFrameUrl(sb)
      if (!firstFrameUrl) continue
      const vidList = sbVideos.value[sb.id] || []
      const hasVideo = vidList.some((v) => v.status === 'completed' && (v.video_url || v.local_path))
      if (hasVideo) continue
      pipelineCurrentStep.value = '正在生成分镜视频 #' + (sb.storyboard_number ?? sb.id)
      const stepName = '分镜视频 #' + (sb.storyboard_number ?? sb.id)
      const ok = await pipelineWithRetry(stepName, async () => {
        const absoluteUrl = toAbsoluteImageUrl(firstFrameUrl)
        const res = await videosAPI.create({
          drama_id: dramaIdVal,
          storyboard_id: sb.id,
          prompt: sb.video_prompt,
          image_url: absoluteUrl || undefined,
          reference_image_urls: absoluteUrl ? [absoluteUrl] : undefined,
          model: undefined,
          style,
          aspect_ratio: projectAspectRatio.value,
          resolution: videoResolution.value || undefined,
          duration: videoClipDuration.value || undefined,
        })
        if (res?.task_id) {
          const result = await pollTaskWithPause(res.task_id, () => loadStoryboardMedia())
          if (result?.paused) return { paused: true }
          if (result?.error) throw new Error(result.error)
        } else await loadStoryboardMedia()
      })
      if (ok && typeof ok === 'object' && ok.paused) { await waitForResume(); continue }
      if (ok) await pipelineRest()
    }

    // 8. 生成整集视频（合成整个视频）
    await checkPause()
    pipelineCurrentStep.value = '正在生成整集视频...'
    try {
      const result = await dramaAPI.finalizeEpisode(episodeId)
      if (result?.task_id != null) {
        const pollResult = await pollTaskWithPause(result.task_id, () => loadDrama())
        if (pollResult?.paused) { await waitForResume(); return }
        if (pollResult?.error) addPipelineError('生成整集视频', pollResult.error)
        else await pipelineRest()
      } else {
        addPipelineError('生成整集视频', result?.message || '本集没有可合成的视频片段')
      }
    } catch (e) {
      addPipelineError('生成整集视频', e.message || String(e))
    }

    pipelineCurrentStep.value = '一键生成视频流程已执行完成'
    ElMessage.success('一键生成视频流程已执行完成')
  } catch (e) {
    addPipelineError('流程', e.message || String(e))
  }
}

async function startRepairPipeline() {
  if (!currentEpisodeId.value || pipelineRunning.value) return
  pipelineErrorLog.value = []
  pipelineCurrentStep.value = ''
  pipelineRunning.value = true
  pipelinePaused.value = false
  try {
    await runRepairPipeline()
  } finally {
    pipelineRunning.value = false
  }
}

/** 修复缺失：哪一步没有就生成哪一步，有图/有内容就跳过 */
async function runRepairPipeline() {
  const episodeId = currentEpisodeId.value
  const dramaIdVal = dramaId.value
  if (!episodeId || !dramaIdVal) return
  const style = getSelectedStyle()

  try {
    pipelineCurrentStep.value = '正在加载数据...'
    await loadDrama()

    // 1. 角色：没有则生成角色；再为每个无图角色生成图
    let chars = store.currentEpisode?.characters ?? []
    if (chars.length === 0) {
      await checkPause()
      pipelineCurrentStep.value = '正在生成角色列表...'
      try {
        const outline = (store.scriptContent || '').toString().trim() || (storyInput.value || '').toString().trim() || undefined
        const res = await generationAPI.generateCharacters(dramaIdVal, { episode_id: store.currentEpisode?.id ?? undefined, outline: outline || undefined })
        const taskId = res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError('生成角色', result.error); return }
        } else await loadDrama()
        await pipelineRest()
      } catch (e) {
        addPipelineError('生成角色', e.message || String(e))
        return
      }
      chars = store.currentEpisode?.characters ?? []
    }
    const charsWithoutImage = chars.filter((c) => !hasAssetImage(c))
    for (const char of charsWithoutImage) {
      await checkPause()
      pipelineCurrentStep.value = '正在生成角色图：' + (char.name || char.id)
      const stepName = '角色图 ' + (char.name || char.id)
      const ok = await pipelineWithRetry(stepName, async () => {
        const res = await characterAPI.generateImage(char.id, undefined, style)
        const taskId = res?.image_generation?.task_id ?? res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.paused) return { paused: true }
          if (result?.error) throw new Error(result.error)
        } else {
          await loadDrama()
          await pollUntilResourceHasImage(() => {
            const list = store.currentEpisode?.characters ?? []
            const c = list.find((x) => Number(x.id) === Number(char.id))
            return !!(c && (c.image_url || c.local_path))
          })
        }
      })
      if (ok && typeof ok === 'object' && ok.paused) { await waitForResume(); continue }
      if (ok) await pipelineRest()
    }

    // 2. 场景：没有则提取；再为每个无图场景生成图
    let sceneList = store.currentEpisode?.scenes ?? []
    if (sceneList.length === 0) {
      await checkPause()
      pipelineCurrentStep.value = '正在提取场景...'
      try {
        const res = await dramaAPI.extractBackgrounds(episodeId, { model: undefined, style, language: scriptLanguage.value })
        const taskId = res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError('提取场景', result.error); return }
        } else await loadDrama()
        await pipelineRest()
      } catch (e) {
        addPipelineError('提取场景', e.message || String(e))
        return
      }
      sceneList = store.currentEpisode?.scenes ?? []
    }
    const scenesWithoutImage = sceneList.filter((s) => !hasAssetImage(s))
    for (const scene of scenesWithoutImage) {
      await checkPause()
      pipelineCurrentStep.value = '正在生成场景图：' + (scene.location || scene.id)
      const stepName = '场景图 ' + (scene.location || scene.id)
      const ok = await pipelineWithRetry(stepName, async () => {
        const res = await sceneAPI.generateImage({ scene_id: scene.id, model: undefined, style })
        const taskId = res?.image_generation?.task_id ?? res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.paused) return { paused: true }
          if (result?.error) throw new Error(result.error)
        } else {
          await loadDrama()
          await pollUntilResourceHasImage(() => {
            const list = store.currentEpisode?.scenes ?? []
            const s = list.find((x) => Number(x.id) === Number(scene.id))
            return !!(s && (s.image_url || s.local_path))
          })
        }
      })
      if (ok && typeof ok === 'object' && ok.paused) { await waitForResume(); continue }
      if (ok) await pipelineRest()
    }

    // 3. 分镜：没有则生成分镜；再逐个检查分镜图，没有则生成；再逐个检查分镜视频，没有则生成
    let boards = store.storyboards || []
    if (boards.length === 0) {
      await checkPause()
      pipelineCurrentStep.value = '正在生成分镜...'
      try {
        const res = await dramaAPI.generateStoryboard(episodeId, { aspect_ratio: projectAspectRatio.value })
        const taskId = res?.task_id ?? (typeof res === 'string' ? res : null)
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError('分镜生成', result.error); return }
        }
        await loadDrama()
        await pipelineRest()
      } catch (e) {
        addPipelineError('分镜生成', e.message || String(e))
        return
      }
      boards = store.storyboards || []
    }
    // 先拉取分镜图片/视频列表，再先生成分镜图、再生成视频
    await loadStoryboardMedia()
    for (const sb of boards) {
      await checkPause()
      if (hasSbImage(sb)) continue
      pipelineCurrentStep.value = '正在生成分镜图 #' + (sb.storyboard_number ?? sb.id)
      const stepName = '分镜图 #' + (sb.storyboard_number ?? sb.id)
      const ok = await pipelineWithRetry(stepName, async () => {
        const res = await imagesAPI.create({
          storyboard_id: sb.id,
          drama_id: dramaIdVal,
          prompt: sb.image_prompt || sb.description || '',
          model: undefined
        })
        if (res?.task_id) {
          const result = await pollTaskWithPause(res.task_id, () => loadStoryboardMedia())
          if (result?.paused) return { paused: true }
          if (result?.error) throw new Error(result.error)
        } else await loadStoryboardMedia()
      })
      if (ok && typeof ok === 'object' && ok.paused) { await waitForResume(); continue }
      if (ok) await pipelineRest()
    }
    await loadStoryboardMedia()
    const boards2 = store.storyboards || []
    for (const sb of boards2) {
      await checkPause()
      const firstFrameUrl = getSbFirstFrameUrl(sb)
      if (!firstFrameUrl) continue
      const vidList = sbVideos.value[sb.id] || []
      if (vidList.some((v) => v.status === 'completed' && (v.video_url || v.local_path))) continue
      pipelineCurrentStep.value = '正在生成分镜视频 #' + (sb.storyboard_number ?? sb.id)
      const stepName = '分镜视频 #' + (sb.storyboard_number ?? sb.id)
      const ok = await pipelineWithRetry(stepName, async () => {
        const absoluteUrl = toAbsoluteImageUrl(firstFrameUrl)
        const res = await videosAPI.create({
          drama_id: dramaIdVal,
          storyboard_id: sb.id,
          prompt: sb.video_prompt,
          image_url: absoluteUrl || undefined,
          reference_image_urls: absoluteUrl ? [absoluteUrl] : undefined,
          model: undefined,
          aspect_ratio: projectAspectRatio.value,
          resolution: videoResolution.value || undefined,
          duration: videoClipDuration.value || undefined,
        })
        if (res?.task_id) {
          const result = await pollTaskWithPause(res.task_id, () => loadStoryboardMedia())
          if (result?.paused) return { paused: true }
          if (result?.error) throw new Error(result.error)
        } else await loadStoryboardMedia()
      })
      if (ok && typeof ok === 'object' && ok.paused) { await waitForResume(); continue }
      if (ok) await pipelineRest()
    }

    // 4. 生成整集视频（合成整个视频）
    await checkPause()
    pipelineCurrentStep.value = '正在生成整集视频...'
    try {
      const result = await dramaAPI.finalizeEpisode(episodeId)
      if (result?.task_id != null) {
        const pollResult = await pollTaskWithPause(result.task_id, () => loadDrama())
        if (pollResult?.paused) { await waitForResume(); return }
        if (pollResult?.error) addPipelineError('生成整集视频', pollResult.error)
        else await pipelineRest()
      } else {
        addPipelineError('生成整集视频', result?.message || '本集没有可合成的视频片段')
      }
    } catch (e) {
      addPipelineError('生成整集视频', e.message || String(e))
    }

    pipelineCurrentStep.value = '补全并生成流程已执行完成'
    ElMessage.success('修复缺失流程已执行完成')
  } catch (e) {
    addPipelineError('流程', e.message || String(e))
  }
}

async function submitAddProp() {
  const name = (addPropForm.value.name || '').trim()
  if (!name || !store.dramaId) return
  addPropSaving.value = true
  try {
    await propAPI.create({
      drama_id: store.dramaId,
      episode_id: currentEpisodeId.value ?? undefined,
      name,
      type: addPropForm.value.type?.trim() || undefined,
      description: addPropForm.value.description?.trim() || undefined,
      prompt: addPropForm.value.prompt?.trim() || undefined
    })
    showAddProp.value = false
    await loadDrama()
    ElMessage.success('道具已添加')
  } catch (e) {
    ElMessage.error(e.message || '添加失败')
  } finally {
    addPropSaving.value = false
  }
}

onMounted(() => {
  const id = route.params.id
  if (id && id !== 'new') {
    store.setDrama({ id: Number(id) })
    // 如果 URL 带了 ?episode=X，先设置好，让 loadDrama 优先恢复到该集
    if (route.query.episode) {
      selectedEpisodeId.value = Number(route.query.episode)
    }
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
    generationStyle.value = ''
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
.btn-back-drama {
  margin-left: auto;
}
.btn-theme {
  --el-button-bg-color: rgba(148, 163, 184, 0.1);
  --el-button-border-color: rgba(148, 163, 184, 0.3);
  --el-button-text-color: #94a3b8;
  --el-button-hover-bg-color: rgba(148, 163, 184, 0.2);
  --el-button-hover-border-color: rgba(148, 163, 184, 0.5);
  --el-button-hover-text-color: #cbd5e1;
  transition: all 0.2s;
}
html.light .btn-theme {
  --el-button-bg-color: rgba(99, 102, 241, 0.08);
  --el-button-border-color: rgba(99, 102, 241, 0.3);
  --el-button-text-color: #6366f1;
  --el-button-hover-bg-color: rgba(99, 102, 241, 0.15);
  --el-button-hover-border-color: rgba(99, 102, 241, 0.5);
  --el-button-hover-text-color: #4f46e5;
}
/* 左侧快捷目录 */
.quick-nav {
  position: fixed;
  left: 20px;
  top: 100px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0 12px;
  background: rgba(24, 24, 27, 0.95);
  border-radius: 8px;
  border: 1px solid #27272a;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  width: 140px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  transition: width 0.2s ease, padding 0.2s ease;
}
.quick-nav.collapsed {
  width: 36px;
  overflow: hidden;
  padding: 4px 0;
}
.quick-nav.collapsed .nav-item,
.quick-nav.collapsed .nav-group {
  display: none;
}
.nav-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  cursor: pointer;
  color: #52525b;
  transition: color 0.15s, background 0.15s;
  border-radius: 6px;
  margin: 0 4px 2px;
  flex-shrink: 0;
}
.nav-toggle:hover {
  color: #e4e4e7;
  background: rgba(255, 255, 255, 0.08);
}
.nav-item {
  padding: 8px 16px;
  cursor: pointer;
  color: #a1a1aa;
  font-size: 0.9rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  user-select: none;
}
.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}
.nav-label {
  flex: 1;
}
.nav-expand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-right: 4px;
  border-radius: 4px;
  color: #71717a;
  cursor: pointer;
  transition: background 0.2s;
}
.nav-expand-icon:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e4e4e7;
}
.nav-sub-list {
  background: rgba(0, 0, 0, 0.2);
  padding: 4px 0;
}
.nav-sub-item {
  padding: 6px 12px 6px 36px;
  font-size: 0.8rem;
  color: #71717a;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s;
}
.nav-sub-item:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
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
.one-click-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  flex-wrap: wrap;
}
.pipeline-status {
  margin-top: 12px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  font-size: 13px;
}
.pipeline-current-step {
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
  font-weight: 500;
}
.pipeline-error-log {
  margin-top: 0;
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  font-size: 13px;
  color: #fca5a5;
  max-height: 200px;
  overflow-y: auto;
}
.pipeline-status .pipeline-error-log {
  margin-top: 8px;
}
.pipeline-error-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.pipeline-error-line {
  margin-bottom: 4px;
  word-break: break-all;
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
html.light .resource-block-title {
  color: #18181b;
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
.cover-placeholder.error {
  background: #450a0a;
  color: #f87171;
  font-size: 0.8rem;
  padding: 8px;
  line-height: 1.4;
  word-break: break-all;
  text-align: center;
}
.sb-image-error {
  width: 100%;
  flex: 1;
  background: #450a0a;
  color: #f87171;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  text-align: center;
  font-size: 0.85rem;
  overflow: hidden;
  margin-bottom: 8px;
}
.asset-cover--dragover {
  outline: 2px dashed var(--el-color-primary);
  outline-offset: -2px;
  background: rgba(64, 158, 255, 0.08);
}
.asset-cover-drop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 0.9rem;
  pointer-events: none;
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

/* 亮色模式：资源卡片 */
html.light .asset-item {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.07);
}
html.light .asset-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
  transition: box-shadow 0.2s, transform 0.2s;
}
html.light .asset-cover {
  background: #f3f4f6;
}
html.light .asset-name {
  color: #18181b;
}
html.light .asset-desc,
html.light .asset-desc-full,
html.light .asset-item-left-right .asset-desc-full {
  color: #6b7280;
}
html.light .cover-placeholder {
  color: #9ca3af;
  background: #f3f4f6;
}
html.light .cover-placeholder.error {
  background: #fef2f2;
  color: #dc2626;
}
html.light .empty-tip {
  color: #9ca3af;
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
  position: relative;
}
.sb-image-area--dragover {
  outline: 2px dashed var(--el-color-primary);
  outline-offset: -2px;
  background: rgba(64, 158, 255, 0.1);
}
.sb-image-area-drop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 0.9rem;
  border-radius: 8px;
  pointer-events: none;
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
.sb-video-placeholder {
  color: #71717a;
  font-size: 0.9rem;
  flex-direction: column;
  gap: 8px;
  text-align: center;
  padding: 12px;
}
.sb-video-generating-text {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #409eff;
  font-size: 0.85rem;
}
.sb-video-error {
  color: #f56c6c;
  font-size: 0.75rem;
  line-height: 1.4;
  word-break: break-word;
  max-height: 80px;
  overflow-y: auto;
  padding: 4px 8px;
  background: rgba(245, 108, 108, 0.08);
  border-radius: 4px;
  text-align: left;
  width: 100%;
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
.sb-video-prompt-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 4px;
}
.sb-video-prompt-row .sb-video-prompt-text {
  flex: 1;
  min-width: 0;
}
.sb-video-prompt-text {
  font-size: 0.85rem;
  color: #a1a1aa;
  line-height: 1.5;
  padding: 8px 0;
}
.sb-video-prompt-text--preview {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}
.sb-video-prompt-edit {
  margin-bottom: 8px;
}
.sb-video-prompt-edit .el-textarea { margin-bottom: 8px; }
.sb-video-prompt-edit-actions { display: flex; gap: 8px; }
.sb-generate-video-btn { margin-top: 8px; }
.sb-prompt-label { display: flex; align-items: center; gap: 8px; margin: 10px 0 6px; }
.sb-prompt-label .sb-dot { flex-shrink: 0; }
.sb-prompt-label > span:not(.sb-dot) { font-size: 0.85rem; color: #e4e4e7; }
.sb-prompt-row { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
.sb-prompt-row .sb-prompt-text { flex: 1; min-width: 0; font-size: 0.85rem; color: #a1a1aa; line-height: 1.4; }
.sb-image-prompt-edit .el-textarea { margin-bottom: 6px; }
.sb-prompt-edit-actions { display: flex; gap: 8px; }
.sb-video-fields-collapse { margin: 8px 0; }
.sb-video-fields-collapse .el-collapse-item__header { font-size: 0.9rem; }
.sb-collapse-title { color: #a1a1aa; }
.sb-video-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; padding: 8px 0; }
.sb-field { display: flex; flex-direction: column; gap: 4px; }
.sb-field-full { grid-column: 1 / -1; }
.sb-field-label { font-size: 0.8rem; color: #a1a1aa; }
.sb-field-select { width: 100%; }
.sb-video-fields-actions { grid-column: 1 / -1; margin-top: 8px; }
.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px 24px;
  margin-bottom: 16px;
}
.config-tip {
  margin: 12px 0 0;
  font-size: 0.9rem;
  color: #a1a1aa;
}
.config-tip .el-link { font-size: inherit; }
.sb-config-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.sb-config-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sb-config-label {
  font-size: 0.85rem;
  color: #a1a1aa;
  white-space: nowrap;
}
.sb-config-input {
  width: 110px;
}
.sb-config-hint {
  font-size: 0.78rem;
  color: #52525b;
  white-space: nowrap;
}
.sb-config-divider {
  color: #3f3f46;
  font-size: 0.85rem;
  margin: 0 4px;
}
.sub-title {
  font-size: 1rem;
  margin: 16px 0 8px;
  color: #e4e4e7;
}
.video-progress, .video-done, .video-error {
  margin-top: 16px;
}
.video-preview-wrap {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #27272a;
}
.video-preview-label {
  margin: 0 0 10px;
  font-size: 0.95rem;
  color: #a1a1aa;
}
.video-preview-player {
  display: block;
  max-width: 100%;
  max-height: 360px;
  border-radius: 8px;
  background: #18181b;
}

/* 公共库弹窗 */
.library-dialog .el-dialog__body { padding-top: 8px; }
.library-toolbar { margin-bottom: 12px; }
.library-list {
  min-height: 200px;
  max-height: 420px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.library-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px;
  background: #27272a;
  border-radius: 8px;
}
.library-item-cover {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  background: #3f3f46;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.library-item-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.library-item-placeholder {
  font-size: 0.8rem;
  color: #71717a;
}
.library-item-info { flex: 1; min-width: 0; }
.library-item-name { font-weight: 500; margin-bottom: 4px; }
.library-item-desc { font-size: 0.85rem; color: #a1a1aa; margin-bottom: 8px; }
.library-item-actions { display: flex; gap: 8px; }
.library-empty {
  text-align: center;
  color: #71717a;
  padding: 40px 20px;
}
.library-pagination {
  margin-top: 12px;
  display: flex;
  justify-content: center;
}
.library-placeholder {
  padding: 40px 20px;
  text-align: center;
  color: #71717a;
}
</style>
