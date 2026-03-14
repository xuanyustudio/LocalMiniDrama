<template>
  <div class="film-create">
    <!-- 顶部 -->
    <header class="header">
      <div class="header-inner">
        <h1 class="logo" @click="goList">
          <span class="logo-main">本地短剧助手</span>
          <span class="logo-sub">LocalMiniDrama</span>
        </h1>
        <span class="breadcrumb-sep">›</span>
        <span class="page-title">{{ dramaId ? (store.drama?.title || '项目') : '新建故事' }}</span>
        <el-button v-if="dramaId" class="btn-back-drama" @click="router.push('/drama/' + dramaId)">
          <el-icon><ArrowLeft /></el-icon>
          返回剧集
        </el-button>
        <div class="header-actions">
          <el-button class="btn-theme" :title="isDark ? '切换到浅色模式' : '切换到暗色模式'" @click="toggleTheme">
            <el-icon><Sunny v-if="isDark" /><Moon v-else /></el-icon>
            {{ isDark ? '浅色' : '暗色' }}
          </el-button>
          <el-button class="btn-ai-config" @click="showAiConfigDialog = true">
            <el-icon><Setting /></el-icon>
            AI配置
          </el-button>
        </div>
      </div>
    </header>

    <!-- 左侧快捷目录 -->
    <nav class="quick-nav" :class="{ collapsed: navCollapsed }" aria-label="快捷导航">
      <div class="nav-toggle" :title="navCollapsed ? '展开导航' : '收起导航'" @click="toggleNav()">
        <el-icon><ArrowLeft v-if="!navCollapsed" /><ArrowRight v-else /></el-icon>
      </div>

      <!-- 步骤列表 -->
      <div class="nav-steps">
        <div
          v-for="(step, idx) in navSteps"
          :key="step.key"
          class="nav-step"
          :class="['status-' + step.status]"
          @click="scrollToAnchor(step.anchor)"
        >
          <!-- 左侧连接线 -->
          <div class="step-connector-wrap">
            <div v-if="idx > 0" class="step-line step-line-top" :class="{ filled: navSteps[idx - 1].status === 'done' }" />
            <div
              class="step-dot"
              :class="['dot-' + step.status]"
            >
              <el-icon v-if="step.status === 'done'" class="dot-icon"><Check /></el-icon>
              <el-icon v-else-if="step.status === 'generating'" class="dot-icon spin"><Loading /></el-icon>
              <span v-else class="dot-num">{{ idx + 1 }}</span>
            </div>
            <div v-if="idx < navSteps.length - 1" class="step-line step-line-bottom" :class="{ filled: step.status === 'done' }" />
          </div>

          <!-- 右侧文字 + 状态徽章 -->
          <div class="step-body">
            <span class="step-label">{{ step.label }}</span>
            <span v-if="step.count > 0 && step.status !== 'done'" class="step-count">{{ step.count }}</span>
            <span v-if="step.status === 'partial'" class="step-badge partial-badge" title="部分完成">
              <el-icon><WarningFilled /></el-icon>
            </span>
            <span v-else-if="step.status === 'generating'" class="step-badge gen-badge" title="生成中">
              <el-icon class="spin"><Loading /></el-icon>
            </span>
          </div>
        </div>
      </div>

      <!-- 分镜子列表 -->
      <div v-if="!navCollapsed && storyboards.length > 0" class="nav-group">
        <div class="nav-sub-toggle" @click="storyboardMenuExpanded = !storyboardMenuExpanded">
          <el-icon><Minus v-if="storyboardMenuExpanded" /><Plus v-else /></el-icon>
          <span>分镜列表</span>
        </div>
        <div v-show="storyboardMenuExpanded" class="nav-sub-list">
          <template v-for="(sb, i) in storyboards" :key="sb.id">
            <!-- 段落标题行 -->
            <div
              v-if="sb.segment_title && (i === 0 || sb.segment_index !== storyboards[i - 1].segment_index)"
              class="nav-segment-label"
            >
              <span class="nav-segment-dot" />
              {{ sb.segment_title }}
            </div>
            <div
              class="nav-sub-item"
              :title="sb.title || '分镜 ' + (i + 1)"
              @click="scrollToAnchor('sb-' + sb.id)"
            >
              {{ i + 1 }}. {{ sb.title || '分镜' }}
            </div>
          </template>
        </div>
      </div>

      <!-- 当前任务面板 -->
      <div v-if="allActiveTasks.length > 0" class="atp-panel">
        <!-- 折叠态：只显示旋转点和数量 -->
        <div v-if="navCollapsed" class="atp-collapsed-badge" :title="allActiveTasks.join('\n')">
          <span class="atp-spin-dot" />
          <span class="atp-collapsed-count">{{ allActiveTasks.length }}</span>
        </div>
        <!-- 展开态：标题 + 任务列表 -->
        <template v-else>
          <div class="atp-header">
            <span class="atp-spin-dot" />
            <span class="atp-title">进行中</span>
            <span class="atp-count-badge">{{ allActiveTasks.length }}</span>
          </div>
          <div class="atp-list">
            <div v-for="(label, i) in allActiveTasks.slice(0, 8)" :key="i" class="atp-item">
              <span class="atp-item-dot" />
              <span class="atp-item-label">{{ label }}</span>
            </div>
            <div v-if="allActiveTasks.length > 8" class="atp-more">
              还有 {{ allActiveTasks.length - 8 }} 个任务...
            </div>
          </div>
        </template>
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
        <p class="section-desc">输入一段故事梗概，AI 帮你扩写成完整剧本</p>
        <el-input
          v-model="storyInput"
          type="textarea"
          :rows="4"
          placeholder="例如：一个少女在森林里遇见会说话的狐狸，一起寻找失落的宝石..."
          class="story-textarea"
        />
        <div class="row gap" style="margin-top: 10px; flex-wrap: wrap;">
          <el-select v-model="storyStyle" placeholder="故事风格" clearable style="width: 120px" @change="saveProjectSettings">
            <el-option label="现代" value="modern" />
            <el-option label="古风" value="ancient" />
            <el-option label="奇幻" value="fantasy" />
            <el-option label="日常" value="daily" />
          </el-select>
          <el-select v-model="storyType" placeholder="剧本类型" clearable style="width: 120px" @change="saveProjectSettings">
            <el-option label="剧情" value="drama" />
            <el-option label="喜剧" value="comedy" />
            <el-option label="冒险" value="adventure" />
          </el-select>
          <el-select v-model="storyEpisodeCount" placeholder="生成集数" style="width: 120px">
            <el-option label="生成 1 集" :value="1" />
            <el-option label="生成 2 集" :value="2" />
            <el-option label="生成 3 集" :value="3" />
            <el-option label="生成 4 集" :value="4" />
            <el-option label="生成 5 集" :value="5" />
            <el-option label="生成 6 集" :value="6" />
          </el-select>
          <el-button type="primary" :loading="storyGenerating" @click="onGenerateStory">
            生成剧本
          </el-button>
        </div>
      </section>

      <!-- 2. 剧本编辑 -->
      <section id="anchor-script" class="section card">
        <h2 class="section-title">剧本</h2>
        <!-- 行1：集数切换 + 集名 + 添加一集 -->
        <div class="row gap" style="margin-bottom: 10px; flex-wrap: wrap;">
          <el-select
            v-model="selectedEpisodeId"
            placeholder="选择集数"
            clearable
            style="width: 130px"
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
          <el-input v-model="scriptTitle" placeholder="集标题" style="width: 150px" />
          <el-button v-if="dramaId" style="margin-left: auto" @click="onAddEpisode">
            <el-icon><Plus /></el-icon>添加一集
          </el-button>
        </div>
        <!-- 剧本文本框 -->
        <el-input
          v-model="scriptContent"
          type="textarea"
          :rows="8"
          placeholder="剧本内容将显示在这里，可直接编辑..."
          class="story-textarea"
        />
        <!-- 行2：保存（紧贴文本框下方） -->
        <div class="row gap" style="margin-top: 8px; flex-wrap: wrap;">
          <el-button
            :loading="scriptGenerating"
            :disabled="!!dramaId && (store.drama?.episodes?.length > 0) && !currentEpisodeId"
            @click="onGenerateScript"
          >
            保存当前集
          </el-button>
        </div>
        <!-- 一键全流程生成区 -->
        <div class="one-click-actions">
          <span class="one-click-label">一键全流程：</span>
          <el-select v-model="projectAspectRatio" style="width: 130px" @change="saveProjectSettings">
            <el-option label="16:9 横屏" value="16:9" />
            <el-option label="9:16 竖屏" value="9:16" />
            <el-option label="3:4 竖版" value="3:4" />
            <el-option label="1:1 方形" value="1:1" />
            <el-option label="4:3" value="4:3" />
            <el-option label="21:9 宽银幕" value="21:9" />
          </el-select>
          <el-select v-model="videoClipDuration" style="width: 105px" @change="saveProjectSettings">
            <el-option label="4秒/段" :value="4" />
            <el-option label="5秒/段" :value="5" />
            <el-option label="8秒/段" :value="8" />
            <el-option label="10秒/段" :value="10" />
            <el-option label="12秒/段" :value="12" />
            <el-option label="15秒/段" :value="15" />
          </el-select>
          <el-select v-model="scriptLanguage" placeholder="分镜语言" clearable style="width: 105px">
            <el-option label="中文" value="zh" />
            <el-option label="英文" value="en" />
          </el-select>
          <StylePickerButton
            v-model="generationStyle"
            :options="generationStyleOptions"
            @change="saveProjectSettings"
          />
          <el-button
            type="primary"
            :loading="pipelineRunning && !pipelinePaused"
            :disabled="!currentEpisodeId || pipelineRunning"
            @click="startOneClickPipeline"
          >
            🚀 一键全流程生成
          </el-button>
          <template v-if="pipelineRunning">
            <el-button v-if="!pipelinePaused" type="warning" @click="pipelinePaused = true">⏸ 暂停</el-button>
            <el-button v-else type="success" @click="onPipelineResume">▶ 继续</el-button>
          </template>
        </div>
        <div v-if="pipelineRunning || pipelineErrorLog.length > 0" class="pipeline-status">
          <div v-if="pipelineCurrentStep" class="pipeline-current-step">
            <span v-if="pipelineStepIndex > 0" class="pipeline-step-badge">{{ pipelineStepIndex }}/{{ PIPELINE_TOTAL_STEPS }}</span>
            {{ pipelineCurrentStep.replace(/^\[步骤 \d+\/\d+\] /, '') }}
          </div>
          <div v-if="pipelineActiveTasks.size > 0" class="pipeline-active-tasks">
            <span
              v-for="label in Array.from(pipelineActiveTasks)"
              :key="label"
              class="pipeline-task-chip"
            >
              <span class="pipeline-task-dot" />{{ label }}
            </span>
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
                    <div class="asset-name">
                      <span style="display:inline-flex;align-items:center;gap:4px;flex:1;min-width:0;overflow:hidden">
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ char.name }}</span>
                        <el-tag v-if="char.role" size="small" effect="plain" :type="char.role === 'main' ? 'danger' : char.role === 'supporting' ? 'warning' : 'info'" style="flex-shrink:0;padding:0 5px;font-size:11px;height:18px;line-height:18px">{{ charRoleLabel(char.role) }}</el-tag>
                      </span>
                      <el-button type="danger" text size="small" class="btn-delete-icon" title="删除" @click="onDeleteCharacter(char)">
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </div>
                    <div class="asset-desc-full">{{ char.appearance || char.description || '暂无描述' }}</div>
                    <div class="asset-btns">
                      <el-button size="small" @click="editCharacter(char)">编辑</el-button>
                      <el-button size="small" :loading="addingCharToLibraryId === char.id" :disabled="!hasAssetImage(char)" @click="onAddCharacterToLibrary(char)">
                        加入本剧库
                      </el-button>
                      <el-button size="small" :loading="addingCharToMaterialId === char.id" :disabled="!hasAssetImage(char)" @click="onAddCharacterToMaterialLibrary(char)">
                        加入素材库
                      </el-button>
                    </div>
                    <div v-if="getCharAffectedStoryboards(char.id).length" class="asset-storyboard-link">
                      <span class="asl-label">影响的分镜：</span>
                      <span
                        v-for="sb in getCharAffectedStoryboards(char.id)"
                        :key="sb.id"
                        class="asl-chip"
                        title="点击跳转到该分镜"
                        @click="scrollToStoryboard(sb.id)"
                      >#{{ sb.storyboard_number }}</span>
                      <span v-if="regenSbImagesForAsset.has('char-' + char.id) && regenSbImagesProgress['char-' + char.id]" class="asl-progress">
                        {{ regenSbImagesProgress['char-' + char.id].current }}/{{ regenSbImagesProgress['char-' + char.id].total }}
                      </span>
                      <el-button
                        size="small"
                        class="asl-regen-btn"
                        :loading="regenSbImagesForAsset.has('char-' + char.id)"
                        @click="onRegenAffectedSbImages('char-' + char.id, getCharAffectedStoryboards(char.id))"
                      >
                        <span v-if="!regenSbImagesForAsset.has('char-' + char.id)">↻ 重新生成分镜图</span>
                      </el-button>
                    </div>
                  </div>
                  <div class="asset-cover-wrap">
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
                    <!-- 额外参考图条 -->
                    <div v-if="parseExtraImages(char).length" class="extra-images-strip">
                      <div v-for="ep in parseExtraImages(char)" :key="ep" class="extra-thumb" :title="'点击设为主图'">
                        <img :src="localPathToUrl(ep)" alt="" @click="onSetPrimaryImage('character', char, ep)" />
                        <button class="extra-thumb-remove" title="移除" @click.stop="onRemoveExtraImage('character', char, ep)">×</button>
                      </div>
                    </div>
                    <div class="asset-cover-actions">
                      <el-button type="primary" size="small" :loading="generatingCharIds.has(char.id)" @click="onGenerateCharacterImage(char)">
                        <el-icon v-if="!generatingCharIds.has(char.id)"><MagicStick /></el-icon>
                        AI 生成
                      </el-button>
                      <el-button type="success" size="small" :loading="uploadingResourceId === 'char-' + char.id" @click="onUploadResourceClick('character', char.id)">
                        <el-icon v-if="uploadingResourceId !== 'char-' + char.id"><Upload /></el-icon>
                        上传
                      </el-button>
                    </div>
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
                    <div class="asset-name">
                      <span>{{ prop.name }}</span>
                      <el-button type="danger" text size="small" class="btn-delete-icon" title="删除" @click="onDeleteProp(prop)">
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </div>
                    <div class="asset-desc-full">{{ prop.description || prop.prompt || '暂无描述' }}</div>
                    <div class="asset-btns">
                      <el-button size="small" @click="editProp(prop)">编辑</el-button>
                      <el-button size="small" :loading="addingPropToLibraryId === prop.id" :disabled="!hasAssetImage(prop)" @click="onAddPropToLibrary(prop)">
                        加入本剧库
                      </el-button>
                      <el-button size="small" :loading="addingPropToMaterialId === prop.id" :disabled="!hasAssetImage(prop)" @click="onAddPropToMaterialLibrary(prop)">
                        加入素材库
                      </el-button>
                    </div>
                  </div>
                  <div class="asset-cover-wrap">
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
                    <div v-if="parseExtraImages(prop).length" class="extra-images-strip">
                      <div v-for="ep in parseExtraImages(prop)" :key="ep" class="extra-thumb" title="点击设为主图">
                        <img :src="localPathToUrl(ep)" alt="" @click="onSetPrimaryImage('prop', prop, ep)" />
                        <button class="extra-thumb-remove" title="移除" @click.stop="onRemoveExtraImage('prop', prop, ep)">×</button>
                      </div>
                    </div>
                    <div class="asset-cover-actions">
                      <el-button type="primary" size="small" :loading="generatingPropIds.has(prop.id)" @click="onGeneratePropImage(prop)">
                        <el-icon v-if="!generatingPropIds.has(prop.id)"><MagicStick /></el-icon>
                        AI 生成
                      </el-button>
                      <el-button type="success" size="small" :loading="uploadingResourceId === 'prop-' + prop.id" @click="onUploadResourceClick('prop', prop.id)">
                        <el-icon v-if="uploadingResourceId !== 'prop-' + prop.id"><Upload /></el-icon>
                        上传
                      </el-button>
                    </div>
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
                    <div class="asset-name">
                      <span>{{ scene.location }}</span>
                      <el-button type="danger" text size="small" class="btn-delete-icon" title="删除" @click="onDeleteScene(scene)">
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </div>
                    <div class="asset-desc-full">{{ scene.description || scene.prompt || scene.time || '暂无描述' }}</div>
                    <div class="asset-btns">
                      <el-button size="small" @click="editScene(scene)">编辑</el-button>
                      <el-button size="small" :loading="addingSceneToLibraryId === scene.id" :disabled="!hasAssetImage(scene)" @click="onAddSceneToLibrary(scene)">
                        加入本剧库
                      </el-button>
                      <el-button size="small" :loading="addingSceneToMaterialId === scene.id" :disabled="!hasAssetImage(scene)" @click="onAddSceneToMaterialLibrary(scene)">
                        加入素材库
                      </el-button>
                    </div>
                    <div v-if="getSceneAffectedStoryboards(scene.id).length" class="asset-storyboard-link">
                      <span class="asl-label">影响的分镜：</span>
                      <span
                        v-for="sb in getSceneAffectedStoryboards(scene.id)"
                        :key="sb.id"
                        class="asl-chip"
                        title="点击跳转到该分镜"
                        @click="scrollToStoryboard(sb.id)"
                      >#{{ sb.storyboard_number }}</span>
                      <span v-if="regenSbImagesForAsset.has('scene-' + scene.id) && regenSbImagesProgress['scene-' + scene.id]" class="asl-progress">
                        {{ regenSbImagesProgress['scene-' + scene.id].current }}/{{ regenSbImagesProgress['scene-' + scene.id].total }}
                      </span>
                      <el-button
                        size="small"
                        class="asl-regen-btn"
                        :loading="regenSbImagesForAsset.has('scene-' + scene.id)"
                        @click="onRegenAffectedSbImages('scene-' + scene.id, getSceneAffectedStoryboards(scene.id))"
                      >
                        <span v-if="!regenSbImagesForAsset.has('scene-' + scene.id)">↻ 重新生成分镜图</span>
                      </el-button>
                    </div>
                  </div>
                  <div class="asset-cover-wrap">
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
                    <div v-if="parseExtraImages(scene).length" class="extra-images-strip">
                      <div v-for="ep in parseExtraImages(scene)" :key="ep" class="extra-thumb" title="点击设为主图">
                        <img :src="localPathToUrl(ep)" alt="" @click="onSetPrimaryImage('scene', scene, ep)" />
                        <button class="extra-thumb-remove" title="移除" @click.stop="onRemoveExtraImage('scene', scene, ep)">×</button>
                      </div>
                    </div>
                    <div class="asset-cover-actions">
                      <el-button type="primary" size="small" :loading="generatingSceneIds.has(scene.id)" @click="onGenerateSceneImage(scene)">
                        <el-icon v-if="!generatingSceneIds.has(scene.id)"><MagicStick /></el-icon>
                        AI 生成
                      </el-button>
                      <el-button type="success" size="small" :loading="uploadingResourceId === 'scene-' + scene.id" @click="onUploadResourceClick('scene', scene.id)">
                        <el-icon v-if="uploadingResourceId !== 'scene-' + scene.id"><Upload /></el-icon>
                        上传
                      </el-button>
                    </div>
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
            <el-input-number v-model="storyboardCount" :min="1" :max="200" :step="5" placeholder="自动" class="sb-config-input" />
            <span class="sb-config-hint">留空由 AI 决定</span>
          </label>
          <span class="sb-config-divider">｜</span>
          <label class="sb-config-item">
            <span class="sb-config-label">视频总时长(秒)</span>
            <el-input-number v-model="videoDuration" :min="10" :max="600" :step="5" placeholder="自动" class="sb-config-input" />
            <span class="sb-config-hint">留空由 AI 决定</span>
          </label>
          <span class="sb-config-divider">｜</span>
          <label class="sb-config-item">
            <span class="sb-config-label">序列图模式</span>
            <el-select v-model="gridMode" size="small" style="width:110px">
              <el-option label="单张" value="single" />
              <el-option label="四宫格" value="quad_grid" />
              <el-option label="九宫格" value="nine_grid" />
            </el-select>
            <span class="sb-config-hint">四/九宫格自动按视角拆分</span>
          </label>
        </div>
        <div class="asset-actions sb-batch-actions">
          <div class="flex">
            <el-button
              type="primary"
              size="large"
              :loading="storyboardGenerating"
              :disabled="!currentEpisodeId || storyboardGenerating"
              @click="onGenerateStoryboard"
            >
              {{ storyboards.length > 0 ? '重新生成分镜' : 'AI 生成分镜' }}
            </el-button>
            <ElButton type="info" plain size="large" @click="onAddSingleStoryboard">
            添加一个分镜
            </ElButton>
          </div>
          <template v-if="storyboards.length > 0">
            <div class="sb-batch-right">
              <el-button
                type="success"
                plain
                size="large"
                :loading="batchImageRunning"
                :disabled="!currentEpisodeId || batchImageRunning || batchVideoRunning || pipelineRunning || storyboardGenerating"
                @click="startBatchImageGeneration"
              >
                批量生成分镜图
              </el-button>
              <el-button
                type="warning"
                plain
                size="large"
                :loading="batchVideoRunning"
                :disabled="!currentEpisodeId || batchImageRunning || batchVideoRunning || pipelineRunning || storyboardGenerating"
                @click="startBatchVideoGeneration"
              >
                批量生成分镜视频
              </el-button>
              <el-button v-if="batchImageRunning" size="large" type="danger" plain @click="batchImageStopping = true">停止图片</el-button>
              <el-button v-if="batchVideoRunning" size="large" type="danger" plain @click="batchVideoStopping = true">停止视频</el-button>
            </div>
          </template>
        </div>
        <!-- 批量生成进度 -->
        <div v-if="batchImageRunning || batchVideoRunning || batchImageErrors.length || batchVideoErrors.length" class="batch-status">
          <div v-if="batchImageRunning" class="batch-progress">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>批量生成分镜图：{{ batchImageProgress.current }}/{{ batchImageProgress.total }}</span>
            <span v-if="batchImageProgress.failed > 0" class="batch-failed">{{ batchImageProgress.failed }} 条失败</span>
            <span v-if="batchImageStopping" class="batch-stopping">（正在停止...）</span>
          </div>
          <div v-if="batchVideoRunning" class="batch-progress">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>批量生成分镜视频：{{ batchVideoProgress.current }}/{{ batchVideoProgress.total }}</span>
            <span v-if="batchVideoProgress.failed > 0" class="batch-failed">{{ batchVideoProgress.failed }} 条失败</span>
            <span v-if="batchVideoStopping" class="batch-stopping">（正在停止...）</span>
          </div>
          <div v-if="batchImageErrors.length > 0" class="batch-error-log">
            <div class="batch-error-title">分镜图生成失败记录：</div>
            <div v-for="(e, i) in batchImageErrors" :key="i" class="batch-error-line">{{ e }}</div>
          </div>
          <div v-if="batchVideoErrors.length > 0" class="batch-error-log">
            <div class="batch-error-title">分镜视频生成失败记录：</div>
            <div v-for="(e, i) in batchVideoErrors" :key="i" class="batch-error-line">{{ e }}</div>
          </div>
        </div>
        <div v-if="storyboardGenerating" class="storyboard-generating-tip">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>正在分析剧本并拆解分镜，请稍候...</span>
        </div>
        <div v-if="sbTruncatedWarning && !sbTruncatedDismissed && storyboards.length > 0" class="sb-truncated-warning">
          <el-icon><WarningFilled /></el-icon>
          <span>检测到分镜可能不完整（AI 输出被截断），请确认分镜数量是否符合预期，必要时可重新生成。</span>
          <el-button size="small" text @click="sbTruncatedDismissed = true">关闭</el-button>
        </div>
        <template v-if="storyboards.length > 0">
          <template v-for="(sb, i) in storyboards" :key="sb.id">
            <!-- 段落分隔标头：segment_title 存在且是新段落的第一个镜头时显示 -->
            <div
              v-if="sb.segment_title && (i === 0 || sb.segment_index !== storyboards[i - 1].segment_index)"
              class="segment-header"
            >
              <div class="segment-header-inner">
                <span class="segment-index-badge">第 {{ (sb.segment_index ?? 0) + 1 }} 幕</span>
                <span class="segment-title-text">{{ sb.segment_title }}</span>
                <span class="segment-shot-range">
                  镜头 {{ i + 1 }}–{{ (() => {
                    let end = i
                    while (end + 1 < storyboards.length && storyboards[end + 1].segment_index === sb.segment_index) end++
                    return end + 1
                  })() }}
                </span>
              </div>
            </div>
          <div :id="'sb-' + sb.id" class="storyboard-row">
            <div class="sb-num-badge">
              <span>{{ i + 1 }}</span>
              <ElButton  type="danger" size="small" @click="onDeleteSingleStoryboard(sb.id)">删除</ElButton>
            </div>
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
                :class="{ 'sb-image-area--dragover': dragOverSbId === sb.id, 'sb-image-area--has-quad': getStripItems(sb.id).length > 0 }"
                @dragover="onSbImageDragOver($event, sb.id)"
                @dragleave="onSbImageDragLeave($event, sb.id)"
                @drop="onSbImageDrop($event, sb)"
              >
                <!-- 主图区：最新选中/默认图 > legacy composed_image > 错误 > 空 -->
                <div class="sb-main-image-wrap">
                  <template v-if="getSbImage(sb.id)">
                    <img
                      :src="assetImageUrl(getSbImage(sb.id))"
                      class="sb-generated-img"
                      alt=""
                      :title="getSbImage(sb.id).prompt || ''"
                      @click="openImagePreview(assetImageUrl(getSbImage(sb.id)))"
                    />
                    <div v-if="getSbImage(sb.id).prompt" class="sb-main-img-prompt">{{ getSbImage(sb.id).prompt }}</div>
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
                    <el-button type="primary" size="small" class="sb-gen-btn" :loading="generatingSbImageIds.has(sb.id)" @click="onGenerateSbImage(sb)">
                      <el-icon><Refresh /></el-icon>
                      重试
                    </el-button>
                    <el-button size="small" :loading="uploadingSbImageId === sb.id" @click="onUploadSbImageClick(sb)">上传</el-button>
                  </template>
                  <template v-else>
                    <el-button type="primary" size="small" class="sb-gen-btn" :loading="generatingSbImageIds.has(sb.id)" @click="onGenerateSbImage(sb)">
                      <el-icon><MagicStick /></el-icon>
                      生成分镜
                    </el-button>
                    <el-button size="small" :loading="uploadingSbImageId === sb.id" @click="onUploadSbImageClick(sb)">上传</el-button>
                  </template>
                </div>

                <!-- ② 统一缩略图条：未选中的面板 + 其他已生成图（点击切换主图，不触发上传） -->
                <div v-if="getStripItems(sb.id).length" class="sb-imgs-strip">
                  <el-tooltip content="历史图：点击缩略图可设为主图" placement="top" :show-arrow="false">
                    <el-icon class="sb-strip-hint-icon"><InfoFilled /></el-icon>
                  </el-tooltip>
                  <div
                    v-for="item in getStripItems(sb.id)"
                    :key="item.key"
                    class="sb-img-thumb"
                    :title="[item.label, item.prompt].filter(Boolean).join('\n\n') || '点击设为主图'"
                    @click="onSelectStripItem(sb, item)"
                  >
                    <img :src="item.src" alt="" />
                    <span v-if="item.label" class="sb-img-thumb-label">{{ item.label }}</span>
                  </div>
                </div>

                <div v-if="dragOverSbId === sb.id" class="sb-image-area-drop-hint">松开上传</div>
              </div>
              <div v-if="hasSbImage(sb)" class="sb-image-actions">
                <el-button size="small" :loading="generatingSbImageIds.has(sb.id)" @click="onGenerateSbImage(sb)">重新生成</el-button>
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
                <span v-if="generatingSbVideoIds.has(sb.id)" class="sb-video-generating-text">
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
                      <span class="sb-field-label">镜头视角</span>
                      <div style="display:flex;align-items:center;gap:4px;flex:1;flex-wrap:wrap">
                        <el-select v-model="sbAngleS[sb.id]" size="small" placeholder="景别" style="width:82px">
                          <el-option label="特写" value="close_up" />
                          <el-option label="中景" value="medium" />
                          <el-option label="远景" value="wide" />
                        </el-select>
                        <el-select v-model="sbAngleV[sb.id]" size="small" placeholder="俯仰" style="width:90px">
                          <el-option label="平视" value="eye_level" />
                          <el-option label="低角仰拍" value="low" />
                          <el-option label="高角俯拍" value="high" />
                          <el-option label="虫眼仰视" value="worm" />
                        </el-select>
                        <el-select v-model="sbAngleH[sb.id]" size="small" placeholder="方向" style="width:82px">
                          <el-option label="正面" value="front" />
                          <el-option label="前左45°" value="front_left" />
                          <el-option label="左侧" value="left" />
                          <el-option label="后左135°" value="back_left" />
                          <el-option label="背面" value="back" />
                          <el-option label="后右135°" value="back_right" />
                          <el-option label="右侧" value="right" />
                          <el-option label="前右45°" value="front_right" />
                        </el-select>
                        <span v-if="sbAngleS[sb.id] && sbAngleV[sb.id] && sbAngleH[sb.id]"
                              style="font-size:11px;color:#6b7280;white-space:nowrap;background:#f3f4f6;padding:2px 7px;border-radius:4px">
                          {{ angleToPromptFragment(sbAngleH[sb.id], sbAngleV[sb.id], sbAngleS[sb.id]).label }}
                        </span>
                      </div>
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
                :loading="generatingSbVideoIds.has(sb.id)"
                :disabled="!sb.video_prompt"
                @click="onGenerateSbVideo(sb)"
              >
                生成视频
              </el-button>
            </div>
          </div>
          </template>
        </template>
        <!-- 分镜生成中提示条 -->
        <div v-if="storyboardGenerating" class="sb-generating-tip">
          <span class="sb-gen-dot" /><span class="sb-gen-dot" /><span class="sb-gen-dot" />
          <span class="sb-gen-text">分镜持续生成中，客官稍等片刻…</span>
        </div>
        <div v-else-if="storyboards.length === 0" class="empty-tip">请先生成分镜</div>
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
    <el-dialog v-model="showEditCharacter" :title="editCharacterForm?.id ? '编辑角色' : '添加角色'" width="75%" @close="() => { showEditCharacter = false; stopCharacterPromptPoll(); editCharacterPromptGenerating = false }">
      <el-form v-if="editCharacterForm" label-width="90px">
        <el-form-item label="名称" required>
          <el-input v-model="editCharacterForm.name" placeholder="角色名称" />
        </el-form-item>
        <el-form-item label="身份/定位">
          <el-select v-model="editCharacterForm.role" placeholder="请选择角色类型" style="width:200px">
            <el-option value="main" label="主角" />
            <el-option value="supporting" label="配角" />
            <el-option value="minor" label="次要角色" />
          </el-select>
        </el-form-item>
        <el-form-item label="外貌描述">
          <el-input v-model="editCharacterForm.appearance" type="textarea" :autosize="{ minRows: 4, maxRows: 10 }" placeholder="用于 AI 生成图像的外貌描述，尽量详细" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="editCharacterForm.description" type="textarea" :autosize="{ minRows: 3, maxRows: 8 }" placeholder="角色背景简介，供剧本生成参考" />
        </el-form-item>
        <el-form-item v-if="editCharacterForm.id">
          <template #label>
            <span style="font-size:12px;line-height:1.4;white-space:normal;word-break:break-all;display:inline-block;width:90px">图生提示词</span>
          </template>
          <div style="width:100%">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="font-size:12px;color:#909399">AI 润色后的最终提示词，生成四视图图片时直接使用；可手动修改</span>
              <el-button
                size="small"
                :loading="editCharacterPromptGenerating"
                @click="doGenerateCharacterPrompt"
              >重新生成提示词</el-button>
            </div>
            <el-input
              v-model="editCharacterForm.polished_prompt"
              type="textarea"
              :autosize="{ minRows: 5, maxRows: 16 }"
              :placeholder="editCharacterPromptGenerating ? 'AI 正在生成提示词，请稍候…' : '点击「重新生成提示词」由 AI 自动生成，或直接在此输入'"
              :disabled="editCharacterPromptGenerating"
              style="font-size:12px"
            />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditCharacter = false">取消</el-button>
        <el-button type="primary" :loading="editCharacterSaving" :disabled="!editCharacterForm?.name?.trim()" @click="submitEditCharacter">{{ editCharacterForm?.id ? '保存' : '添加' }}</el-button>
      </template>
    </el-dialog>

    <!-- 编辑道具弹窗 -->
    <el-dialog v-model="showEditProp" title="编辑道具" width="75%" @close="() => { showEditProp = false; stopPropPromptPoll(); editPropPromptGenerating = false }">
      <el-form v-if="editPropForm" label-width="90px">
        <el-form-item label="名称" required>
          <el-input v-model="editPropForm.name" placeholder="道具名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-input v-model="editPropForm.type" placeholder="如：物品、建筑" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editPropForm.description" type="textarea" :autosize="{ minRows: 3, maxRows: 8 }" placeholder="道具描述" />
        </el-form-item>
        <el-form-item label="图生提示词">
          <div style="width:100%">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="font-size:12px;color:#909399">AI 润色后的图片提示词，生成图片时直接使用；可手动修改</span>
              <el-button size="small" :loading="editPropPromptGenerating" @click="doGeneratePropPrompt">重新生成提示词</el-button>
            </div>
            <el-input
              v-model="editPropForm.prompt"
              type="textarea"
              :autosize="{ minRows: 5, maxRows: 16 }"
              :placeholder="editPropPromptGenerating ? 'AI 正在生成提示词，请稍候…' : '点击「重新生成提示词」由 AI 自动生成，或直接在此输入'"
              :disabled="editPropPromptGenerating"
            />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditProp = false">取消</el-button>
        <el-button type="primary" :loading="editPropSaving" :disabled="!editPropForm?.name?.trim()" @click="submitEditProp">保存</el-button>
      </template>
    </el-dialog>

    <!-- 添加/编辑场景弹窗 -->
    <el-dialog v-model="showEditScene" :title="editSceneForm?.id ? '编辑场景' : '添加场景'" width="75%" @close="() => { showEditScene = false; stopScenePromptPoll(); editScenePromptGenerating = false }">
      <el-form v-if="editSceneForm" label-width="90px">
        <el-form-item label="地点" required>
          <el-input v-model="editSceneForm.location" placeholder="如：森林、教室" />
        </el-form-item>
        <el-form-item label="时间">
          <el-input v-model="editSceneForm.time" placeholder="如：白天、傍晚" />
        </el-form-item>
        <el-form-item label="场景描述">
          <el-input v-model="editSceneForm.prompt" type="textarea" :autosize="{ minRows: 3, maxRows: 8 }" placeholder="场景的简要描述，供 AI 生成四视图时参考" />
        </el-form-item>
        <el-form-item v-if="editSceneForm.id">
          <template #label>
            <span style="font-size:12px;line-height:1.4;white-space:normal;word-break:break-all;display:inline-block;width:90px">四视图提示词</span>
          </template>
          <div style="width:100%">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="font-size:12px;color:#909399">AI 生成的完整四视图图片提示词，生图时直接使用；可手动修改</span>
              <el-button size="small" :loading="editScenePromptGenerating" @click="doGenerateScenePrompt">重新生成提示词</el-button>
            </div>
            <el-input
              v-model="editSceneForm.polished_prompt"
              type="textarea"
              :autosize="{ minRows: 5, maxRows: 16 }"
              :placeholder="editScenePromptGenerating ? 'AI 正在生成四视图提示词，请稍候…' : '点击「重新生成提示词」由 AI 自动生成，或直接在此输入'"
              :disabled="editScenePromptGenerating"
              style="font-size:12px"
            />
          </div>
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
          <el-input v-model="editSceneLibraryForm.time" placeholder="如：浅色/夜晚" />
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
import { ref, computed, onMounted, onBeforeUnmount, reactive, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Setting, Plus, Minus, Sunny, Moon, MagicStick, Upload, Delete, Check, Loading, WarningFilled, User, Box, Picture, Film, VideoCamera, Document, InfoFilled, Refresh } from '@element-plus/icons-vue'
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
import { generationSettingsAPI } from '@/api/prompts'
import StylePickerButton from '@/components/StylePickerButton.vue'
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
const storyEpisodeCount = ref(1)
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
// value = 存库的短标识（向后兼容）
// prompt = 中文描述（界面展示用）
// promptEn = 英文描述（传给图像/视频 AI 用，效果更好）
const generationStyleOptions = [
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

/** 根据 value 查找样式选项对象 */
function _findStyleOption(val) {
  for (const group of generationStyleOptions) {
    const found = group.options.find(o => o.value === val)
    if (found) return found
  }
  return null
}

/** 传给图像/视频 AI 用的英文 prompt（效果最好）；
 *  找不到 promptEn 时降级到 prompt，再降级到原始值 */
function getSelectedStylePrompt() {
  const val = (generationStyle.value || '').toString().trim()
  if (!val) return undefined
  const opt = _findStyleOption(val)
  if (opt) return opt.promptEn || opt.prompt || val
  return val
}

/** 中文风格描述（用于界面展示或中文场景提示词拼接） */
function getSelectedStylePromptZh() {
  const val = (generationStyle.value || '').toString().trim()
  if (!val) return undefined
  const opt = _findStyleOption(val)
  if (opt) return opt.prompt || opt.promptEn || val
  return val
}
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
const generatingCharIds = reactive(new Set())
const generatingPropIds = reactive(new Set())
const generatingSceneIds = reactive(new Set())
const propsExtracting = ref(false)
const scenesExtracting = ref(false)
const storyboardGenerating = ref(false)
const sbTruncatedWarning = ref(false)
const sbTruncatedDismissed = ref(false)
const videoErrorMsg = ref('')
// 一键全流程流水线
const pipelineRunning = ref(false)
const pipelinePaused = ref(false)
const pipelineErrorLog = ref([])
const pipelineCurrentStep = ref('')
const pipelineStepIndex = ref(0)    // 当前步骤序号（1-based）
const PIPELINE_TOTAL_STEPS = 7      // 固定 7 大步骤
let pipelineResolveResume = null
const pipelineConcurrency = ref(3)
const pipelineVideoConcurrency = ref(3)
const pipelineActiveTasks = ref(new Set())

async function loadPipelineConcurrency() {
  try {
    const res = await generationSettingsAPI.get()
    pipelineConcurrency.value = Math.max(1, Number(res?.concurrency) || 3)
    pipelineVideoConcurrency.value = Math.max(1, Number(res?.video_concurrency) || 3)
  } catch (_) {}
}

/**
 * 带并发度的批量执行器。
 * @param {Array} items - 需要处理的项目列表
 * @param {number} concurrency - 最大并发数
 * @param {Function} fn - async (item, index) => void，内部可 throw 或 return {paused}
 * @param {{ getLabel?: (item) => string }} options
 * @returns {Promise<{paused: boolean}>}
 */
async function runConcurrently(items, concurrency, fn, options = {}) {
  let index = 0
  let anyPaused = false
  const getLabel = options.getLabel || (() => null)

  async function worker() {
    while (index < items.length) {
      const i = index++
      const item = items[i]
      const label = getLabel(item)
      if (label) pipelineActiveTasks.value.add(label)
      try {
        const result = await fn(item, i)
        if (result && typeof result === 'object' && result.paused) {
          anyPaused = true
          return
        }
      } finally {
        if (label) pipelineActiveTasks.value.delete(label)
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.allSettled(workers)
  return { paused: anyPaused }
}
const showAddProp = ref(false)
const addPropSaving = ref(false)
const addPropForm = ref({ name: '', type: '', description: '', prompt: '' })

const showEditCharacter = ref(false)
const editCharacterForm = ref(null)
const editCharacterSaving = ref(false)
const editCharacterPromptGenerating = ref(false)
let editCharacterPollTimer = null

const showEditProp = ref(false)
const editPropForm = ref(null)
const editPropSaving = ref(false)
const editPropPromptGenerating = ref(false)
let editPropPollTimer = null

const showEditScene = ref(false)
const editSceneForm = ref(null)
const editSceneSaving = ref(false)
const editScenePromptGenerating = ref(false)
let editScenePollTimer = null

// 资源管理大面板及子区块折叠状态
const resourcePanelCollapsed = ref(false)
const charactersBlockCollapsed = ref(false)
const propsBlockCollapsed = ref(false)
const scenesBlockCollapsed = ref(false)

// 分镜行内编辑状态（按 storyboard id 存储）
const storyboardMenuExpanded = ref(false)
const navCollapsed = ref(false)
const NAV_AUTO_COLLAPSE_WIDTH = 960  // 窗口宽度低于此值自动折叠
let _navAutoCollapsed = false         // 是否是自动折叠（区分用户手动）

function _syncNavCollapse() {
  const narrow = window.innerWidth < NAV_AUTO_COLLAPSE_WIDTH
  if (narrow && !_navAutoCollapsed && !navCollapsed.value) {
    _navAutoCollapsed = true
    navCollapsed.value = true
  } else if (!narrow && _navAutoCollapsed) {
    _navAutoCollapsed = false
    navCollapsed.value = false
  }
}

function toggleNav() {
  navCollapsed.value = !navCollapsed.value
  _navAutoCollapsed = false  // 用户手动操作，不再跟随自动
}

/** 左侧导航各步骤状态 */
const navSteps = computed(() => {
  // 剧本
  const hasScript = !!(scriptContent?.value?.trim())
  const scriptStatus = (storyGenerating.value || scriptGenerating.value)
    ? 'generating'
    : hasScript ? 'done' : 'pending'

  // 角色
  const charList = characters.value || []
  const charDone = charList.length > 0 && charList.every(c => c.image_url)
  const charGen = charactersGenerating.value || generatingCharIds.size > 0
  const charStatus = charGen ? 'generating' : charDone ? 'done' : charList.length > 0 ? 'partial' : 'pending'

  // 道具
  const propList = props.value || []
  const propDone = propList.length > 0 && propList.every(p => p.image_url)
  const propGen = propsExtracting.value || generatingPropIds.size > 0
  const propStatus = propGen ? 'generating' : propDone ? 'done' : propList.length > 0 ? 'partial' : 'pending'

  // 场景
  const sceneList = scenes.value || []
  const sceneDone = sceneList.length > 0 && sceneList.every(s => s.image_url)
  const sceneGen = scenesExtracting.value || generatingSceneIds.size > 0
  const sceneStatus = sceneGen ? 'generating' : sceneDone ? 'done' : sceneList.length > 0 ? 'partial' : 'pending'

  // 分镜脚本
  const sbList = storyboards.value || []
  const sbScriptDone = sbList.length > 0
  const sbScriptGen = storyboardGenerating.value
  const sbScriptStatus = sbScriptGen ? 'generating' : sbScriptDone ? 'done' : 'pending'

  // 分镜图
  const sbImgDone = sbList.length > 0 && sbList.every(sb => {
    const imgs = sbImages.value[sb.id]
    return imgs && imgs.length > 0
  })
  const sbImgGen = generatingSbImageIds.size > 0 || batchImageRunning.value
  const sbImgStatus = sbImgGen ? 'generating' : sbImgDone ? 'done' : sbList.length > 0 ? 'partial' : 'pending'

  // 视频
  const sbVideoAllDone = sbList.length > 0 && sbList.every(sb => {
    const vids = sbVideos.value[sb.id]
    return vids && vids.length > 0
  })
  const sbVideoSome = sbList.some(sb => {
    const vids = sbVideos.value[sb.id]
    return vids && vids.length > 0
  })
  const sbVideoGen = batchVideoRunning.value || generatingSbVideoIds.size > 0
  const videoStatus = sbVideoGen ? 'generating' : sbVideoAllDone ? 'done' : sbVideoSome ? 'partial' : 'pending'

  return [
    { key: 'script',   label: '故事剧本',   anchor: 'anchor-script',     status: scriptStatus,    count: hasScript ? 1 : 0 },
    { key: 'chars',    label: '角色',        anchor: 'anchor-characters', status: charStatus,      count: charList.length },
    { key: 'props',    label: '道具',        anchor: 'anchor-props',      status: propStatus,      count: propList.length },
    { key: 'scenes',   label: '场景',        anchor: 'anchor-scenes',     status: sceneStatus,     count: sceneList.length },
    { key: 'sb',       label: '分镜脚本',   anchor: 'anchor-storyboard', status: sbScriptStatus,  count: sbList.length },
    { key: 'sbimg',    label: '分镜图',      anchor: 'anchor-storyboard', status: sbImgStatus,     count: sbList.length },
    { key: 'video',    label: '分镜视频',   anchor: 'anchor-video',      status: videoStatus,     count: 0 },
  ]
})

/** 聚合所有当前正在运行的任务标签，用于悬浮任务面板 */
const allActiveTasks = computed(() => {
  const tasks = []
  // 整体操作
  if (storyGenerating.value || scriptGenerating.value) tasks.push('生成剧本...')
  if (charactersGenerating.value) tasks.push('提取角色...')
  if (propsExtracting.value) tasks.push('提取道具...')
  if (scenesExtracting.value) tasks.push('提取场景...')
  if (storyboardGenerating.value) tasks.push('生成分镜脚本...')
  if (batchImageRunning.value) tasks.push('批量生成分镜图...')
  if (batchVideoRunning.value) tasks.push('批量生成分镜视频...')
  // 单个角色图
  for (const id of generatingCharIds) {
    const char = (characters.value || []).find(c => Number(c.id) === Number(id))
    tasks.push('角色图: ' + (char?.name || '#' + id))
  }
  // 单个道具图
  for (const id of generatingPropIds) {
    const prop = (props.value || []).find(p => Number(p.id) === Number(id))
    tasks.push('道具图: ' + (prop?.name || '#' + id))
  }
  // 单个场景图
  for (const id of generatingSceneIds) {
    const scene = (scenes.value || []).find(s => Number(s.id) === Number(id))
    tasks.push('场景图: ' + (scene?.location || '#' + id))
  }
  // 单个分镜图
  for (const id of generatingSbImageIds) {
    const sb = (storyboards.value || []).find(s => Number(s.id) === Number(id))
    tasks.push('分镜图 #' + (sb?.storyboard_number ?? id))
  }
  // 单个分镜视频
  for (const id of generatingSbVideoIds) {
    const sb = (storyboards.value || []).find(s => Number(s.id) === Number(id))
    tasks.push('分镜视频 #' + (sb?.storyboard_number ?? id))
  }
  return tasks
})
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
const sbAngleH = ref({})   // 结构化视角：水平方向
const sbAngleV = ref({})   // 结构化视角：俯仰角度
const sbAngleS = ref({})   // 结构化视角：景别
const sbMovement = ref({})
// 分镜图片/视频列表（由 /images?storyboard_id=xx 和 /videos?storyboard_id=xx 拉取）
const sbImages = ref({})
const sbVideos = ref({})
const sbVideoErrors = ref({})
const generatingSbImageIds = reactive(new Set())
const generatingSbVideoIds = reactive(new Set())
// 重新生成角色/场景关联分镜图的 loading set，key: 'char-{id}' | 'scene-{id}'
const regenSbImagesForAsset = reactive(new Set())
const regenSbImagesProgress = ref({})
// 批量生成分镜图
const batchImageRunning = ref(false)
const batchImageStopping = ref(false)
const batchImageProgress = ref({ current: 0, total: 0, failed: 0 })
const batchImageErrors = ref([])
// 批量生成分镜视频
const batchVideoRunning = ref(false)
const batchVideoStopping = ref(false)
const batchVideoProgress = ref({ current: 0, total: 0, failed: 0 })
const batchVideoErrors = ref([])
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
const gridMode = ref('single') // 序列图模式：single / quad_grid / nine_grid
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
  return getSelectedStylePrompt()
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
/** 取该分镜下所有已完成的非四宫格图片列表 */
function getSbAllImages(storyboardId) {
  const list = sbImages.value[storyboardId]
  if (!Array.isArray(list)) return []
  return list.filter((i) => i.status === 'completed' && i.frame_type !== 'quad_grid' && i.frame_type !== 'nine_grid' && (i.image_url || i.local_path))
}
/** 取当前主图（尊重 sbSelectedImgId 选择，否则默认第一张） */
function getSbImage(storyboardId) {
  const images = getSbAllImages(storyboardId)
  if (!images.length) return null
  const selectedId = sbSelectedImgId.value[storyboardId]
  if (selectedId != null) {
    const found = images.find((i) => i.id === selectedId)
    if (found) return found
  }
  return images[0]
}
/** 取该分镜下的四宫格整图记录 */
/** 取该分镜下的四宫格整图记录 */
function getQuadGridImage(storyboardId) {
  const list = sbImages.value[storyboardId]
  if (!Array.isArray(list)) return null
  return list.find((i) => i.status === 'completed' && (i.frame_type === 'quad_grid' || i.frame_type === 'nine_grid') && (i.image_url || i.local_path)) || null
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
  // 从后端恢复主图选择
  restoreSelectionsFromBackend()
}

// ── 主图选择 ─────────────────────────────────────────────────────────

const sbSelectedImgId = ref({})   // sbId → 选中的 image_generation.id

/**
 * 从后端 storyboard.image_url / local_path 恢复主图选择状态。
 * 与 image_generation 记录比对，找到匹配的记录并恢复 sbSelectedImgId。
 */
function restoreSelectionsFromBackend() {
  const boards = store.storyboards || []
  for (const sb of boards) {
    if (sbSelectedImgId.value[sb.id] != null) continue
    const sbPath = (sb.local_path || '').trim()
    const sbUrl  = (sb.image_url  || '').trim()
    if (!sbPath && !sbUrl) continue
    const images = getSbAllImages(sb.id)
    const matched = images.find((img) =>
      (sbPath && img.local_path && img.local_path === sbPath) ||
      (sbUrl  && img.image_url  && img.image_url  === sbUrl)
    )
    if (matched) {
      sbSelectedImgId.value = { ...sbSelectedImgId.value, [sb.id]: matched.id }
    }
  }
}

/** 获取缩略图条数据：主图以外的所有已完成图片（四宫格子图 + 普通历史图） */
function getStripItems(storyboardId) {
  const allImgs = getSbAllImages(storyboardId)
  const mainImg = getSbImage(storyboardId)
  return allImgs
    .filter((img) => !mainImg || img.id !== mainImg.id)
    .map((img) => ({
      key: `img-${img.id}`,
      src: assetImageUrl(img),
      type: 'img',
      img,
      label: quadPanelLabel(img.frame_type),
      prompt: img.prompt || '',
    }))
}

/** 宫格子图位置标签 */
function quadPanelLabel(frameType) {
  const map = {
    quad_panel_0: '左上', quad_panel_1: '右上', quad_panel_2: '左下', quad_panel_3: '右下',
    nine_panel_0: '左上', nine_panel_1: '中上', nine_panel_2: '右上',
    nine_panel_3: '左中', nine_panel_4: '中间', nine_panel_5: '右中',
    nine_panel_6: '左下', nine_panel_7: '中下', nine_panel_8: '右下',
  }
  return map[frameType] || null
}

/** 点击缩略图条中的图片切换为主图 */
function onSelectStripItem(sb, item) {
  onSelectSbMainImage(sb, item.img)
}

/** 选定某张 API 图为主图（持久化到后端） */
function onSelectSbMainImage(sb, img) {
  sbSelectedImgId.value = { ...sbSelectedImgId.value, [sb.id]: img.id }
  storyboardsAPI.update(sb.id, {
    image_url: img.image_url || null,
    local_path: img.local_path || undefined,
  }).catch(e => console.warn('[主图] 保存后端失败', e))
}

// ──────────────────────────────────────────────────────────────────────

async function onGenerateSbImage(sb) {
  if (!dramaId.value || !sb?.id) return
  sb.errorMsg = ''
  sb.error_msg = ''
  generatingSbImageIds.add(sb.id)
  try {
    const res = await imagesAPI.create({
      storyboard_id: sb.id,
      drama_id: dramaId.value,
      prompt: sb.image_prompt || sb.description || '',
      model: undefined,
      style: getSelectedStyle(),
      frame_type: gridMode.value !== 'single' ? gridMode.value : undefined,
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
    generatingSbImageIds.delete(sb.id)
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
    // 清除手动选择，让最新上传的图（images[0]）自动成为主图
    const { [sbId]: _r, ...rest } = sbSelectedImgId.value
    sbSelectedImgId.value = rest
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
  const nextAngleH = {}
  const nextAngleV = {}
  const nextAngleS = {}
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
    nextAngleH[sb.id] = sb.angle_h || ''
    nextAngleV[sb.id] = sb.angle_v || ''
    nextAngleS[sb.id] = sb.angle_s || ''
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
  sbAngleH.value = nextAngleH
  sbAngleV.value = nextAngleV
  sbAngleS.value = nextAngleS
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
  onStoryboardPropChange(sbId)
}

function onStoryboardPropChange(sbId) {
  const ids = sbPropIds.value[sbId] || []
  storyboardsAPI.update(sbId, { prop_ids: ids }).catch(() => {})
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
  const ids = sbCharacterIds.value[sbId] || []
  storyboardsAPI.update(sbId, { character_ids: ids }).catch(() => {})
}

function onStoryboardSceneChange(sbId) {
  const sceneId = sbSceneId.value[sbId] ?? null
  storyboardsAPI.update(sbId, { scene_id: sceneId }).catch(() => {})
}

/** 返回包含指定角色的所有分镜（已排序） */
function getCharAffectedStoryboards(charId) {
  return (storyboards.value || []).filter((sb) => {
    if (!sb.characters) return false
    const chars = Array.isArray(sb.characters) ? sb.characters : []
    return chars.some((c) => Number(typeof c === 'object' && c != null ? c.id : c) === Number(charId))
  })
}

/** 返回指定场景关联的所有分镜 */
function getSceneAffectedStoryboards(sceneId) {
  return (storyboards.value || []).filter((sb) => sb.scene_id != null && Number(sb.scene_id) === Number(sceneId))
}

/** 点击分镜 chip → 滚动到对应分镜行 */
function scrollToStoryboard(sbId) {
  const el = document.getElementById('sb-' + sbId)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/** 对关联分镜批量重新生成图片 */
async function onRegenAffectedSbImages(assetKey, affectedBoards) {
  if (!affectedBoards.length || regenSbImagesForAsset.has(assetKey)) return
  try {
    await ElMessageBox.confirm(
      `将为 ${affectedBoards.length} 个关联分镜重新生成图片（#${affectedBoards.map((s) => s.storyboard_number).join('、#')}），原有图片将被覆盖，是否继续？`,
      '重新生成关联分镜图',
      { confirmButtonText: '确认生成', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  regenSbImagesForAsset.add(assetKey)
  // 用 Map 存进度以便响应式更新
  if (!regenSbImagesProgress.value) regenSbImagesProgress.value = {}
  regenSbImagesProgress.value[assetKey] = { current: 0, total: affectedBoards.length }
  let failed = 0
  try {
    for (let i = 0; i < affectedBoards.length; i++) {
      regenSbImagesProgress.value[assetKey] = { current: i + 1, total: affectedBoards.length }
      const sb = affectedBoards[i]
      try {
        const res = await imagesAPI.create({
          storyboard_id: sb.id,
          drama_id: dramaId.value,
          prompt: sb.image_prompt || sb.description || '',
          style: getSelectedStyle()
        })
        if (res?.task_id) {
          const pollRes = await new Promise((resolve) => {
            const maxAttempts = 180
            let attempts = 0
            const tick = async () => {
              attempts++
              try {
                const t = await taskAPI.get(res.task_id)
                if (t.status === 'completed') { await loadStoryboardMedia(); return resolve({ status: 'completed' }) }
                if (t.status === 'failed') return resolve({ status: 'failed', error: t.error || '任务失败' })
              } catch (_) {}
              if (attempts < maxAttempts) setTimeout(tick, 2000)
              else resolve({ status: 'timeout' })
            }
            setTimeout(tick, 2000)
          })
          if (pollRes?.status !== 'completed') failed++
        } else {
          await loadStoryboardMedia()
        }
      } catch (_) {
        failed++
      }
      if (i < affectedBoards.length - 1) await new Promise((r) => setTimeout(r, 500))
    }
    if (failed === 0) ElMessage.success(`已重新生成 ${affectedBoards.length} 张关联分镜图`)
    else ElMessage.warning(`完成，${failed}/${affectedBoards.length} 条失败`)
  } finally {
    regenSbImagesForAsset.delete(assetKey)
    if (regenSbImagesProgress.value) delete regenSbImagesProgress.value[assetKey]
  }
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
      type: storyType.value || undefined,
      episode_count: storyEpisodeCount.value || 1,
    })

    // 后端现在统一返回 { episodes: [...] }
    const episodes = res?.episodes || []
    if (episodes.length === 0) {
      ElMessage.error('AI 未能生成剧本，请重试')
      return
    }

    scriptGenerating.value = true
    try {
      let dramaId = store.dramaId
      if (!dramaId) {
        // 创建项目
        const drama = await dramaAPI.create({
          title: scriptTitle.value || '新故事',
          description: text,
          genre: storyType.value || undefined,
          style: generationStyle.value || undefined,
          metadata: { story_style: storyStyle.value || undefined, aspect_ratio: projectAspectRatio.value || '16:9' }
        })
        store.setDrama(drama)
        dramaId = drama.id
        if (route.params.id === 'new') {
          router.replace('/film/' + dramaId)
        }
      }

      // 保存所有生成的集数
      const epPayload = episodes.map((ep, i) => ({
        episode_number: ep.episode ?? i + 1,
        title: ep.title || `第${ep.episode ?? i + 1}集`,
        script_content: ep.content || '',
      }))
      savedCurrentEpisodeNumber.value = 1
      await dramaAPI.saveEpisodes(dramaId, epPayload)

      // 保存梗概
      await dramaAPI.saveOutline(dramaId, {
        summary: text,
        genre: storyType.value || undefined,
        style: generationStyle.value || undefined,
        metadata: { story_style: storyStyle.value || undefined, aspect_ratio: projectAspectRatio.value || '16:9' }
      }).catch(() => {})

      await loadDrama()

      // 默认选中第 1 集
      const firstEp = (store.drama?.episodes || [])[0]
      if (firstEp) {
        selectedEpisodeId.value = firstEp.id
        onEpisodeSelect(firstEp.id)
      }

      const n = episodes.length
      ElMessage.success(n > 1 ? `剧本已生成，共 ${n} 集，已默认选中第1集` : '剧本已生成并已保存')
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
    description: '',
    polished_prompt: ''
  }
  showEditCharacter.value = true
}

function stopCharacterPromptPoll() {
  if (editCharacterPollTimer) {
    clearInterval(editCharacterPollTimer)
    editCharacterPollTimer = null
  }
}

const CHAR_ROLE_LABEL = { main: '主角', supporting: '配角', minor: '次要角色' }
function charRoleLabel(role) { return CHAR_ROLE_LABEL[role] || role || '' }

function editCharacter(char) {
  stopCharacterPromptPoll()
  editCharacterForm.value = {
    id: char.id,
    name: char.name || '',
    role: char.role || '',
    appearance: char.appearance || '',
    personality: char.personality || '',
    description: char.description || '',
    polished_prompt: char.polished_prompt || ''
  }
  showEditCharacter.value = true
  // 如果提示词还没有，说明后台异步可能还在跑，轮询等待（最多 60 秒）
  if (!char.polished_prompt && char.id && (char.appearance || char.description)) {
    editCharacterPromptGenerating.value = true
    let elapsed = 0
    editCharacterPollTimer = setInterval(async () => {
      elapsed += 3
      try {
        const res = await characterAPI.get(char.id)
        const prompt = res?.character?.polished_prompt
        if (prompt) {
          if (editCharacterForm.value?.id === char.id) {
            editCharacterForm.value.polished_prompt = prompt
          }
          stopCharacterPromptPoll()
          editCharacterPromptGenerating.value = false
        } else if (elapsed >= 60) {
          // 超时：后台可能失败，停止轮询，让用户手动触发
          stopCharacterPromptPoll()
          editCharacterPromptGenerating.value = false
        }
      } catch (_) {
        stopCharacterPromptPoll()
        editCharacterPromptGenerating.value = false
      }
    }, 3000)
  }
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
        description: form.description || undefined,
        polished_prompt: form.polished_prompt || undefined
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

async function doGenerateCharacterPrompt() {
  const form = editCharacterForm.value
  if (!form?.id) return
  editCharacterPromptGenerating.value = true
  try {
    const res = await characterAPI.generatePrompt(form.id)
    if (res?.polished_prompt) {
      form.polished_prompt = res.polished_prompt
      ElMessage.success('提示词已生成')
    }
  } catch (e) {
    ElMessage.error(e.message || '生成提示词失败')
  } finally {
    editCharacterPromptGenerating.value = false
  }
}

function onUploadResourceClick(type, id) {
  resourceUploadType.value = type
  resourceUploadId.value = id
  resourceImageFileInput.value?.click()
}

// 解析 extra_images JSON，返回 local_path 数组
function parseExtraImages(item) {
  if (!item?.extra_images) return []
  try {
    const arr = typeof item.extra_images === 'string' ? JSON.parse(item.extra_images) : item.extra_images
    return Array.isArray(arr) ? arr.filter(Boolean) : []
  } catch { return [] }
}

// 将 local_path 转成可访问的 URL
function localPathToUrl(p) {
  if (!p) return ''
  if (p.startsWith('http')) return p
  return '/static/' + p.replace(/^\//, '')
}

// 查找角色/道具/场景在 store 中的当前对象
function findResource(type, id) {
  const list = type === 'character' ? (store.characters ?? [])
    : type === 'prop' ? (store.props ?? [])
    : (store.scenes ?? [])
  return list.find((x) => Number(x.id) === Number(id)) || null
}

async function doUploadResourceImage(type, id, file) {
  if (!file || !type || id == null) return
  const key = type === 'character' ? 'char-' : type === 'prop' ? 'prop-' : 'scene-'
  uploadingResourceId.value = key + id
  try {
    const res = await uploadAPI.uploadImage(file)
    const data = res?.data ?? res
    const uploadedLocalPath = data?.local_path || data?.path || null
    const url = data?.url || uploadedLocalPath
    if (!url) { ElMessage.error('上传未返回地址'); return }

    const current = findResource(type, id)
    const hasPrimary = !!(current?.local_path || current?.image_url)

    if (hasPrimary) {
      // 已有主图 → 追加到 extra_images
      const extras = parseExtraImages(current)
      const newPath = uploadedLocalPath || url
      if (!extras.includes(newPath)) extras.push(newPath)
      const extraJson = JSON.stringify(extras)
      if (type === 'character') {
        await characterAPI.putImage(id, { extra_images: extraJson })
      } else if (type === 'prop') {
        await propAPI.update(id, { extra_images: extraJson })
      } else if (type === 'scene') {
        await sceneAPI.update(id, { extra_images: extraJson })
      }
    } else {
      // 无主图 → 设为主图
      if (type === 'character') {
        await characterAPI.putImage(id, { image_url: url, local_path: uploadedLocalPath ?? null })
      } else if (type === 'prop') {
        await propAPI.update(id, { image_url: url, local_path: uploadedLocalPath ?? null })
      } else if (type === 'scene') {
        await sceneAPI.update(id, { image_url: url, local_path: uploadedLocalPath ?? null })
      }
    }
    await loadDrama()
    ElMessage.success('上传成功')
  } catch (e) {
    ElMessage.error(e.message || '上传失败')
  } finally {
    uploadingResourceId.value = null
  }
}

// 将某张额外图片设为主图（主图降级到 extra_images 第一位）
async function onSetPrimaryImage(type, item, extraPath) {
  const extras = parseExtraImages(item)
  const oldPrimary = item.local_path || ''
  const newExtras = extras.filter((p) => p !== extraPath)
  if (oldPrimary) newExtras.unshift(oldPrimary)
  const extraJson = JSON.stringify(newExtras)
  try {
    if (type === 'character') {
      await characterAPI.putImage(item.id, { local_path: extraPath, image_url: '', extra_images: extraJson })
    } else if (type === 'prop') {
      await propAPI.update(item.id, { local_path: extraPath, image_url: '', extra_images: extraJson })
    } else if (type === 'scene') {
      await sceneAPI.update(item.id, { local_path: extraPath, image_url: '', extra_images: extraJson })
    }
    await loadDrama()
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

// 删除某张额外图片
async function onRemoveExtraImage(type, item, extraPath) {
  const extras = parseExtraImages(item).filter((p) => p !== extraPath)
  const extraJson = extras.length ? JSON.stringify(extras) : null
  try {
    if (type === 'character') {
      await characterAPI.putImage(item.id, { extra_images: extraJson })
    } else if (type === 'prop') {
      await propAPI.update(item.id, { extra_images: extraJson })
    } else if (type === 'scene') {
      await sceneAPI.update(item.id, { extra_images: extraJson })
    }
    await loadDrama()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
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
      id: c.id, // 保留 id 以便后端识别为已有角色
      name: c.name || '',
      role: c.role || undefined,
      appearance: c.appearance || undefined,
      personality: c.personality || undefined,
      description: c.description || undefined,
      image_url: c.image_url || undefined,
      local_path: c.local_path || undefined, // 保留 local_path
    }))
    
    // 只保留当前集的角色关联关系
    const newCharacters = [...existing];
    // 如果角色已存在（通过名字判断），则复用其 ID 进行更新
    const existingChar = newCharacters.find(c => c.name === (item.name || '未命名'));
    if (existingChar) {
      // 更新已有角色信息
      existingChar.description = item.description || existingChar.description;
      existingChar.appearance = item.appearance || existingChar.appearance;
      existingChar.image_url = item.image_url || existingChar.image_url;
      existingChar.local_path = item.local_path || existingChar.local_path;
    } else {
      newCharacters.push({
        name: item.name || '未命名',
        description: item.description || undefined,
        appearance: item.appearance || undefined,
        image_url: item.image_url || undefined,
        local_path: item.local_path || undefined,
      });
    }

    await dramaAPI.saveCharacters(store.dramaId, {
      characters: newCharacters,
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
  generatingCharIds.add(char.id)
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
    generatingCharIds.delete(char.id)
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

function stopPropPromptPoll() {
  if (editPropPollTimer) { clearInterval(editPropPollTimer); editPropPollTimer = null }
}

function editProp(prop) {
  stopPropPromptPoll()
  editPropForm.value = {
    id: prop.id,
    name: prop.name || '',
    type: prop.type || '',
    description: prop.description || '',
    prompt: prop.prompt || ''
  }
  showEditProp.value = true
  if (!prop.prompt && prop.id && prop.description) {
    editPropPromptGenerating.value = true
    let elapsed = 0
    editPropPollTimer = setInterval(async () => {
      elapsed += 3
      try {
        const res = await propAPI.get(prop.id)
        const p = res?.prop?.prompt
        if (p) {
          if (editPropForm.value?.id === prop.id) editPropForm.value.prompt = p
          stopPropPromptPoll(); editPropPromptGenerating.value = false
        } else if (elapsed >= 60) {
          stopPropPromptPoll(); editPropPromptGenerating.value = false
        }
      } catch (_) { stopPropPromptPoll(); editPropPromptGenerating.value = false }
    }, 3000)
  }
}

async function doGeneratePropPrompt() {
  const form = editPropForm.value
  if (!form?.id) return
  editPropPromptGenerating.value = true
  try {
    const res = await propAPI.generatePrompt(form.id)
    if (res?.prompt) { form.prompt = res.prompt; ElMessage.success('提示词已生成') }
  } catch (e) {
    ElMessage.error(e.message || '生成提示词失败')
  } finally {
    editPropPromptGenerating.value = false
  }
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
  generatingPropIds.add(prop.id)
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
    generatingPropIds.delete(prop.id)
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

function stopScenePromptPoll() {
  if (editScenePollTimer) { clearInterval(editScenePollTimer); editScenePollTimer = null }
}

function editScene(scene) {
  stopScenePromptPoll()
  editSceneForm.value = {
    id: scene.id,
    location: scene.location || '',
    time: scene.time || '',
    prompt: scene.prompt || '',
    polished_prompt: scene.polished_prompt || ''
  }
  showEditScene.value = true
  // polished_prompt 为空时轮询等待后台异步生成
  if (!scene.polished_prompt && scene.id && (scene.location || scene.time)) {
    editScenePromptGenerating.value = true
    let elapsed = 0
    editScenePollTimer = setInterval(async () => {
      elapsed += 3
      try {
        const res = await sceneAPI.get(scene.id)
        const p = res?.scene?.polished_prompt
        if (p) {
          if (editSceneForm.value?.id === scene.id) editSceneForm.value.polished_prompt = p
          stopScenePromptPoll(); editScenePromptGenerating.value = false
        } else if (elapsed >= 60) {
          stopScenePromptPoll(); editScenePromptGenerating.value = false
        }
      } catch (_) { stopScenePromptPoll(); editScenePromptGenerating.value = false }
    }, 3000)
  }
}

async function doGenerateScenePrompt() {
  const form = editSceneForm.value
  if (!form?.id) return
  editScenePromptGenerating.value = true
  try {
    const res = await sceneAPI.generatePrompt(form.id)
    if (res?.polished_prompt) { form.polished_prompt = res.polished_prompt; ElMessage.success('提示词已生成') }
  } catch (e) {
    ElMessage.error(e.message || '生成提示词失败')
  } finally {
    editScenePromptGenerating.value = false
  }
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
        prompt: form.prompt || undefined,
        polished_prompt: form.polished_prompt || undefined
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
  generatingSceneIds.add(scene.id)
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
    generatingSceneIds.delete(scene.id)
  }
}

/** 获取该分镜首图 URL，供视频生成接口使用（优先已完成图，否则 composed_image） */
function getSbFirstFrameUrl(sb) {
  const img = getSbImage(sb.id)
  if (img && (img.image_url || img.local_path)) return assetImageUrl(img)
  if (sb.composed_image || sb.image_url) return imageUrl(sb.composed_image || sb.image_url)
  return ''
}

/** 为视频生成获取参考图的真实 URL */
async function getMainImageUrlForVideo(sb) {
  return getSbFirstFrameUrl(sb)
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

/** 将结构化视角三元组转为英文描述片段 + 中文标签（与 angleService.js 保持一致） */
function angleToPromptFragment(h, v, s) {
  const hDesc = { front:'shooting from the front', front_left:'shooting from front-left at 45-degree angle', left:'shooting from the left side, profile view', back_left:'shooting from back-left at 135-degree angle', back:"shooting from behind, character's back to camera", back_right:'shooting from back-right at 135-degree angle', right:'shooting from the right side, profile view', front_right:'shooting from front-right at 45-degree angle' }
  const vDesc = { worm:"extreme low-angle worm's eye view, camera near ground pointing sharply upward, strong upward perspective distortion, background shows sky/ceiling", low:'low-angle upward shot, camera below eye-line, slight upward tilt, empowering perspective', eye_level:'eye-level shot, neutral perspective, natural horizontal framing', high:"high-angle bird's eye view, camera above looking down, background shows floor/ground with downward perspective distortion" }
  const sDesc = { close_up:'close-up shot (face/bust framing), subject fills most of frame, shallow depth of field, background softly blurred', medium:'medium shot (waist-up to full body), character and immediate surroundings visible, moderate depth of field', wide:'wide shot (full body with environment), subject small relative to scene, deep depth of field, environment context prominent' }
  const hLabel = { front:'正面', front_left:'前左', left:'左侧', back_left:'后左', back:'背面', back_right:'后右', right:'右侧', front_right:'前右' }
  const vLabel = { worm:'虫眼仰', low:'仰拍', eye_level:'平视', high:'俯拍' }
  const sLabel = { close_up:'特写', medium:'中景', wide:'远景' }
  const fragment = [sDesc[s] || sDesc.medium, vDesc[v] || vDesc.eye_level, hDesc[h] || hDesc.front].join(', ')
  const label = `${sLabel[s] || '中景'}·${vLabel[v] || '平视'}·${hLabel[h] || '正面'}`
  return { fragment, label }
}

/** 根据当前分镜的「视频提示词组成」字段拼出完整 video_prompt 文案（与后端 generateVideoPrompt 顺序一致） */
function buildVideoPromptFromFields(sbId) {
  const parts = []
  const loc = (sbLocation.value[sbId] || '').toString().trim()
  const time = (sbTime.value[sbId] || '').toString().trim()
  if (loc) parts.push('场景：' + (time ? loc + '，' + time : loc))
  const title = (sbTitle.value[sbId] || '').toString().trim()
  if (title) parts.push('镜头标题：' + title)
  const action = (sbAction.value[sbId] || '').toString().trim()
  if (action) parts.push('动作：' + action)
  const dialogue = (sbDialogue.value[sbId] || '').toString().trim()
  if (dialogue) parts.push('对话：' + dialogue)
  const shotType = (sbShotType.value[sbId] || '').toString().trim()
  if (shotType) parts.push('景别：' + shotType)
  // 优先使用结构化三元组：中文标签 + 英文描述（兼顾中英文视频模型）
  const angleH = sbAngleH.value[sbId] || ''
  const angleV = sbAngleV.value[sbId] || ''
  const angleS = sbAngleS.value[sbId] || ''
  if (angleH && angleV && angleS) {
    const { fragment, label } = angleToPromptFragment(angleH, angleV, angleS)
    parts.push(`镜头角度：${label}（${fragment}）`)
  } else {
    const angle = (sbAngle.value[sbId] || '').toString().trim()
    if (angle) parts.push('镜头角度：' + angle)
  }
  const movement = (sbMovement.value[sbId] || '').toString().trim()
  if (movement) parts.push('运镜：' + movement)
  const atmosphere = (sbAtmosphere.value[sbId] || '').toString().trim()
  if (atmosphere) parts.push('氛围：' + atmosphere)
  const result = (sbResult.value[sbId] || '').toString().trim()
  if (result) parts.push('结果：' + result)
  const duration = Number(sbDuration.value[sbId])
  const sec = Number.isFinite(duration) && duration > 0 ? duration : 5
  parts.push('时长：' + sec + '秒')
  return parts.length ? parts.join('。') : '视频场景'
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
      angle_h: sbAngleH.value[sb.id] || null,
      angle_v: sbAngleV.value[sb.id] || null,
      angle_s: sbAngleS.value[sb.id] || null,
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
  if (!getSbFirstFrameUrl(sb)) {
    ElMessage.warning('请先生成或上传该分镜的图片，再生成视频')
    return
  }
  generatingSbVideoIds.add(sb.id)
  sbVideoErrors.value[sb.id] = ''
  try {
    const firstFrameUrl = await getMainImageUrlForVideo(sb)
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
    generatingSbVideoIds.delete(sb.id)
    await loadStoryboardMedia()
  }
}

/** 生成期间轻量刷新分镜列表（只更新 currentEpisode.storyboards，不重载整个 drama） */
async function refreshStoryboardsOnly() {
  if (!currentEpisodeId.value) return
  try {
    const res = await dramaAPI.getStoryboards(currentEpisodeId.value)
    // API 返回 { storyboards: [...], total: N }，需要取 .storyboards
    const list = Array.isArray(res) ? res : (res?.storyboards ?? null)
    if (store.currentEpisode && Array.isArray(list)) {
      store.currentEpisode.storyboards = list
    }
  } catch (_) { /* 静默忽略，不影响主流程 */ }
}

async function onGenerateStoryboard() {
  if (!currentEpisodeId.value) return
  storyboardGenerating.value = true
  // 生成期间每 2 秒刷新分镜列表，让已解析的分镜逐步出现
  const refreshTimer = setInterval(refreshStoryboardsOnly, 2000)
  try {
    const res = await dramaAPI.generateStoryboard(currentEpisodeId.value, {
      model: undefined,
      style: getSelectedStyle(),
      storyboard_count: storyboardCount.value || undefined,
      video_duration: videoDuration.value || undefined,
      aspect_ratio: projectAspectRatio.value
    })
    const taskId = res?.task_id ?? (typeof res === 'string' ? res : null)
    if (taskId) {
      const pollRes = await pollTask(taskId, () => loadDrama())
      // failed / timeout：pollTask 内已展示对应提示，直接返回，不显示「完成」
      if (pollRes?.status !== 'completed') return
      if (pollRes?.result?.truncated) {
        sbTruncatedWarning.value = true
        sbTruncatedDismissed.value = false
      }
    }
    await loadDrama()
    ElMessage.success('分镜生成完成')
  } catch (e) {
    // HTTP 错误由 request 拦截器统一展示，此处仅处理拦截器未覆盖的异常
    if (!e.response) ElMessage.error(e.message || '生成失败')
  } finally {
    clearInterval(refreshTimer)
    storyboardGenerating.value = false
  }
}

async function onAddSingleStoryboard(){
  if (!currentEpisodeId.value) {
    ElMessage.warning('请先选择集')
    return
  }
  try {
    // 获取当前最大序号（仅计算当前集的分镜）
    const maxNum = (store.storyboards || [])
      .filter(sb => sb.episode_id === currentEpisodeId.value)
      .reduce((max, sb) => Math.max(max, sb.storyboard_number || 0), 0)
    await storyboardsAPI.create({
      episode_id: currentEpisodeId.value,
      storyboard_number: maxNum + 1,
      title: `镜头 ${maxNum + 1}`,
      description: '',
    })
    ElMessage.success('添加成功')
    await loadDrama() // 刷新列表
  } catch (e) {
    ElMessage.error(e.message || '添加失败')
  }
}

async function onDeleteSingleStoryboard(id){
  try {
    await ElMessageBox.confirm('确定要删除这个分镜吗？', '提示', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await storyboardsAPI.delete(id)
    ElMessage.success('删除成功')
    await loadDrama() // 刷新列表
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error(e.message || '删除失败')
    }
  }
}

async function startBatchImageGeneration() {
  if (!currentEpisodeId.value || batchImageRunning.value || pipelineRunning.value) return
  batchImageErrors.value = []
  batchImageStopping.value = false
  batchImageRunning.value = true
  try {
    await loadStoryboardMedia()
    const boards = store.storyboards || []
    const todo = boards.filter((sb) => !hasSbImage(sb))
    if (todo.length === 0) {
      ElMessage.info('所有分镜均已有图片，无需重新生成')
      return
    }
    batchImageProgress.value = { current: 0, total: todo.length, failed: 0 }
    for (let i = 0; i < todo.length; i++) {
      if (batchImageStopping.value) { ElMessage.info('批量生成已停止'); break }
      batchImageProgress.value = { ...batchImageProgress.value, current: i + 1 }
      const sb = todo[i]
      try {
        const res = await imagesAPI.create({
          storyboard_id: sb.id,
          drama_id: dramaId.value,
          prompt: sb.image_prompt || sb.description || '',
          style: getSelectedStyle(),
          frame_type: gridMode.value !== 'single' ? gridMode.value : undefined,
        })
        if (res?.task_id) {
          const pollRes = await pollTask(res.task_id, () => loadStoryboardMedia())
          if (pollRes?.status === 'failed') {
            batchImageErrors.value.push(`#${sb.storyboard_number ?? sb.id}: ${pollRes.error || '生成失败'}`)
            batchImageProgress.value = { ...batchImageProgress.value, failed: batchImageProgress.value.failed + 1 }
          }
        } else {
          await loadStoryboardMedia()
        }
      } catch (e) {
        batchImageErrors.value.push(`#${sb.storyboard_number ?? sb.id}: ${e.message || '提交失败'}`)
        batchImageProgress.value = { ...batchImageProgress.value, failed: batchImageProgress.value.failed + 1 }
      }
      if (!batchImageStopping.value) await new Promise((r) => setTimeout(r, 600))
    }
    if (!batchImageStopping.value) {
      if (batchImageProgress.value.failed === 0) ElMessage.success(`分镜图批量生成完成（共 ${todo.length} 条）`)
      else ElMessage.warning(`批量完成，${batchImageProgress.value.failed}/${todo.length} 条失败`)
    }
  } finally {
    batchImageRunning.value = false
  }
}

async function startBatchVideoGeneration() {
  if (!currentEpisodeId.value || batchVideoRunning.value || pipelineRunning.value) return
  batchVideoErrors.value = []
  batchVideoStopping.value = false
  batchVideoRunning.value = true
  try {
    await loadStoryboardMedia()
    const boards = store.storyboards || []
    // 只处理：有图片 且 还没有已完成视频 的分镜
    const todo = boards.filter((sb) => {
      const firstFrameUrl = getSbFirstFrameUrl(sb)
      if (!firstFrameUrl) return false
      const vidList = sbVideos.value[sb.id] || []
      return !vidList.some((v) => v.status === 'completed' && (v.video_url || v.local_path))
    })
    if (todo.length === 0) {
      ElMessage.info('没有需要生成视频的分镜（分镜缺少图片，或视频已全部生成）')
      return
    }
    batchVideoProgress.value = { current: 0, total: todo.length, failed: 0 }
    for (let i = 0; i < todo.length; i++) {
      if (batchVideoStopping.value) { ElMessage.info('批量生成已停止'); break }
      batchVideoProgress.value = { ...batchVideoProgress.value, current: i + 1 }
      const sb = todo[i]
      if (!getSbFirstFrameUrl(sb)) continue
      try {
        const firstFrameUrl = await getMainImageUrlForVideo(sb)
        const absoluteUrl = toAbsoluteImageUrl(firstFrameUrl)
        const res = await videosAPI.create({
          drama_id: dramaId.value,
          storyboard_id: sb.id,
          prompt: sb.video_prompt,
          image_url: absoluteUrl || undefined,
          reference_image_urls: absoluteUrl ? [absoluteUrl] : undefined,
          style: getSelectedStyle(),
          aspect_ratio: projectAspectRatio.value,
          resolution: videoResolution.value || undefined,
          duration: videoClipDuration.value || undefined,
        })
        if (res?.task_id) {
          const pollRes = await pollTask(res.task_id, () => loadStoryboardMedia())
          if (pollRes?.status === 'failed') {
            batchVideoErrors.value.push(`#${sb.storyboard_number ?? sb.id}: ${pollRes.error || '生成失败'}`)
            batchVideoProgress.value = { ...batchVideoProgress.value, failed: batchVideoProgress.value.failed + 1 }
          }
        } else {
          await loadStoryboardMedia()
        }
      } catch (e) {
        batchVideoErrors.value.push(`#${sb.storyboard_number ?? sb.id}: ${e.message || '提交失败'}`)
        batchVideoProgress.value = { ...batchVideoProgress.value, failed: batchVideoProgress.value.failed + 1 }
      }
      if (!batchVideoStopping.value) await new Promise((r) => setTimeout(r, 600))
    }
    if (!batchVideoStopping.value) {
      if (batchVideoProgress.value.failed === 0) ElMessage.success(`分镜视频批量生成完成（共 ${todo.length} 条）`)
      else ElMessage.warning(`批量完成，${batchVideoProgress.value.failed}/${todo.length} 条失败`)
    }
  } finally {
    batchVideoRunning.value = false
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
  const maxAttempts = 450  // 450 × 2s = 15 分钟，足够复杂剧本生成
  const interval = 2000
  let attempts = 0
  return new Promise((resolve) => {
    const tick = async () => {
      attempts++
      try {
        const t = await taskAPI.get(taskId)
        if (t.status === 'completed') {
          if (onDone) await onDone()
          return resolve({ status: 'completed', result: t.result })
        }
        if (t.status === 'failed') {
          const errMsg = t.error || '任务失败'
          ElMessage.error(errMsg)
          return resolve({ status: 'failed', error: errMsg })
        }
      } catch (pollErr) {
        // 轮询网络异常时仅打印，不打断轮询（服务短暂重启等情况）
        console.warn('[pollTask] poll attempt failed:', pollErr?.message)
      }
      if (attempts < maxAttempts) setTimeout(tick, interval)
      else {
        const timeoutMsg = '分镜生成任务已超时（超过15分钟），请刷新页面查看是否已完成'
        ElMessage.warning(timeoutMsg)
        resolve({ status: 'timeout', error: timeoutMsg })
      }
    }
    setTimeout(tick, interval)
  })
}

/** 一键生成视频：暂停时等待，返回 { paused: true } 表示被暂停中断 */
function pollTaskWithPause(taskId, onDone) {
  const maxAttempts = 450  // 450 × 2s = 15 分钟
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
          resolve({ result: t.result })
          return
        }
        if (t.status === 'failed') {
          resolve({ error: t.error || '任务失败' })
          return
        }
      } catch (pollErr) {
        console.warn('[pollTaskWithPause] poll attempt failed:', pollErr?.message)
      }
      if (attempts < maxAttempts) setTimeout(tick, interval)
      else {
        resolve({ error: '任务查询超时（超过15分钟）' })
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
  pipelineStepIndex.value = 0
  pipelineActiveTasks.value = new Set()
  pipelineRunning.value = true
  pipelinePaused.value = false
  try {
    await runOneClickPipeline()
  } finally {
    pipelineRunning.value = false
    pipelineActiveTasks.value = new Set()
  }
}

function setPipelineStep(idx, text) {
  pipelineStepIndex.value = idx
  pipelineCurrentStep.value = `[步骤 ${idx}/${PIPELINE_TOTAL_STEPS}] ${text}`
}

async function runOneClickPipeline() {
  const episodeId = currentEpisodeId.value
  const dramaIdVal = dramaId.value
  if (!episodeId || !dramaIdVal) return
  const style = getSelectedStyle()

  try {
    // 1. 剧本生成角色（已有角色则跳过，直接进入图片生成）
    await checkPause()
    let chars = store.currentEpisode?.characters ?? []
    if (chars.length === 0) {
      setPipelineStep(1, '生成角色列表...')
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
      chars = store.currentEpisode?.characters ?? []
    } else {
      setPipelineStep(1, `已有 ${chars.length} 个角色，跳过生成`)
    }

    // 2. 为每个角色生成图片（并发）
    await checkPause()
    const charsWithoutImage = chars.filter((c) => !hasAssetImage(c))
    {
      const concurrency = pipelineConcurrency.value
      setPipelineStep(2, `生成角色图（${charsWithoutImage.length} 个，并发 ${concurrency}）...`)
      const { paused } = await runConcurrently(charsWithoutImage, concurrency, async (char) => {
        await checkPause()
        generatingCharIds.add(char.id)
        try {
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
          if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
        } finally {
          generatingCharIds.delete(char.id)
        }
      }, { getLabel: (char) => '角色图 ' + (char.name || char.id) })
      if (paused) { await waitForResume() }
    }

    // 3. 从剧本提取场景（已有场景则跳过，直接进入图片生成）
    await checkPause()
    let sceneList = store.currentEpisode?.scenes ?? []
    if (sceneList.length === 0) {
      setPipelineStep(3, '提取场景信息...')
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
      sceneList = store.currentEpisode?.scenes ?? []
    } else {
      setPipelineStep(3, `已有 ${sceneList.length} 个场景，跳过提取`)
    }

    // 4. 为每个场景生成图片（并发）
    await checkPause()
    const scenesWithoutImage = sceneList.filter((s) => !hasAssetImage(s))
    {
      const concurrency = pipelineConcurrency.value
      setPipelineStep(4, `生成场景图（${scenesWithoutImage.length} 个，并发 ${concurrency}）...`)
      const { paused } = await runConcurrently(scenesWithoutImage, concurrency, async (scene) => {
        await checkPause()
        generatingSceneIds.add(scene.id)
        try {
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
          if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
        } finally {
          generatingSceneIds.delete(scene.id)
        }
      }, { getLabel: (scene) => '场景图 ' + (scene.location || scene.id) })
      if (paused) { await waitForResume() }
    }

    // 5. 分镜生成（已有则跳过）
    await checkPause()
    await loadStoryboardMedia()
    let boards = store.storyboards || []
    if (boards.length === 0) {
      setPipelineStep(5, '生成分镜...')
      try {
        const res = await dramaAPI.generateStoryboard(episodeId, { style, aspect_ratio: projectAspectRatio.value })
        const taskId = res?.task_id ?? (typeof res === 'string' ? res : null)
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError('分镜生成', result.error); return }
          if (result?.result?.truncated) {
            sbTruncatedWarning.value = true
            sbTruncatedDismissed.value = false
          }
        }
        await loadDrama()
        await pipelineRest()
      } catch (e) {
        addPipelineError('分镜生成', e.message || String(e))
        return
      }
      await loadStoryboardMedia()
      boards = store.storyboards || []
    } else {
      setPipelineStep(5, `已有 ${boards.length} 个分镜，跳过生成`)
    }

    // 6. 批量生成分镜图（并发，boards 已在步骤5加载）
    await checkPause()
    const boardsWithoutImg = boards.filter((sb) => !hasSbImage(sb))
    {
      const concurrency = pipelineConcurrency.value
      setPipelineStep(6, `生成分镜图（${boardsWithoutImg.length} 个，并发 ${concurrency}）...`)
      const { paused } = await runConcurrently(boardsWithoutImg, concurrency, async (sb) => {
        await checkPause()
        generatingSbImageIds.add(sb.id)
        try {
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
          if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
        } finally {
          generatingSbImageIds.delete(sb.id)
        }
      }, { getLabel: (sb) => '分镜图 #' + (sb.storyboard_number ?? sb.id) })
      if (paused) { await waitForResume() }
    }

    // 7. 批量生成分镜视频（并发）
    await checkPause()
    await loadStoryboardMedia()
    const boards2 = (store.storyboards || []).filter((sb) => {
      if (!getSbFirstFrameUrl(sb)) return false
      const vidList = sbVideos.value[sb.id] || []
      return !vidList.some((v) => v.status === 'completed' && (v.video_url || v.local_path))
    })
    {
      const concurrency = pipelineVideoConcurrency.value
      setPipelineStep(7, `生成分镜视频（${boards2.length} 个，并发 ${concurrency}）...`)
      const { paused } = await runConcurrently(boards2, concurrency, async (sb) => {
        await checkPause()
        generatingSbVideoIds.add(sb.id)
        try {
          const stepName = '分镜视频 #' + (sb.storyboard_number ?? sb.id)
          const ok = await pipelineWithRetry(stepName, async () => {
            const firstFrameUrl = await getMainImageUrlForVideo(sb)
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
          if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
        } finally {
          generatingSbVideoIds.delete(sb.id)
        }
      }, { getLabel: (sb) => '分镜视频 #' + (sb.storyboard_number ?? sb.id) })
      if (paused) { await waitForResume() }
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
  pipelineActiveTasks.value = new Set()
  pipelineRunning.value = true
  pipelinePaused.value = false
  try {
    await runRepairPipeline()
  } finally {
    pipelineRunning.value = false
    pipelineActiveTasks.value = new Set()
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
    {
      const concurrency = pipelineConcurrency.value
      pipelineCurrentStep.value = `正在生成角色图（并发${concurrency}）...`
      const { paused } = await runConcurrently(charsWithoutImage, concurrency, async (char) => {
        await checkPause()
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
        if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
      }, { getLabel: (char) => '角色图 ' + (char.name || char.id) })
      if (paused) { await waitForResume() }
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
    {
      const concurrency = pipelineConcurrency.value
      pipelineCurrentStep.value = `正在生成场景图（并发${concurrency}）...`
      const { paused } = await runConcurrently(scenesWithoutImage, concurrency, async (scene) => {
        await checkPause()
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
        if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
      }, { getLabel: (scene) => '场景图 ' + (scene.location || scene.id) })
      if (paused) { await waitForResume() }
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
    // 先拉取分镜图片/视频列表，再批量生成分镜图（并发）
    await loadStoryboardMedia()
    const boardsWithoutImg = boards.filter((sb) => !hasSbImage(sb))
    {
      const concurrency = pipelineConcurrency.value
      pipelineCurrentStep.value = `正在生成分镜图（并发${concurrency}）...`
      const { paused } = await runConcurrently(boardsWithoutImg, concurrency, async (sb) => {
        await checkPause()
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
        if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
      }, { getLabel: (sb) => '分镜图 #' + (sb.storyboard_number ?? sb.id) })
      if (paused) { await waitForResume() }
    }
    await loadStoryboardMedia()
    const boards2 = (store.storyboards || []).filter((sb) => {
      if (!getSbFirstFrameUrl(sb)) return false
      const vidList = sbVideos.value[sb.id] || []
      return !vidList.some((v) => v.status === 'completed' && (v.video_url || v.local_path))
    })
    {
      const concurrency = pipelineVideoConcurrency.value
      pipelineCurrentStep.value = `正在生成分镜视频（并发${concurrency}）...`
      const { paused } = await runConcurrently(boards2, concurrency, async (sb) => {
        await checkPause()
        const stepName = '分镜视频 #' + (sb.storyboard_number ?? sb.id)
        const ok = await pipelineWithRetry(stepName, async () => {
          const firstFrameUrl = await getMainImageUrlForVideo(sb)
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
        if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
      }, { getLabel: (sb) => '分镜视频 #' + (sb.storyboard_number ?? sb.id) })
      if (paused) { await waitForResume() }
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

onBeforeUnmount(() => {
  window.removeEventListener('resize', _syncNavCollapse)
})

onMounted(() => {
  _syncNavCollapse()
  window.addEventListener('resize', _syncNavCollapse)
  loadPipelineConcurrency()
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
  background-image:
    radial-gradient(ellipse 80% 50% at 20% -20%, rgba(120, 60, 220, 0.18) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 110%, rgba(60, 100, 220, 0.12) 0%, transparent 60%);
  color: #e4e4e7;
}
html.light .film-create {
  background: #f5f3ff;
  background-image:
    radial-gradient(ellipse 80% 50% at 20% -20%, rgba(139, 92, 246, 0.12) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 110%, rgba(99, 102, 241, 0.08) 0%, transparent 60%);
}
.header {
  background: rgba(18, 18, 22, 0.82);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(139, 92, 246, 0.18);
  padding: 12px 24px;
  position: sticky;
  top: 0;
  z-index: 200;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.4);
}
html.light .header {
  background: rgba(255, 255, 255, 0.85) !important;
  border-bottom-color: rgba(139, 92, 246, 0.2) !important;
  box-shadow: 0 2px 16px rgba(139, 92, 246, 0.08) !important;
}
.header-inner {
  max-width: min(1400px, 96vw);
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 16px;
}
.logo {
  margin: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 1px;
  line-height: 1;
  transition: filter 0.3s;
}
.logo:hover { filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.5)); }
.logo-main {
  font-size: 1.1rem;
  font-weight: 700;
  background: linear-gradient(135deg, #c4b5fd 0%, #818cf8 50%, #a78bfa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.logo-sub {
  font-size: 0.68rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: #6d6d7a;
  -webkit-text-fill-color: #6d6d7a;
}
html.light .logo-main {
  background: linear-gradient(135deg, #7c3aed, #6366f1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
html.light .logo-sub {
  color: #9ca3af;
  -webkit-text-fill-color: #9ca3af;
}
.breadcrumb-sep {
  color: #3f3f46;
  font-size: 1rem;
  font-weight: 300;
  flex-shrink: 0;
  user-select: none;
}
html.light .breadcrumb-sep { color: #d1d5db; }
.page-title {
  font-size: 0.88rem;
  font-weight: 500;
  color: #a1a1aa;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 3px 10px;
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
html.light .page-title {
  color: #6b7280;
  background: rgba(99, 102, 241, 0.06);
  border-color: rgba(99, 102, 241, 0.15);
}
.btn-back-drama {
  flex-shrink: 0;
}
.header-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
  flex-shrink: 0;
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
/* ===== 左侧快捷目录 ===== */
.quick-nav {
  position: fixed;
  left: 16px;
  top: 100px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  padding: 6px 0 10px;
  background: rgba(15, 15, 20, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 14px;
  border: 1px solid rgba(139, 92, 246, 0.22);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(139, 92, 246, 0.06);
  width: 160px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  overflow-x: hidden;
  transition: width 0.22s ease, padding 0.22s ease, opacity 0.2s ease;
}
/* 窗口较窄时：折叠态自动降低透明度，悬浮时恢复，减少遮挡感 */
@media (max-width: 960px) {
  .quick-nav.collapsed {
    opacity: 0.45;
    left: 4px;
  }
  .quick-nav.collapsed:hover {
    opacity: 1;
    left: 16px;
  }
}
html.light .quick-nav {
  background: rgba(255, 255, 255, 0.94);
  border-color: rgba(139, 92, 246, 0.2);
  box-shadow: 0 8px 28px rgba(139, 92, 246, 0.12);
}
.quick-nav.collapsed {
  width: 36px;
  padding: 4px 0;
}
.quick-nav.collapsed .nav-steps,
.quick-nav.collapsed .nav-group {
  display: none;
}
/* 当前任务面板 */
.atp-panel {
  margin-top: 6px;
  border-top: 1px solid rgba(139, 92, 246, 0.18);
  padding: 6px 0 4px;
}
.atp-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px 4px;
}
.atp-title {
  font-size: 0.72rem;
  font-weight: 600;
  color: #a78bfa;
  letter-spacing: 0.03em;
  flex: 1;
}
.atp-count-badge {
  font-size: 0.68rem;
  background: rgba(139, 92, 246, 0.25);
  color: #c4b5fd;
  border-radius: 8px;
  padding: 1px 5px;
  min-width: 16px;
  text-align: center;
}
.atp-spin-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #a78bfa;
  flex-shrink: 0;
  animation: atp-pulse 1.2s ease-in-out infinite;
}
@keyframes atp-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.75); }
}
.atp-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.atp-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 6px;
  transition: background 0.15s;
}
.atp-item:hover { background: rgba(255,255,255,0.05); }
.atp-item-dot {
  display: inline-block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #7c3aed;
  flex-shrink: 0;
  animation: atp-pulse 1.6s ease-in-out infinite;
}
.atp-item-label {
  font-size: 0.72rem;
  color: #a1a1aa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 118px;
}
.atp-more {
  font-size: 0.68rem;
  color: #71717a;
  padding: 2px 10px 2px 19px;
}
/* 折叠态任务徽章 */
.atp-collapsed-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 4px 0;
  cursor: default;
}
.atp-collapsed-count {
  font-size: 0.65rem;
  color: #a78bfa;
  font-weight: 700;
  line-height: 1;
}
html.light .atp-title { color: #7c3aed; }
html.light .atp-count-badge { background: rgba(139,92,246,0.12); color: #7c3aed; }
html.light .atp-spin-dot { background: #7c3aed; }
html.light .atp-item-dot { background: #8b5cf6; }
html.light .atp-item-label { color: #374151; }
html.light .atp-item:hover { background: rgba(0,0,0,0.04); }
html.light .atp-panel { border-top-color: rgba(139,92,246,0.15); }
.nav-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  cursor: pointer;
  color: #52525b;
  transition: color 0.15s, background 0.15s;
  border-radius: 6px;
  margin: 0 6px 4px;
  flex-shrink: 0;
}
.nav-toggle:hover { color: #e4e4e7; background: rgba(255,255,255,0.07); }
html.light .nav-toggle:hover { color: #374151; background: rgba(0,0,0,0.05); }

/* ─── Steps ─── */
.nav-steps {
  display: flex;
  flex-direction: column;
  padding: 0 10px 0 8px;
}
.nav-step {
  display: flex;
  align-items: stretch;
  gap: 8px;
  cursor: pointer;
  border-radius: 8px;
  padding: 2px 4px 2px 0;
  transition: background 0.18s;
  user-select: none;
}
.nav-step:hover { background: rgba(255,255,255,0.05); }
html.light .nav-step:hover { background: rgba(0,0,0,0.04); }

/* connector column */
.step-connector-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
  flex-shrink: 0;
}
.step-line {
  width: 2px;
  flex: 1;
  min-height: 6px;
  background: rgba(255,255,255,0.1);
  border-radius: 1px;
  transition: background 0.3s;
}
html.light .step-line { background: rgba(0,0,0,0.1); }
.step-line.filled { background: rgba(34, 197, 94, 0.5); }

/* dot */
.step-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  transition: all 0.25s;
  border: 2px solid transparent;
}
.dot-pending {
  background: rgba(63,63,70,0.7);
  border-color: rgba(113,113,122,0.4);
  color: #71717a;
}
html.light .dot-pending {
  background: rgba(229,231,235,0.8);
  border-color: rgba(156,163,175,0.5);
  color: #9ca3af;
}
.dot-partial {
  background: rgba(245, 158, 11, 0.18);
  border-color: rgba(245, 158, 11, 0.6);
  color: #f59e0b;
}
.dot-generating {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.7);
  color: #a78bfa;
  box-shadow: 0 0 8px rgba(139, 92, 246, 0.4);
}
.dot-done {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.7);
  color: #22c55e;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.25);
}
.dot-icon { font-size: 13px; }
.dot-num { font-size: 11px; line-height: 1; }

/* step body */
.step-body {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  padding: 3px 0;
  min-width: 0;
}
.step-label {
  flex: 1;
  font-size: 13.5px;
  font-weight: 500;
  color: #a1a1aa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s;
}
html.light .step-label { color: #6b7280; }
.nav-step:hover .step-label { color: #e4e4e7; }
html.light .nav-step:hover .step-label { color: #111827; }
.status-done .step-label { color: #86efac; }
html.light .status-done .step-label { color: #16a34a; }
.status-generating .step-label { color: #c4b5fd; }
html.light .status-generating .step-label { color: #7c3aed; }
.status-partial .step-label { color: #fcd34d; }
html.light .status-partial .step-label { color: #d97706; }

.step-count {
  font-size: 11px;
  color: #71717a;
  background: rgba(255,255,255,0.07);
  border-radius: 10px;
  padding: 0 5px;
  flex-shrink: 0;
}
html.light .step-count { background: rgba(0,0,0,0.06); color: #9ca3af; }

.step-badge {
  display: flex;
  align-items: center;
  font-size: 11px;
  flex-shrink: 0;
}
.partial-badge { color: #f59e0b; }
.gen-badge { color: #a78bfa; }

/* spin animation */
@keyframes navSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.spin { animation: navSpin 1s linear infinite; display: inline-flex; }

/* sub-toggle & sub-list */
.nav-group { margin-top: 4px; }
.nav-sub-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  font-size: 12px;
  color: #71717a;
  cursor: pointer;
  transition: color 0.15s;
  border-top: 1px solid rgba(255,255,255,0.06);
}
html.light .nav-sub-toggle { border-top-color: rgba(0,0,0,0.07); color: #9ca3af; }
.nav-sub-toggle:hover { color: #e4e4e7; }
html.light .nav-sub-toggle:hover { color: #374151; }
.nav-sub-list {
  background: rgba(0,0,0,0.18);
  padding: 3px 0;
  border-radius: 0 0 6px 6px;
}
html.light .nav-sub-list { background: rgba(0,0,0,0.04); }
.nav-sub-item {
  padding: 5px 12px 5px 28px;
  font-size: 12px;
  color: #71717a;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.15s;
}
html.light .nav-sub-item { color: #9ca3af; }
.nav-sub-item:hover { color: #fff; background: rgba(255,255,255,0.05); }
html.light .nav-sub-item:hover { color: #111827; background: rgba(0,0,0,0.04); }

.main {
  max-width: min(1400px, 96vw);
  margin: 0 auto;
  padding: 24px 16px 48px;
}
.section {
  margin-bottom: 24px;
}
.card {
  background: rgba(24, 24, 27, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(63, 63, 70, 0.7);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
  transition: border-color 0.3s, box-shadow 0.3s;
}
.card:hover {
  border-color: rgba(139, 92, 246, 0.2);
  box-shadow: 0 6px 32px rgba(0, 0, 0, 0.25);
}
html.light .card {
  background: rgba(255, 255, 255, 0.88);
  border-color: rgba(139, 92, 246, 0.12);
  box-shadow: 0 4px 20px rgba(139, 92, 246, 0.06);
}
html.light .card:hover {
  border-color: rgba(139, 92, 246, 0.25);
  box-shadow: 0 6px 28px rgba(139, 92, 246, 0.1);
}
.section-title {
  font-size: 1.1rem;
  margin: 0 0 4px;
  color: #fafafa;
}
html.light .section-title { color: #18181b; }
.one-click-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
  padding: 12px 14px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  flex-wrap: wrap;
}
.one-click-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  font-weight: 500;
}
.pipeline-status {
  margin-top: 12px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  font-size: 13px;
}
.pipeline-current-step {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  color: var(--el-text-color-primary);
  font-weight: 500;
  font-size: 13px;
}
.pipeline-step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  padding: 1px 7px;
  border-radius: 10px;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}
.pipeline-active-tasks {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.pipeline-task-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px 2px 6px;
  border-radius: 12px;
  background: rgba(64, 158, 255, 0.12);
  border: 1px solid rgba(64, 158, 255, 0.3);
  color: var(--el-color-primary);
  font-size: 12px;
  white-space: nowrap;
}
.pipeline-task-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-primary);
  flex-shrink: 0;
  animation: pipeline-dot-pulse 1.2s ease-in-out infinite;
}
@keyframes pipeline-dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.75); }
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
/* 批量生成分镜图/视频 */
.sb-batch-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}
.sb-batch-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.batch-status {
  margin-top: 12px;
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.batch-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-primary);
  font-weight: 500;
}
.batch-failed {
  color: var(--el-color-danger);
  font-size: 12px;
}
.batch-stopping {
  color: var(--el-color-warning);
  font-size: 12px;
}
.batch-error-log {
  padding: 10px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  font-size: 13px;
  color: #fca5a5;
  max-height: 160px;
  overflow-y: auto;
}
.batch-error-title {
  font-weight: 600;
  margin-bottom: 6px;
  color: #f87171;
}
.batch-error-line {
  margin-bottom: 3px;
  word-break: break-all;
}
/* 角色/场景 → 影响的分镜 */
.asset-storyboard-link {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
  padding: 6px 8px;
  background: rgba(99, 102, 241, 0.07);
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: 6px;
  min-height: 28px;
}
.asl-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}
.asl-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.35);
  color: #a5b4fc;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
  white-space: nowrap;
}
.asl-chip:hover {
  background: rgba(99, 102, 241, 0.28);
  box-shadow: 0 0 6px rgba(99, 102, 241, 0.4);
  color: #c7d2fe;
}
.asl-regen-btn {
  margin-left: auto !important;
  flex-shrink: 0;
  height: 22px !important;
  padding: 0 10px !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  background: rgba(251, 146, 60, 0.15) !important;
  border: 1px solid rgba(251, 146, 60, 0.5) !important;
  color: #fb923c !important;
  border-radius: 11px !important;
  transition: background 0.15s, box-shadow 0.15s !important;
}
.asl-regen-btn:not(.is-loading):hover {
  background: rgba(251, 146, 60, 0.28) !important;
  box-shadow: 0 0 6px rgba(251, 146, 60, 0.35) !important;
  color: #fdba74 !important;
}
.asl-progress {
  font-size: 11px;
  color: #fb923c;
  margin-left: 4px;
  flex-shrink: 0;
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
.asset-item-left-right .asset-cover-wrap {
  flex-shrink: 0;
  align-self: flex-start;
}
.asset-item-left-right .asset-cover {
  width: 200px;
  height: 200px;
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
.asset-item-left-right .asset-name {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.asset-item-left-right .asset-name span { flex: 1; min-width: 0; }
.btn-delete-icon { flex-shrink: 0; padding: 2px 4px !important; opacity: 0.45; transition: opacity 0.15s; }
.btn-delete-icon:hover { opacity: 1; }
/* 图片 + 操作按钮 竖向包裹 */
.asset-cover-wrap {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 200px;
}
.asset-cover-actions {
  display: flex;
  gap: 6px;
  padding: 6px 8px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.asset-cover-actions .el-button { flex: 1; justify-content: center; }
html.light .asset-cover-actions { border-top-color: rgba(139,92,246,0.1); }
/* 额外参考图缩略图条 */
.extra-images-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 5px 8px;
  background: rgba(0,0,0,0.15);
}
.extra-thumb {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  border: 1.5px solid transparent;
  transition: border-color 0.15s;
}
.extra-thumb:hover { border-color: #a78bfa; }
.extra-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.extra-thumb-remove {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 16px;
  height: 16px;
  background: rgba(239,68,68,0.85);
  color: #fff;
  border: none;
  border-radius: 50%;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  cursor: pointer;
  padding: 0;
  opacity: 0;
  transition: opacity 0.15s;
}
.extra-thumb:hover .extra-thumb-remove { opacity: 1; }
html.light .extra-images-strip { background: rgba(139,92,246,0.05); }
.empty-tip {
  color: #71717a;
  font-size: 0.9rem;
  padding: 16px 0;
}

/* 亮色模式：资源卡片 */
html.light .asset-item {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(139, 92, 246, 0.12);
  box-shadow: 0 2px 10px rgba(139, 92, 246, 0.06);
}
html.light .asset-item:hover {
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.12);
  border-color: rgba(139, 92, 246, 0.3);
  transform: translateY(-2px);
  transition: box-shadow 0.25s, transform 0.2s, border-color 0.25s;
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
@keyframes sb-fade-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* ── 段落分隔标头 ─────────────────────────────── */
.segment-header {
  margin: 28px 0 12px;
  position: relative;
}
.segment-header:first-child { margin-top: 0; }
.segment-header-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: linear-gradient(90deg, rgba(139,92,246,0.18) 0%, rgba(139,92,246,0.04) 100%);
  border-left: 4px solid #8b5cf6;
  border-radius: 0 8px 8px 0;
}
.segment-index-badge {
  font-size: 11px;
  font-weight: 700;
  color: #a78bfa;
  background: rgba(139,92,246,0.25);
  padding: 2px 8px;
  border-radius: 20px;
  letter-spacing: 0.5px;
  white-space: nowrap;
}
.segment-title-text {
  font-size: 15px;
  font-weight: 700;
  color: #e2e8f0;
  flex: 1;
}
.segment-shot-range {
  font-size: 11px;
  color: #71717a;
  white-space: nowrap;
}
html.light .segment-header-inner {
  background: linear-gradient(90deg, rgba(139,92,246,0.1) 0%, rgba(139,92,246,0.02) 100%);
  border-left-color: #7c3aed;
}
html.light .segment-title-text { color: #1e1b4b; }
html.light .segment-index-badge { color: #7c3aed; background: rgba(124,58,237,0.12); }

/* 左侧导航段落标签 */
.nav-segment-label {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px 2px;
  font-size: 10px;
  font-weight: 700;
  color: #a78bfa;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.nav-segment-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8b5cf6;
  flex-shrink: 0;
}

.storyboard-row {
  display: flex;
  align-items: stretch;
  gap: 0;
  margin-bottom: 20px;
  background: rgba(28, 28, 30, 0.8);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 12px;
  border: 1px solid rgba(63, 63, 70, 0.6);
  overflow: hidden;
  position: relative;
  transition: border-color 0.25s, box-shadow 0.25s;
  animation: sb-fade-in 0.35s ease both;
}
.storyboard-row:hover {
  border-color: rgba(139, 92, 246, 0.3);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}
html.light .storyboard-row {
  background: rgba(255, 255, 255, 0.85);
  border-color: rgba(139, 92, 246, 0.12);
  box-shadow: 0 2px 12px rgba(139, 92, 246, 0.06);
}
html.light .storyboard-row:hover {
  border-color: rgba(139, 92, 246, 0.3);
  box-shadow: 0 4px 20px rgba(139, 92, 246, 0.1);
}
.storyboard-row:last-child { margin-bottom: 0; }
.sb-num-badge {
  position: absolute;
  left: 12px;
  top: 12px;
  height: 24px;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  gap: 20px;
  z-index: 1;
}
.sb-num-badge span{
  background: var(--el-color-primary);
  width: 24px;
  height:100%;
  color: #fff;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
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
/* 有四宫格或多图时，image-area 改为纵向滚动布局 */
.sb-image-area--has-quad {
  flex-direction: column;
  align-items: stretch;
  overflow-y: auto;
  max-height: 340px;
}
/* 普通多图缩略图条 */
.sb-imgs-strip {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 6px 8px 4px;
  overflow-x: auto;
  border-top: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
}
.sb-strip-hint-icon {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  cursor: default;
  transition: color 0.15s;
}
.sb-strip-hint-icon:hover {
  color: var(--el-color-primary);
}
.sb-img-thumb {
  position: relative;
  cursor: pointer;
  border-radius: 4px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.2s;
  flex-shrink: 0;
  width: 52px;
  height: 52px;
}
.sb-img-thumb:hover { border-color: var(--el-color-primary); }
.sb-img-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sb-img-thumb-label {
  position: absolute;
  bottom: 1px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 10px;
  color: #fff;
  background: rgba(0,0,0,0.45);
  pointer-events: none;
}
/* 主图容器 */
.sb-main-image-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80px;
}
/* 主图下方提示词预览 */
.sb-main-img-prompt {
  width: 100%;
  font-size: 10px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border-top: 1px solid var(--el-border-color-lighter);
  padding: 4px 6px;
  line-height: 1.4;
  max-height: 48px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  word-break: break-all;
  cursor: default;
}
/* 四宫格整图作为上方预览时稍微缩小 */
.sb-quad-preview { max-height: 160px; }
/* 四宫格拆分中占位 */
.quad-splitting-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 8px;
}
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
.sb-truncated-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin-bottom: 14px;
  background: rgba(234, 179, 8, 0.12);
  border: 1px solid rgba(234, 179, 8, 0.4);
  border-radius: 8px;
  color: #fbbf24;
  font-size: 0.875rem;
  line-height: 1.5;
}
.sb-truncated-warning .el-icon {
  flex-shrink: 0;
  font-size: 1rem;
  color: #fbbf24;
}
.sb-truncated-warning span {
  flex: 1;
}
/* 分镜生成中提示条 */
.sb-generating-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 18px;
  margin-top: 10px;
  background: rgba(139, 92, 246, 0.08);
  border: 1px dashed rgba(139, 92, 246, 0.35);
  border-radius: 10px;
  color: #a78bfa;
  font-size: 0.9rem;
}
.sb-gen-text {
  flex: 1;
  letter-spacing: 0.03em;
}
.sb-gen-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #a78bfa;
  animation: sb-dot-bounce 1.2s infinite ease-in-out both;
}
.sb-gen-dot:nth-child(1) { animation-delay: 0s; }
.sb-gen-dot:nth-child(2) { animation-delay: 0.2s; }
.sb-gen-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes sb-dot-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40%            { transform: scale(1);   opacity: 1;   }
}
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
