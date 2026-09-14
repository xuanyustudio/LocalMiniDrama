<template>
  <div class="film-list">
    <header class="home-header">
      <div class="home-header-inner">
        <h1 class="logo">
          <span class="logo-main">灵动创世</span>
          <span class="logo-sub">LINGDONG CREATION STUDIO</span>
        </h1>
        <nav class="home-nav" aria-label="主导航">
          <button class="home-nav-item is-active" type="button">项目</button>
          <button class="home-nav-item" type="button" @click="$router.push('/free-create')">自由创作</button>
          <button class="home-nav-item" type="button" @click="$router.push('/media-library')">素材中心</button>
        </nav>
        <div class="home-actions">
          <el-button text class="home-icon-button" :title="isDark ? '切换到浅色模式' : '切换到暗色模式'" @click="toggleTheme">
            <el-icon><Sunny v-if="isDark" /><Moon v-else /></el-icon>
          </el-button>
          <el-button text class="home-icon-button" title="AI 配置" @click="showAiConfigDialog = true"><el-icon><Setting /></el-icon></el-button>
          <input ref="importFileInput" type="file" accept=".zip" style="display:none" @change="onImportFile" />
          <el-button type="primary" class="home-primary" @click="goNewProject">
            <el-icon><Plus /></el-icon>开始创作
          </el-button>
        </div>
      </div>
    </header>

    <main class="home-main">
      <section class="home-hero">
        <div class="hero-copy">
          <span class="hero-kicker">AI STORYTELLING WORKSPACE</span>
          <h2>让每一帧，<em>有来处。</em></h2>
          <p>从灵感、剧本、角色设定到可播放成片。灵动创世将复杂的多模态创作收拢为一条清晰的导演工作流。</p>
          <div class="hero-actions">
            <el-button type="primary" size="large" class="home-primary" @click="goNewProject"><el-icon><Plus /></el-icon>创建新项目</el-button>
            <el-button size="large" class="hero-secondary" :loading="importing" @click="triggerImport"><el-icon><Upload /></el-icon>导入项目</el-button>
          </div>
          <div v-if="exampleList.length" class="hero-template">从示例开始：<button v-for="ex in exampleList" :key="ex.filename" type="button" @click="onImportExample(ex)">{{ ex.name }}</button></div>
        </div>
        <div class="hero-modes">
          <button v-for="mode in creationModes" :key="mode.value" type="button" class="hero-mode" @click="goNewProject(mode.value)">
            <span class="creation-mode-icon">{{ mode.icon }}</span><span><b>{{ mode.label }}</b><small>{{ mode.desc }}</small></span><i>↗</i>
          </button>
        </div>
      </section>
      <section v-loading="loading" class="projects-wrap home-projects">
        <div class="section-heading">
          <div><span>WORKSPACE</span><h2>你的项目</h2></div>
          <p>{{ filteredDramas.length === dramas.length ? `${total} 个创作项目` : `显示 ${filteredDramas.length} / ${dramas.length}` }}</p>
        </div>

        <div v-if="dramas.length" class="project-toolbar" aria-label="项目筛选与排序">
          <el-input v-model="projectQuery" class="project-search" clearable placeholder="搜索项目标题、故事或类型">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="projectTypeFilter" class="project-filter" aria-label="按创作类型筛选">
            <el-option label="全部类型" value="all" />
            <el-option v-for="mode in creationModes" :key="mode.value" :label="mode.label" :value="mode.value" />
          </el-select>
          <el-select v-model="projectStatusFilter" class="project-filter" aria-label="按项目状态筛选">
            <el-option label="全部状态" value="all" />
            <el-option label="草稿" value="draft" />
            <el-option label="生成中" value="generating" />
            <el-option label="已发布" value="published" />
            <el-option label="已归档" value="archived" />
          </el-select>
          <el-select v-model="projectSort" class="project-sort" aria-label="项目排序">
            <el-option label="最近更新" value="updated-desc" />
            <el-option label="完成度最高" value="progress-desc" />
            <el-option label="按名称" value="title-asc" />
          </el-select>
        </div>

        <div v-if="filteredDramas.length" class="project-grid">
          <div
            v-for="d in filteredDramas"
            :key="d.id"
            class="project-card"
            @click="openProject(d.id)"
          >
            <div class="project-cover" :class="'project-cover--' + (d.metadata?.content_type || 'short_drama')"><span>{{ projectTypeTitle(d) }}</span></div>
            <div class="project-card-actions" @click.stop>
              <el-button size="small" circle :icon="Download" title="导出项目" :loading="exportingId === d.id" @click="onExport(d)" />
              <el-button size="small" circle :icon="Edit" title="编辑" @click="openEditDialog(d)" />
              <el-button size="small" type="danger" plain circle :icon="Delete" title="删除" @click="onDelete(d)" />
            </div>
            <div class="project-card-body">
              <h3 class="project-title">{{ d.title || '未命名项目' }}</h3>
              <p class="project-desc">{{ d.description || '暂无描述' }}</p>
              <div class="project-badges">
                <span class="badge badge-status" :class="'badge-status--' + (d.status || 'draft')">{{ formatStatus(d.status) }}</span>
                <span v-if="d.episodes?.length" class="badge badge-episodes">{{ d.episodes.length }} 集</span>
                <span v-if="totalStoryboards(d) > 0" class="badge badge-storyboards">{{ totalStoryboards(d) }} 分镜</span>
                <span v-if="d.metadata?.aspect_ratio" class="badge badge-ratio">{{ d.metadata.aspect_ratio }}</span>
                <span v-if="d.style" class="badge badge-style">{{ formatStyle(d.style) }}</span>
                <span v-if="d.genre" class="badge badge-genre">{{ formatGenre(d.genre) }}</span>
              </div>
              <div class="project-progress">
                <div class="project-progress-head">
                  <span>{{ projectProgress(d).label }}</span>
                  <b>{{ projectProgress(d).percent }}%</b>
                </div>
                <div class="project-progress-track" aria-hidden="true"><span :style="{ width: projectProgress(d).percent + '%' }" /></div>
                <small>{{ projectProgress(d).next }}</small>
              </div>
              <a v-if="latestFinalVideo(d)" class="project-play" :href="latestFinalVideo(d)" target="_blank" rel="noopener" @click.stop>
                <span class="project-play-dot">▶</span><span>播放最新成片</span>
              </a>
              <div class="project-footer">
                <p class="project-meta">更新于 {{ formatDate(d.updated_at) }}</p>
                <el-button text class="project-continue" @click.stop="continueProject(d)">继续制作 <span aria-hidden="true">→</span></el-button>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="dramas.length && !loading" class="project-empty-state">
          <el-icon><Search /></el-icon>
          <h3>没有匹配的项目</h3>
          <p>调整关键词、类型或状态筛选，快速找到要继续的作品。</p>
          <el-button @click="clearProjectFilters">清除筛选</el-button>
        </div>
        <div v-else-if="!loading" class="project-empty-state project-empty-state--first">
          <span class="empty-orbit">✦</span>
          <h3>开始你的第一个作品</h3>
          <p>从故事、角色与分镜开始，逐步生成图片、视频并合成为完整成片。</p>
          <el-button type="primary" class="home-primary" @click="goNewProject()"><el-icon><Plus /></el-icon>创建项目</el-button>
        </div>
      </section>
    </main>

    <!-- 新建项目：先填标题和描述 -->
    <el-dialog
      v-model="showNewDialog"
      title="新建项目"
      width="480px"
      :close-on-click-modal="false"
      @closed="resetNewForm"
    >
      <el-form :model="newForm" label-width="80px" label-position="top">
        <el-form-item label="标题" required>
          <el-input v-model="newForm.title" placeholder="输入项目标题" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newForm.description" type="textarea" :rows="3" placeholder="输入项目描述（选填）" />
        </el-form-item>
        <el-form-item label="创作类型">
          <el-select v-model="newForm.content_type" style="width: 100%">
            <el-option v-for="mode in creationModes" :key="mode.value" :label="mode.label + ' · ' + mode.desc" :value="mode.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="画面比例">
          <el-select v-model="newForm.aspect_ratio" style="width: 100%">
            <el-option label="16:9 横屏（默认）" value="16:9" />
            <el-option label="9:16 竖屏（短视频）" value="9:16" />
            <el-option label="3:4 竖版" value="3:4" />
            <el-option label="1:1 方形" value="1:1" />
            <el-option label="4:3 传统横屏" value="4:3" />
            <el-option label="21:9 宽银幕" value="21:9" />
          </el-select>
          <p style="margin: 4px 0 0; font-size: 12px; color: #71717a;">影响分镜图和视频的生成比例，短视频选 9:16</p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNewDialog = false">取消</el-button>
        <el-button type="primary" :loading="newSaving" :disabled="!newForm.title?.trim()" @click="submitNew">确定</el-button>
      </template>
    </el-dialog>

    <!-- AI 配置弹窗 -->
    <el-dialog v-model="showAiConfigDialog" title="AI 配置" width="90%" destroy-on-close>
      <AIConfigContent v-if="showAiConfigDialog" />
    </el-dialog>

    <!-- 公共角色库 -->
    <el-dialog v-model="showCharLibrary" title="素材库 · 角色" width="720px" destroy-on-close class="library-dialog" @open="loadCharLibraryList">
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
              <el-button size="small" @click="openEditCharLibrary(item)">编辑</el-button>
              <el-button size="small" type="danger" plain @click="onDeleteCharLibrary(item)">删除</el-button>
            </div>
          </div>
        </div>
        <div v-if="!charLibraryLoading && charLibraryList.length === 0" class="library-empty">素材库暂无角色，可在项目中将角色「加入素材库」后在此查看</div>
      </div>
      <div class="library-pagination">
        <el-pagination v-model:current-page="charLibraryPage" v-model:page-size="charLibraryPageSize" :total="charLibraryTotal" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @current-change="loadCharLibraryList" @size-change="loadCharLibraryList" />
      </div>
      <template #footer><el-button @click="showCharLibrary = false">关闭</el-button></template>
    </el-dialog>
    <!-- 编辑公共角色 -->
    <el-dialog v-model="showEditCharLibrary" title="编辑素材角色" width="480px" @close="editCharLibraryForm = null">
      <el-form v-if="editCharLibraryForm" label-width="80px">
        <el-form-item label="图片">
          <div class="lib-img-editor">
            <div class="lib-img-thumb" @click="openImagePreview(assetImageUrl(editCharLibraryForm))">
              <img v-if="editCharLibraryForm.image_url || editCharLibraryForm.local_path" :src="assetImageUrl(editCharLibraryForm)" />
              <div v-else class="lib-img-empty"><el-icon><PictureFilled /></el-icon></div>
            </div>
            <div class="lib-img-btns">
              <el-button size="small" :loading="editCharLibraryForm.imgUploading" @click="charLibFileRef.click()">上传图片</el-button>
              <el-button size="small" type="primary" :loading="editCharLibraryForm.imgGenerating" @click="doGenerateLibImg(editCharLibraryForm, (editCharLibraryForm.name + (editCharLibraryForm.description ? ', ' + editCharLibraryForm.description : '')), characterLibraryAPI, loadCharLibraryList)">AI 生成</el-button>
            </div>
          </div>
          <input ref="charLibFileRef" type="file" accept="image/*" style="display:none" @change="e => doUploadLibImg(e, editCharLibraryForm, characterLibraryAPI, loadCharLibraryList)" />
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="editCharLibraryForm.name" placeholder="角色名称" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="editCharLibraryForm.category" placeholder="可选" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editCharLibraryForm.description" type="textarea" :rows="3" placeholder="可选" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="editCharLibraryForm.tags" placeholder="可选，逗号分隔" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditCharLibrary = false">取消</el-button>
        <el-button type="primary" :loading="editCharLibrarySaving" @click="submitEditCharLibrary">保存</el-button>
      </template>
    </el-dialog>

    <!-- 公共场景库 -->
    <el-dialog v-model="showSceneLibrary" title="素材库 · 场景" width="720px" destroy-on-close class="library-dialog" @open="loadSceneLibraryList">
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
        <div v-if="!sceneLibraryLoading && sceneLibraryList.length === 0" class="library-empty">素材库暂无场景，可在项目中将场景「加入素材库」后在此查看</div>
      </div>
      <div class="library-pagination">
        <el-pagination v-model:current-page="sceneLibraryPage" v-model:page-size="sceneLibraryPageSize" :total="sceneLibraryTotal" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @current-change="loadSceneLibraryList" @size-change="loadSceneLibraryList" />
      </div>
      <template #footer><el-button @click="showSceneLibrary = false">关闭</el-button></template>
    </el-dialog>
    <!-- 编辑公共场景 -->
    <el-dialog v-model="showEditSceneLibrary" title="编辑素材场景" width="480px" @close="editSceneLibraryForm = null">
      <el-form v-if="editSceneLibraryForm" label-width="80px">
        <el-form-item label="图片">
          <div class="lib-img-editor">
            <div class="lib-img-thumb" @click="openImagePreview(assetImageUrl(editSceneLibraryForm))">
              <img v-if="editSceneLibraryForm.image_url || editSceneLibraryForm.local_path" :src="assetImageUrl(editSceneLibraryForm)" />
              <div v-else class="lib-img-empty"><el-icon><PictureFilled /></el-icon></div>
            </div>
            <div class="lib-img-btns">
              <el-button size="small" :loading="editSceneLibraryForm.imgUploading" @click="sceneLibFileRef.click()">上传图片</el-button>
              <el-button size="small" type="primary" :loading="editSceneLibraryForm.imgGenerating" @click="doGenerateLibImg(editSceneLibraryForm, ([editSceneLibraryForm.location, editSceneLibraryForm.time, editSceneLibraryForm.description].filter(Boolean).join(', ')), sceneLibraryAPI, loadSceneLibraryList)">AI 生成</el-button>
            </div>
          </div>
          <input ref="sceneLibFileRef" type="file" accept="image/*" style="display:none" @change="e => doUploadLibImg(e, editSceneLibraryForm, sceneLibraryAPI, loadSceneLibraryList)" />
        </el-form-item>
        <el-form-item label="地点"><el-input v-model="editSceneLibraryForm.location" placeholder="场景地点" /></el-form-item>
        <el-form-item label="时间"><el-input v-model="editSceneLibraryForm.time" placeholder="如：浅色/夜晚" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="editSceneLibraryForm.category" placeholder="可选" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editSceneLibraryForm.description" type="textarea" :rows="3" placeholder="可选" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="editSceneLibraryForm.tags" placeholder="可选，逗号分隔" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditSceneLibrary = false">取消</el-button>
        <el-button type="primary" :loading="editSceneLibrarySaving" @click="submitEditSceneLibrary">保存</el-button>
      </template>
    </el-dialog>

    <!-- 公共道具库 -->
    <el-dialog v-model="showPropLibrary" title="素材库 · 道具" width="720px" destroy-on-close class="library-dialog" @open="loadPropLibraryList">
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
        <div v-if="!propLibraryLoading && propLibraryList.length === 0" class="library-empty">素材库暂无道具，可在项目中将道具「加入素材库」后在此查看</div>
      </div>
      <div class="library-pagination">
        <el-pagination v-model:current-page="propLibraryPage" v-model:page-size="propLibraryPageSize" :total="propLibraryTotal" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @current-change="loadPropLibraryList" @size-change="loadPropLibraryList" />
      </div>
      <template #footer><el-button @click="showPropLibrary = false">关闭</el-button></template>
    </el-dialog>
    <!-- 编辑公共道具 -->
    <el-dialog v-model="showEditPropLibrary" title="编辑素材道具" width="480px" @close="editPropLibraryForm = null">
      <el-form v-if="editPropLibraryForm" label-width="80px">
        <el-form-item label="图片">
          <div class="lib-img-editor">
            <div class="lib-img-thumb" @click="openImagePreview(assetImageUrl(editPropLibraryForm))">
              <img v-if="editPropLibraryForm.image_url || editPropLibraryForm.local_path" :src="assetImageUrl(editPropLibraryForm)" />
              <div v-else class="lib-img-empty"><el-icon><PictureFilled /></el-icon></div>
            </div>
            <div class="lib-img-btns">
              <el-button size="small" :loading="editPropLibraryForm.imgUploading" @click="propLibFileRef.click()">上传图片</el-button>
              <el-button size="small" type="primary" :loading="editPropLibraryForm.imgGenerating" @click="doGenerateLibImg(editPropLibraryForm, (editPropLibraryForm.name + (editPropLibraryForm.description ? ', ' + editPropLibraryForm.description : '')), propLibraryAPI, loadPropLibraryList)">AI 生成</el-button>
            </div>
          </div>
          <input ref="propLibFileRef" type="file" accept="image/*" style="display:none" @change="e => doUploadLibImg(e, editPropLibraryForm, propLibraryAPI, loadPropLibraryList)" />
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="editPropLibraryForm.name" placeholder="道具名称" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="editPropLibraryForm.category" placeholder="可选" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editPropLibraryForm.description" type="textarea" :rows="3" placeholder="可选" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="editPropLibraryForm.tags" placeholder="可选，逗号分隔" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditPropLibrary = false">取消</el-button>
        <el-button type="primary" :loading="editPropLibrarySaving" @click="submitEditPropLibrary">保存</el-button>
      </template>
    </el-dialog>

    <!-- 微信二维码 -->
    <el-dialog v-if="!vendorLockEnabled" v-model="showWechat" title="微信联系作者" width="320px" align-center>
      <div style="text-align:center;padding:8px 0 4px">
        <img src="/wx.jpg" alt="微信二维码" style="width:240px;height:240px;object-fit:contain;border-radius:8px;" />
        <p style="margin:12px 0 0;font-size:13px;color:var(--text-secondary,#a1a1aa);">扫码添加微信，欢迎交流</p>
      </div>
    </el-dialog>

    <!-- 图片放大预览 -->
    <Teleport to="body">
      <div v-if="previewImageUrl" class="image-preview-overlay" @click="previewImageUrl = null">
        <img :src="previewImageUrl" alt="" class="image-preview-img" @click.stop="previewImageUrl = null" />
      </div>
    </Teleport>

    <!-- 编辑项目：修改标题和故事 -->
    <el-dialog
      v-model="showEditDialog"
      title="编辑项目"
      width="480px"
      :close-on-click-modal="false"
      @closed="resetEditForm"
    >
      <el-form :model="editForm" label-width="80px" label-position="top">
        <el-form-item label="标题" required>
          <el-input v-model="editForm.title" placeholder="输入项目标题" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="故事">
          <el-input v-model="editForm.description" type="textarea" :rows="3" placeholder="输入故事梗概（选填）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="editSaving" :disabled="!editForm.title?.trim()" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Delete, Setting, Plus, User, PictureFilled, Box, Sunny, Moon, ChatDotSquare, Download, Upload, QuestionFilled, FolderOpened, MagicStick, Files, Search } from '@element-plus/icons-vue'
import { useTheme } from '@/composables/useTheme'
import { dramaAPI } from '@/api/drama'
import { characterLibraryAPI } from '@/api/characterLibrary'
import { sceneLibraryAPI } from '@/api/sceneLibrary'
import { propLibraryAPI } from '@/api/propLibrary'
import { uploadAPI } from '@/api/upload'
import { aiAPI } from '@/api/ai'
import { imagesAPI } from '@/api/images'
import { taskAPI } from '@/api/task'
import { getStyleLabel } from '@/constants/styleOptions'

const router = useRouter()
const { isDark, toggle: toggleTheme } = useTheme()
const AIConfigContent = defineAsyncComponent(() => import('@/components/AIConfigContent.vue'))

// 库编辑图片 – 文件输入 refs
const charLibFileRef  = ref(null)
const sceneLibFileRef = ref(null)
const propLibFileRef  = ref(null)

// 共享：上传图片
async function doUploadLibImg(event, form, api, reloadFn) {
  const file = event.target?.files?.[0]
  if (event.target) event.target.value = ''
  if (!file || !form?.id) return
  form.imgUploading = true
  try {
    const res = await uploadAPI.uploadImage(file)
    const data = res?.data ?? res
    const url = data?.url || data?.path || data?.local_path
    if (!url) { ElMessage.error('上传未返回地址'); return }
    form.image_url = url
    form.local_path = data?.local_path ?? null
    await api.update(form.id, { image_url: url, local_path: null })
    reloadFn()
    ElMessage.success('图片已更新')
  } catch (e) { ElMessage.error(e.message || '上传失败') }
  finally { form.imgUploading = false }
}

// 共享：AI 生成图片
async function doGenerateLibImg(form, prompt, api, reloadFn) {
  if (!prompt?.trim()) { ElMessage.warning('请先填写名称或描述'); return }
  form.imgGenerating = true
  try {
    const res = await imagesAPI.create({ prompt: prompt.trim(), drama_id: null })
    const imgData = res?.data ?? res
    const taskId = imgData?.task_id
    if (!taskId) throw new Error('未返回任务ID')
    let task = null
    for (let i = 0; i < 300; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const tr = await taskAPI.get(taskId)
      task = tr?.data ?? tr
      if (task.status === 'completed') break
      if (task.status === 'failed') throw new Error(task.error || '生成失败')
    }
    if (!task || task.status !== 'completed') throw new Error('生成超时')
    const result = task.result
    const imageUrl = result?.image_url
    const localPath = result?.local_path ?? null
    if (!imageUrl && !localPath) throw new Error('未获取到图片地址')
    form.image_url = imageUrl || ''
    form.local_path = localPath
    await api.update(form.id, { image_url: imageUrl || null, local_path: localPath })
    reloadFn()
    ElMessage.success('AI 图片已生成')
  } catch (e) { ElMessage.error(e.message || '生成失败') }
  finally { form.imgGenerating = false }
}

const loading = ref(false)
const dramas = ref([])
const total = ref(0)
const projectQuery = ref('')
const projectTypeFilter = ref('all')
const projectStatusFilter = ref('all')
const projectSort = ref('updated-desc')

const showAiConfigDialog = ref(false)
const showWechat = ref(false)
const vendorLockEnabled = ref(false)

// 图片预览
const previewImageUrl = ref(null)
function assetImageUrl(item) {
  if (!item) return ''
  if (typeof item === 'string') return item.startsWith('http') ? item : item
  const localPath = item.local_path && String(item.local_path).trim()
  if (localPath) return '/static/' + localPath.replace(/^\//, '')
  return item.image_url || ''
}
function openImagePreview(url) {
  if (url) previewImageUrl.value = url
}

// 公共角色库
const showCharLibrary = ref(false)
const charLibraryList = ref([])
const charLibraryLoading = ref(false)
const charLibraryPage = ref(1)
const charLibraryPageSize = ref(20)
const charLibraryTotal = ref(0)
const charLibraryKeyword = ref('')
const showEditCharLibrary = ref(false)
const editCharLibraryForm = ref(null)
const editCharLibrarySaving = ref(false)
let charLibraryKeywordTimer = null

async function loadCharLibraryList() {
  charLibraryLoading.value = true
  try {
    const res = await characterLibraryAPI.list({ page: charLibraryPage.value, page_size: charLibraryPageSize.value, keyword: charLibraryKeyword.value || undefined, global: 1 })
    charLibraryList.value = res?.items ?? []
    const p = res?.pagination ?? {}
    charLibraryTotal.value = p.total ?? 0
    if (p.page != null) charLibraryPage.value = p.page
    if (p.page_size != null) charLibraryPageSize.value = p.page_size
  } catch { charLibraryList.value = [] } finally { charLibraryLoading.value = false }
}
function debouncedLoadCharLibrary() {
  if (charLibraryKeywordTimer) clearTimeout(charLibraryKeywordTimer)
  charLibraryKeywordTimer = setTimeout(() => { charLibraryPage.value = 1; loadCharLibraryList() }, 300)
}
function openEditCharLibrary(item) {
  editCharLibraryForm.value = { id: item.id, name: item.name ?? '', category: item.category ?? '', description: item.description ?? '', tags: item.tags ?? '', image_url: item.image_url ?? '', local_path: item.local_path ?? null, imgUploading: false, imgGenerating: false }
  showEditCharLibrary.value = true
}
async function submitEditCharLibrary() {
  if (!editCharLibraryForm.value?.id) return
  editCharLibrarySaving.value = true
  try {
    await characterLibraryAPI.update(editCharLibraryForm.value.id, { name: editCharLibraryForm.value.name, category: editCharLibraryForm.value.category || null, description: editCharLibraryForm.value.description || null, tags: editCharLibraryForm.value.tags || null, image_url: editCharLibraryForm.value.image_url || null, local_path: editCharLibraryForm.value.local_path ?? null })
    ElMessage.success('已保存')
    showEditCharLibrary.value = false
    loadCharLibraryList()
  } catch (e) { ElMessage.error(e.message || '保存失败') } finally { editCharLibrarySaving.value = false }
}
async function onDeleteCharLibrary(item) {
  try { await ElMessageBox.confirm(`确定删除公共角色「${(item.name || '未命名').slice(0, 20)}」吗？`, '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  try { await characterLibraryAPI.delete(item.id); ElMessage.success('已删除'); loadCharLibraryList() } catch (e) { ElMessage.error(e.message || '删除失败') }
}

// 公共场景库
const showSceneLibrary = ref(false)
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

async function loadSceneLibraryList() {
  sceneLibraryLoading.value = true
  try {
    const res = await sceneLibraryAPI.list({ page: sceneLibraryPage.value, page_size: sceneLibraryPageSize.value, keyword: sceneLibraryKeyword.value || undefined, global: 1 })
    sceneLibraryList.value = res?.items ?? []
    const p = res?.pagination ?? {}
    sceneLibraryTotal.value = p.total ?? 0
    if (p.page != null) sceneLibraryPage.value = p.page
    if (p.page_size != null) sceneLibraryPageSize.value = p.page_size
  } catch { sceneLibraryList.value = [] } finally { sceneLibraryLoading.value = false }
}
function debouncedLoadSceneLibrary() {
  if (sceneLibraryKeywordTimer) clearTimeout(sceneLibraryKeywordTimer)
  sceneLibraryKeywordTimer = setTimeout(() => { sceneLibraryPage.value = 1; loadSceneLibraryList() }, 300)
}
function openEditSceneLibrary(item) {
  editSceneLibraryForm.value = { id: item.id, location: item.location ?? '', time: item.time ?? '', category: item.category ?? '', description: item.description ?? '', tags: item.tags ?? '', image_url: item.image_url ?? '', local_path: item.local_path ?? null, imgUploading: false, imgGenerating: false }
  showEditSceneLibrary.value = true
}
async function submitEditSceneLibrary() {
  if (!editSceneLibraryForm.value?.id) return
  editSceneLibrarySaving.value = true
  try {
    await sceneLibraryAPI.update(editSceneLibraryForm.value.id, { location: editSceneLibraryForm.value.location, time: editSceneLibraryForm.value.time || null, category: editSceneLibraryForm.value.category || null, description: editSceneLibraryForm.value.description || null, tags: editSceneLibraryForm.value.tags || null, image_url: editSceneLibraryForm.value.image_url || null, local_path: editSceneLibraryForm.value.local_path ?? null })
    ElMessage.success('已保存')
    showEditSceneLibrary.value = false
    loadSceneLibraryList()
  } catch (e) { ElMessage.error(e.message || '保存失败') } finally { editSceneLibrarySaving.value = false }
}
async function onDeleteSceneLibrary(item) {
  const name = (item.location || item.time || '未命名').slice(0, 20)
  try { await ElMessageBox.confirm(`确定删除公共场景「${name}」吗？`, '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  try { await sceneLibraryAPI.delete(item.id); ElMessage.success('已删除'); loadSceneLibraryList() } catch (e) { ElMessage.error(e.message || '删除失败') }
}

// 公共道具库
const showPropLibrary = ref(false)
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

async function loadPropLibraryList() {
  propLibraryLoading.value = true
  try {
    const res = await propLibraryAPI.list({ page: propLibraryPage.value, page_size: propLibraryPageSize.value, keyword: propLibraryKeyword.value || undefined, global: 1 })
    propLibraryList.value = res?.items ?? []
    const p = res?.pagination ?? {}
    propLibraryTotal.value = p.total ?? 0
    if (p.page != null) propLibraryPage.value = p.page
    if (p.page_size != null) propLibraryPageSize.value = p.page_size
  } catch { propLibraryList.value = [] } finally { propLibraryLoading.value = false }
}
function debouncedLoadPropLibrary() {
  if (propLibraryKeywordTimer) clearTimeout(propLibraryKeywordTimer)
  propLibraryKeywordTimer = setTimeout(() => { propLibraryPage.value = 1; loadPropLibraryList() }, 300)
}
function openEditPropLibrary(item) {
  editPropLibraryForm.value = { id: item.id, name: item.name ?? '', category: item.category ?? '', description: item.description ?? '', tags: item.tags ?? '', image_url: item.image_url ?? '', local_path: item.local_path ?? null, imgUploading: false, imgGenerating: false }
  showEditPropLibrary.value = true
}
async function submitEditPropLibrary() {
  if (!editPropLibraryForm.value?.id) return
  editPropLibrarySaving.value = true
  try {
    await propLibraryAPI.update(editPropLibraryForm.value.id, { name: editPropLibraryForm.value.name, category: editPropLibraryForm.value.category || null, description: editPropLibraryForm.value.description || null, tags: editPropLibraryForm.value.tags || null, image_url: editPropLibraryForm.value.image_url || null, local_path: editPropLibraryForm.value.local_path ?? null })
    ElMessage.success('已保存')
    showEditPropLibrary.value = false
    loadPropLibraryList()
  } catch (e) { ElMessage.error(e.message || '保存失败') } finally { editPropLibrarySaving.value = false }
}
async function onDeletePropLibrary(item) {
  try { await ElMessageBox.confirm(`确定删除公共道具「${(item.name || '未命名').slice(0, 20)}」吗？`, '删除确认', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) } catch { return }
  try { await propLibraryAPI.delete(item.id); ElMessage.success('已删除'); loadPropLibraryList() } catch (e) { ElMessage.error(e.message || '删除失败') }
}

const showNewDialog = ref(false)
const creationModes = [
  { value: 'anime_series', label: '漫剧', desc: '角色与画风连续的系列叙事', icon: '✦' },
  { value: 'short_drama', label: '短剧', desc: '剧本驱动的剧情成片', icon: '◈' },
  { value: 'short_video', label: '短视频', desc: '适配平台节奏的创意内容', icon: '◉' },
  { value: 'store_promo', label: '店铺宣传', desc: '商品、门店与品牌表达', icon: '▣' },
]
const contentTypeDefaults = {
  anime_series: { aspect_ratio: '9:16', target_duration: 60, video_clip_duration: 6 },
  short_drama: { aspect_ratio: '9:16', target_duration: 90, video_clip_duration: 7 },
  short_video: { aspect_ratio: '9:16', target_duration: 30, video_clip_duration: 5 },
  store_promo: { aspect_ratio: '9:16', target_duration: 30, video_clip_duration: 5 },
}

const filteredDramas = computed(() => {
  const query = projectQuery.value.trim().toLocaleLowerCase('zh-CN')
  let list = [...dramas.value]

  if (query) {
    list = list.filter((d) => {
      const haystack = [
        d.title,
        d.description,
        d.genre,
        formatGenre(d.genre),
        creationModeLabel(d.metadata?.content_type),
      ].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN')
      return haystack.includes(query)
    })
  }
  if (projectTypeFilter.value !== 'all') {
    list = list.filter((d) => (d.metadata?.content_type || 'short_drama') === projectTypeFilter.value)
  }
  if (projectStatusFilter.value !== 'all') {
    list = list.filter((d) => (d.status || 'draft') === projectStatusFilter.value)
  }

  if (projectSort.value === 'progress-desc') {
    list.sort((a, b) => projectProgress(b).percent - projectProgress(a).percent || dateValue(b.updated_at) - dateValue(a.updated_at))
  } else if (projectSort.value === 'title-asc') {
    list.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN'))
  } else {
    list.sort((a, b) => dateValue(b.updated_at) - dateValue(a.updated_at))
  }
  return list
})
const newForm = ref({ title: '', description: '', aspect_ratio: '16:9', content_type: 'short_drama' })
const newSaving = ref(false)
const exportingId = ref(null)
const importing = ref(false)
const importFileInput = ref(null)

const exampleList = ref([])
const importingExample = ref(null)

function loadExamples() {
  dramaAPI.listExamples()
    .then(res => { exampleList.value = Array.isArray(res) ? res : (res?.data ?? []) })
    .catch(() => { exampleList.value = [] })
}

async function onImportExample(ex) {
  importingExample.value = ex.filename
  try {
    const data = await dramaAPI.importExample(ex.filename)
    ElMessage.success(`示例导入成功：${data?.title || ex.name}`)
    loadList()
  } catch (e) {
    const msg = e.response?.data?.message || e.message || '导入失败'
    ElMessage.error(msg)
  } finally {
    importingExample.value = null
  }
}

const showEditDialog = ref(false)
const editForm = ref({ id: null, title: '', description: '' })
const editSaving = ref(false)

function loadList() {
  loading.value = true
  dramaAPI
    .list({ page: 1, page_size: 50 })
    .then((res) => {
      dramas.value = res?.items ?? []
      total.value = res?.pagination?.total ?? 0
    })
    .catch(() => {
      dramas.value = []
    })
    .finally(() => {
      loading.value = false
    })
}

function formatDate(val) {
  if (!val) return ''
  const d = new Date(val)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatStatus(status) {
  const map = { draft: '草稿', published: '已发布', archived: '已归档', generating: '生成中' }
  return map[status] || status || '草稿'
}

function formatStyle(style) {
  const aliases = { anime: 'anime style', sci_fi: 'sci-fi' }
  const key = aliases[style] || style
  return getStyleLabel(key)
}

function formatGenre(genre) {
  const map = { drama: '剧情', comedy: '喜剧', adventure: '冒险', romance: '爱情', thriller: '悬疑', action: '动作', horror: '恐怖' }
  return map[genre] || genre
}

function totalStoryboards(d) {
  return (d.episodes || []).reduce((sum, ep) => sum + (ep.storyboards?.length || 0), 0)
}

function dateValue(value) {
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function creationModeLabel(value) {
  return creationModes.find((mode) => mode.value === value)?.label || '短剧'
}

function projectTypeTitle(d) {
  const type = d?.metadata?.content_type || 'short_drama'
  const labels = {
    anime_series: 'ANIME SERIES',
    short_drama: 'STORY PROJECT',
    short_video: 'SHORT FORM',
    store_promo: 'BRAND FILM',
  }
  return labels[type] || 'STORY PROJECT'
}

function projectProgress(d) {
  const episodes = Array.isArray(d?.episodes) ? d.episodes : []
  const storyboards = episodes.flatMap((ep) => Array.isArray(ep?.storyboards) ? ep.storyboards : [])
  const stages = [
    episodes.some((ep) => String(ep?.script_content || '').trim()),
    storyboards.length > 0,
    storyboards.some((sb) => sb?.image_url || sb?.local_path || sb?.first_frame_image_id),
    storyboards.some((sb) => sb?.video_url),
    episodes.some((ep) => ep?.video_url),
  ]
  const stageLabels = ['剧本', '分镜', '画面', '视频片段', '成片']
  const done = stages.filter(Boolean).length
  const nextIndex = stages.findIndex((doneStage) => !doneStage)
  const percent = Math.round((done / stages.length) * 100)
  return {
    percent,
    label: done === stages.length ? '成片已就绪' : (done === 0 ? '等待开场' : `已完成 ${done}/${stages.length} 阶段`),
    next: done === stages.length ? '可以播放、导出，或继续迭代内容' : `下一步：${stageLabels[nextIndex]}`,
  }
}

function clearProjectFilters() {
  projectQuery.value = ''
  projectTypeFilter.value = 'all'
  projectStatusFilter.value = 'all'
  projectSort.value = 'updated-desc'
}

function continueProject(d) {
  if (d?.id == null) return
  router.push('/film/' + d.id)
}

function latestFinalVideo(d) {
  const episode = [...(d.episodes || [])].reverse().find((ep) => ep.video_url)
  const value = String(episode?.video_url || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value) || value.startsWith('/')) return value
  return `/static/${value.replace(/^\/+/, '')}`
}

function goNewProject(contentType = 'short_drama') {
  newForm.value.content_type = contentType
  newForm.value.aspect_ratio = contentTypeDefaults[contentType]?.aspect_ratio || '9:16'
  showNewDialog.value = true
}

function resetNewForm() {
  newForm.value = { title: '', description: '', aspect_ratio: '16:9', content_type: 'short_drama' }
}

async function submitNew() {
  const title = newForm.value.title?.trim()
  if (!title) return
  newSaving.value = true
  try {
    const profile = contentTypeDefaults[newForm.value.content_type] || contentTypeDefaults.short_drama
    const drama = await dramaAPI.create({ title, description: newForm.value.description?.trim() || undefined, metadata: { aspect_ratio: newForm.value.aspect_ratio || profile.aspect_ratio, content_type: newForm.value.content_type, target_duration: profile.target_duration, video_clip_duration: profile.video_clip_duration } })
    showNewDialog.value = false
    ElMessage.success('项目已创建')
    loadList()
    router.push('/film/' + drama.id)
  } catch (e) {
    ElMessage.error(e.message || '创建失败')
  } finally {
    newSaving.value = false
  }
}

function openEditDialog(d) {
  editForm.value = { id: d.id, title: d.title || '', description: d.description || '' }
  showEditDialog.value = true
}

function resetEditForm() {
  editForm.value = { id: null, title: '', description: '' }
}

async function submitEdit() {
  const title = editForm.value.title?.trim()
  if (!title || editForm.value.id == null) return
  editSaving.value = true
  try {
    await dramaAPI.update(editForm.value.id, { title, description: editForm.value.description?.trim() || undefined })
    showEditDialog.value = false
    ElMessage.success('已保存')
    loadList()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    editSaving.value = false
  }
}

function openProject(id) {
  router.push('/drama/' + id)
}

function onExport(d) {
  if (exportingId.value) return
  exportingId.value = d.id
  try {
    // 大 ZIP 用浏览器原生下载，避免 axios blob 经 dev proxy 整包缓冲导致 ERR_FAILED
    const a = document.createElement('a')
    a.href = `/api/v1/dramas/${d.id}/export`
    a.download = `${d.title || 'drama'}.zip`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    ElMessage.success('开始下载')
  } catch (e) {
    ElMessage.error(e.message || '导出失败')
  } finally {
    exportingId.value = null
  }
}

function triggerImport() {
  importFileInput.value?.click()
}

async function onImportFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = ''
  if (!file.name.endsWith('.zip')) {
    ElMessage.error('请选择 .zip 格式的文件')
    return
  }
  importing.value = true
  try {
    const data = await dramaAPI.importDrama(file)
    ElMessage.success(`导入成功：${data?.title || '项目'}`) 
    loadList()
  } catch (e) {
    const msg = e.response?.data?.message || e.message || '导入失败'
    ElMessage.error(msg)
  } finally {
    importing.value = false
  }
}

async function onDelete(d) {
  try {
    await ElMessageBox.confirm(
      `确定要删除项目「${(d.title || '未命名').slice(0, 20)}${(d.title && d.title.length > 20) ? '…' : ''}」吗？此操作不可恢复。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await dramaAPI.delete(d.id)
    ElMessage.success('已删除')
    loadList()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

onMounted(async () => {
  loadList()
  loadExamples()
  try {
    const lock = await aiAPI.getVendorLock()
    vendorLockEnabled.value = !!lock?.enabled
  } catch (_) {}
})
</script>

<style scoped>
.film-list {
  min-height: 100vh;
  color: #101828;
  background: radial-gradient(circle at 8% -10%, #e9e3ff 0, transparent 30%), radial-gradient(circle at 88% 0, #e4f1ff 0, transparent 28%), #f5f7fb;
}
.home-header { position: sticky; top: 0; z-index: 100; height: 68px; border-bottom: 1px solid rgba(16,24,40,.06); background: rgba(255,255,255,.76); backdrop-filter: blur(18px) saturate(150%); }
.home-header-inner { max-width: 1440px; height: 100%; padding: 0 32px; margin: auto; display: flex; align-items: center; gap: 38px; }
.home-header .logo { min-width: 196px; }
.home-header .logo-main { color: #101828; font-size: 18px; letter-spacing: -.04em; background: none; -webkit-text-fill-color: initial; filter: none; }
.home-header .logo-sub { margin-top: 3px; color: #7b8193; font-size: 9px; letter-spacing: .12em; }
.home-nav { display: flex; align-items: center; gap: 6px; }
.home-nav-item { padding: 9px 13px; border: 0; border-radius: 10px; color: #667085; background: transparent; cursor: pointer; font: 600 13px var(--ld-font); }
.home-nav-item:hover, .home-nav-item.is-active { color: #5b3dcc; background: #f0edff; }
.home-actions { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.home-icon-button { width: 38px; height: 38px; padding: 0; color: #667085; border-radius: 10px; }
.home-primary { border: 0 !important; border-radius: 11px !important; background: linear-gradient(135deg,#6d4ae8,#8560f2) !important; box-shadow: 0 8px 18px rgba(109,74,232,.24) !important; }
.home-main { max-width: 1440px; margin: auto; padding: 44px 32px 72px; }
.home-hero { min-height: 330px; padding: 48px; display: grid; grid-template-columns: minmax(0,1.2fr) minmax(390px,.8fr); gap: 40px; border: 1px solid rgba(255,255,255,.9); border-radius: 28px; overflow: hidden; position: relative; background: linear-gradient(118deg,#16133a 0%,#2b2165 52%,#6651c7 100%); box-shadow: 0 18px 44px rgba(63,60,138,.18); }
.home-hero::after { content:""; position:absolute; width:420px;height:420px;right:-90px;top:-180px;border-radius:50%;background:radial-gradient(circle,rgba(177,156,255,.58),transparent 66%);pointer-events:none; }
.hero-copy { position:relative;z-index:1;color:#fff; }
.hero-kicker,.section-heading span { display:block; color:#bcaeff; font-size:10px; font-weight:700; letter-spacing:.15em; }
.hero-copy h2 { margin:16px 0 13px; max-width:570px; font-size:clamp(34px,4vw,54px); line-height:1.08; letter-spacing:-.065em; }
.hero-copy h2 em { font-style:normal; color:#d5caff; }
.hero-copy p { max-width:540px; color:#d7d2f4; font-size:15px; line-height:1.75; }
.hero-actions { display:flex;gap:12px;margin-top:26px; }.hero-secondary { border:1px solid rgba(255,255,255,.24)!important;background:rgba(255,255,255,.11)!important;color:#fff!important;border-radius:11px!important; }
.hero-template { margin-top:21px;color:#bfb7e8;font-size:12px; }.hero-template button { margin-left:8px;color:#fff;border:0;border-bottom:1px solid #9d8de4;background:none;cursor:pointer; }
.hero-modes { position:relative;z-index:1;display:grid;gap:9px;align-content:center; }.hero-mode { display:flex;align-items:center;gap:12px;padding:14px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);border-radius:16px;color:#fff;text-align:left;cursor:pointer;transition:.2s; }.hero-mode:hover { transform:translateX(-4px);background:rgba(255,255,255,.17); }.hero-mode b,.hero-mode small { display:block; }.hero-mode b{font-size:14px}.hero-mode small{margin-top:3px;color:#d8d1f4;font-size:11px}.hero-mode i{margin-left:auto;font-style:normal;color:#d9cffd}.hero-mode .creation-mode-icon{width:32px;height:32px;flex:0 0 32px;background:rgba(255,255,255,.18);box-shadow:none;}
.home-projects { margin-top:42px; }.section-heading { display:flex;align-items:end;justify-content:space-between;margin:0 0 18px; }.section-heading h2 { margin:5px 0 0;color:var(--text-bright);font-size:25px;letter-spacing:-.045em; }.section-heading p { margin:0;color:var(--text-subtle);font-size:13px; }
.project-toolbar { display:grid;grid-template-columns:minmax(220px,1fr) repeat(3,minmax(132px,156px));gap:10px;margin-bottom:18px;padding:12px;border:1px solid var(--border-color);border-radius:16px;background:color-mix(in srgb,var(--bg-card) 82%,transparent);box-shadow:var(--shadow);backdrop-filter:blur(12px); }.project-search,.project-filter,.project-sort{min-width:0;width:100%}.project-toolbar :deep(.el-input__wrapper),.project-toolbar :deep(.el-select__wrapper){min-height:38px;border-radius:10px;}
.home-projects .project-grid { grid-template-columns:repeat(auto-fill,minmax(285px,1fr));gap:20px; }.home-projects .project-card { overflow:hidden;border:1px solid var(--border-color);border-radius:18px;background:color-mix(in srgb,var(--bg-card) 92%,transparent);box-shadow:var(--shadow); }.home-projects .project-card:hover { transform:translateY(-5px);border-color:rgba(109,74,232,.38);box-shadow:0 18px 34px rgba(64,47,143,.14); }.project-cover { height:126px;display:flex;align-items:flex-end;padding:16px;position:relative;overflow:hidden;background:linear-gradient(135deg,#45307f,#8a73e9); }.project-cover::before { content:"";position:absolute;inset:-55% 20% auto -15%;height:180px;border-radius:50%;background:rgba(255,255,255,.15); }.project-cover span { position:relative;color:rgba(255,255,255,.85);font-size:10px;font-weight:700;letter-spacing:.14em; }.project-cover--store_promo{background:linear-gradient(135deg,#c4653e,#f0a36c)}.project-cover--short_video{background:linear-gradient(135deg,#197a86,#55bbb5)}.project-cover--anime_series{background:linear-gradient(135deg,#26375f,#708bd8)}.home-projects .project-card-body{padding-top:16px}.home-projects .project-card-actions{top:138px}.home-projects .project-title{color:var(--text-bright)}.home-projects .project-desc{color:var(--text-muted)}
.project-progress{margin:14px 0 4px;padding:11px 12px;border:1px solid var(--border-color);border-radius:12px;background:color-mix(in srgb,var(--bg-inner) 86%,transparent)}.project-progress-head{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px;color:var(--text-muted)}.project-progress-head b{color:var(--ld-violet-2);font-size:12px}.project-progress-track{height:5px;margin:8px 0 7px;overflow:hidden;border-radius:999px;background:var(--border-color)}.project-progress-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#6d4ae8,#9a82f7);transition:width .25s ease}.project-progress small{display:block;color:var(--text-subtle);font-size:10px;line-height:1.5}.project-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:13px}.project-footer .project-meta{margin:0}.project-continue{padding:5px 2px!important;color:var(--ld-violet-2)!important;font-size:12px;font-weight:700}.project-empty-state{display:grid;min-height:240px;padding:42px;place-items:center;align-content:center;text-align:center;border:1px dashed var(--border-muted);border-radius:18px;background:color-mix(in srgb,var(--bg-card) 68%,transparent)}.project-empty-state>.el-icon{font-size:30px;color:var(--text-faint)}.project-empty-state h3{margin:12px 0 6px;color:var(--text-bright);font-size:17px}.project-empty-state p{max-width:460px;margin:0 0 18px;color:var(--text-muted);font-size:13px;line-height:1.7}.empty-orbit{display:grid;width:46px;height:46px;place-items:center;border-radius:15px;color:#fff;background:linear-gradient(135deg,#6d4ae8,#8560f2);box-shadow:0 12px 24px rgba(109,74,232,.24)}
@media (max-width: 900px){.project-toolbar{grid-template-columns:1fr 1fr}.project-search{grid-column:1/-1}}
@media (max-width: 800px){.home-header-inner{padding:0 16px;gap:12px}.home-header .logo{min-width:auto}.home-nav{display:none}.home-main{padding:20px 16px 48px}.home-hero{padding:29px 23px;grid-template-columns:1fr;gap:26px;border-radius:22px}.hero-copy h2{font-size:38px}.hero-copy p{font-size:13px}.hero-modes{grid-template-columns:1fr 1fr}.hero-mode{padding:10px}.hero-mode small{display:none}.home-actions .home-icon-button{display:none}.home-projects{margin-top:30px}.section-heading h2{font-size:22px}.home-projects .project-grid{grid-template-columns:1fr}.hero-actions .el-button{padding:10px 13px}.project-toolbar{grid-template-columns:1fr}.project-search{grid-column:auto}.project-empty-state{min-height:210px;padding:30px 20px}}
.film-list {
  min-height: 100vh;
  background: #08080d;
  color: #e4e4e7;
  background-image:
    radial-gradient(ellipse 70% 45% at 50% -10%, rgba(99, 102, 241, 0.18) 0%, transparent 70%),
    radial-gradient(ellipse 50% 35% at 85% 55%, rgba(139, 92, 246, 0.1) 0%, transparent 60%),
    radial-gradient(ellipse 40% 30% at 10% 80%, rgba(79, 70, 229, 0.08) 0%, transparent 60%);
}
.action-card-copy {
  margin: 8px 0 14px;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.65;
}
.creation-modes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0 0 16px;
}
.creation-mode {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 10px;
  text-align: left;
  color: var(--text-primary);
  background: rgba(109, 74, 232, .07);
  border: 1px solid rgba(109, 74, 232, .13);
  border-radius: 12px;
  cursor: pointer;
  transition: transform .18s ease, background .18s ease, border-color .18s ease;
}
.creation-mode:hover {
  transform: translateY(-2px);
  background: rgba(109, 74, 232, .13);
  border-color: rgba(109, 74, 232, .35);
}
.creation-mode-icon {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  place-items: center;
  color: #fff;
  background: linear-gradient(135deg, #6d4ae8, #8560f2);
  border-radius: 9px;
  box-shadow: 0 5px 12px rgba(109, 74, 232, .24);
}
.creation-mode b, .creation-mode small { display: block; }
.creation-mode b { font-size: 12px; }
.creation-mode small { margin-top: 2px; color: var(--text-muted); font-size: 10px; line-height: 1.35; }
.header {
  background: rgba(12, 12, 18, 0.82);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(99, 102, 241, 0.18);
  padding: 12px 24px;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 0 rgba(99, 102, 241, 0.08), 0 4px 24px rgba(0, 0, 0, 0.3);
}
.header-inner {
  max-width: min(1400px, 96vw);
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.logo {
  margin: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 1px;
  line-height: 1;
}
.logo-main {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  background: linear-gradient(135deg, #a5b4fc 0%, #c084fc 50%, #f0abfc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.35));
}
.logo-sub {
  font-size: 0.68rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: #6d6d7a;
  -webkit-text-fill-color: #6d6d7a;
  filter: none;
}
.page-title {
  color: #a1a1aa;
  font-size: 0.95rem;
}
.header-library {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 20px;
}
.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 资源库按钮 —— 靛紫调 */
.btn-library {
  --el-button-bg-color: rgba(99, 102, 241, 0.12);
  --el-button-border-color: rgba(99, 102, 241, 0.35);
  --el-button-text-color: #a5b4fc;
  --el-button-hover-bg-color: rgba(99, 102, 241, 0.22);
  --el-button-hover-border-color: rgba(99, 102, 241, 0.55);
  --el-button-hover-text-color: #c7d2fe;
  --el-button-active-bg-color: rgba(99, 102, 241, 0.3);
  --el-button-active-border-color: rgba(99, 102, 241, 0.7);
}
html.light .btn-library {
  --el-button-bg-color: rgba(79, 70, 229, 0.08);
  --el-button-border-color: rgba(79, 70, 229, 0.3);
  --el-button-text-color: #3730a3;
  --el-button-hover-bg-color: rgba(79, 70, 229, 0.14);
  --el-button-hover-border-color: rgba(79, 70, 229, 0.5);
  --el-button-hover-text-color: #312e81;
  --el-button-active-bg-color: rgba(79, 70, 229, 0.2);
  --el-button-active-border-color: rgba(79, 70, 229, 0.65);
}

/* 主题切换按钮 */
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

/* 微信我按钮 —— 绿调 */
.btn-wechat {
  --el-button-bg-color: rgba(34, 197, 94, 0.1);
  --el-button-border-color: rgba(34, 197, 94, 0.3);
  --el-button-text-color: #22c55e;
  --el-button-hover-bg-color: rgba(34, 197, 94, 0.2);
  --el-button-hover-border-color: rgba(34, 197, 94, 0.5);
  --el-button-hover-text-color: #16a34a;
  transition: all 0.2s;
}
html.light .btn-wechat {
  --el-button-bg-color: rgba(21, 128, 61, 0.08);
  --el-button-border-color: rgba(21, 128, 61, 0.3);
  --el-button-text-color: #166534;
  --el-button-hover-bg-color: rgba(21, 128, 61, 0.14);
  --el-button-hover-border-color: rgba(21, 128, 61, 0.5);
  --el-button-hover-text-color: #14532d;
}

/* AI配置按钮 —— 琥珀调 */
.btn-settings {
  --el-button-bg-color: rgba(234, 179, 8, 0.1);
  --el-button-border-color: rgba(234, 179, 8, 0.32);
  --el-button-text-color: #fcd34d;
  --el-button-hover-bg-color: rgba(234, 179, 8, 0.2);
  --el-button-hover-border-color: rgba(234, 179, 8, 0.5);
  --el-button-hover-text-color: #fde68a;
  --el-button-active-bg-color: rgba(234, 179, 8, 0.28);
  --el-button-active-border-color: rgba(234, 179, 8, 0.65);
}
html.light .btn-settings {
  --el-button-bg-color: rgba(180, 83, 9, 0.07);
  --el-button-border-color: rgba(180, 83, 9, 0.28);
  --el-button-text-color: #92400e;
  --el-button-hover-bg-color: rgba(180, 83, 9, 0.12);
  --el-button-hover-border-color: rgba(180, 83, 9, 0.45);
  --el-button-hover-text-color: #78350f;
  --el-button-active-bg-color: rgba(180, 83, 9, 0.18);
  --el-button-active-border-color: rgba(180, 83, 9, 0.6);
}

/* 导入按钮 —— 亮色模式下提升可读性 */
html.light .btn-import {
  --el-button-text-color: #374151;
  --el-button-border-color: #d1d5db;
  --el-button-hover-text-color: #1f2937;
  --el-button-hover-border-color: #9ca3af;
}

.main {
  max-width: min(1400px, 96vw);
  margin: 0 auto;
  padding: 24px 16px 48px;
}
.projects-wrap {
  min-height: 200px;
}
.empty {
  text-align: center;
  padding: 48px 24px;
}
.empty-title {
  font-size: 1.1rem;
  color: #e4e4e7;
  margin: 0 0 8px;
}
.empty-desc {
  color: #71717a;
  font-size: 0.9rem;
  margin: 0 0 20px;
}
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 18px;
}
.project-card {
  position: relative;
  background: rgba(24, 24, 30, 0.75);
  border: 1px solid rgba(63, 63, 70, 0.6);
  border-radius: 14px;
  padding: 20px;
  cursor: pointer;
  transition: border-color 0.25s, background 0.25s, transform 0.25s, box-shadow 0.25s;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  overflow: hidden;
}
.project-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, transparent 60%);
  pointer-events: none;
}
.project-card:hover {
  border-color: rgba(99, 102, 241, 0.55);
  background: rgba(28, 28, 36, 0.9);
  transform: translateY(-3px);
  box-shadow: 0 12px 40px rgba(99, 102, 241, 0.15), 0 0 0 1px rgba(99, 102, 241, 0.1), 0 2px 8px rgba(0, 0, 0, 0.4);
}

/* 操作卡片 */
.action-card {
  cursor: default;
  border-style: dashed;
  border-color: rgba(99, 102, 241, 0.4);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(139, 92, 246, 0.04) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 40px rgba(99, 102, 241, 0.04);
}
.action-card:hover {
  border-color: rgba(99, 102, 241, 0.65);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.07) 100%);
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(99, 102, 241, 0.12), inset 0 0 40px rgba(99, 102, 241, 0.06);
}
.action-card::before {
  display: none;
}
.action-card-inner {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.action-card-title {
  font-size: 1rem;
  font-weight: 600;
  color: #a5b4fc;
  margin: 0;
}
.action-card-buttons {
  display: flex;
  gap: 12px;
  width: 100%;
  justify-content: center;
}
.action-btn {
  min-width: 150px;
}
.action-btn-new {
  --el-button-bg-color: var(--el-color-primary);
}
.action-btn-import {
  --el-button-bg-color: rgba(99, 102, 241, 0.12);
  --el-button-border-color: rgba(99, 102, 241, 0.35);
  --el-button-text-color: #a5b4fc;
  --el-button-hover-bg-color: rgba(99, 102, 241, 0.22);
  --el-button-hover-border-color: rgba(99, 102, 241, 0.55);
  --el-button-hover-text-color: #c7d2fe;
}
.action-card-example {
  width: 100%;
  padding-top: 8px;
  border-top: 1px solid rgba(99, 102, 241, 0.15);
}
.example-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  margin-bottom: 8px;
}
.example-hint-icon {
  color: #a5b4fc;
  font-size: 15px;
}
.example-hint-text {
  font-size: 0.8rem;
  color: #71717a;
}
.example-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}
.example-btn {
  --el-button-bg-color: rgba(34, 197, 94, 0.1);
  --el-button-border-color: rgba(34, 197, 94, 0.3);
  --el-button-text-color: #4ade80;
  --el-button-hover-bg-color: rgba(34, 197, 94, 0.2);
  --el-button-hover-border-color: rgba(34, 197, 94, 0.5);
  --el-button-hover-text-color: #22c55e;
}
.project-card-body {
  padding-right: 56px;
}
.project-title {
  font-size: 1.05rem;
  margin: 0 0 8px;
  color: #fafafa;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.project-desc {
  font-size: 0.875rem;
  color: #a1a1aa;
  margin: 0 0 12px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.project-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 10px;
}
.badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 99px;
  font-weight: 500;
  line-height: 1.5;
  white-space: nowrap;
}
.badge-status--draft {
  background: rgba(113, 113, 122, 0.15);
  color: #a1a1aa;
  border: 1px solid rgba(113, 113, 122, 0.3);
}
.badge-status--published {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}
.badge-status--generating {
  background: rgba(234, 179, 8, 0.12);
  color: #fcd34d;
  border: 1px solid rgba(234, 179, 8, 0.3);
}
.badge-status--archived {
  background: rgba(99, 102, 241, 0.1);
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.25);
}
.badge-episodes {
  background: rgba(14, 165, 233, 0.12);
  color: #38bdf8;
  border: 1px solid rgba(14, 165, 233, 0.28);
}
.badge-storyboards {
  background: rgba(20, 184, 166, 0.12);
  color: #2dd4bf;
  border: 1px solid rgba(20, 184, 166, 0.28);
}
.badge-ratio {
  background: rgba(251, 146, 60, 0.1);
  color: #fb923c;
  border: 1px solid rgba(251, 146, 60, 0.25);
  font-family: monospace;
}
.badge-style {
  background: rgba(168, 85, 247, 0.1);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.25);
}
.badge-genre {
  background: rgba(249, 115, 22, 0.1);
  color: #fb923c;
  border: 1px solid rgba(249, 115, 22, 0.25);
}
.project-meta {
  font-size: 0.75rem;
  color: #71717a;
  margin: 0;
}

.project-play { position: relative; z-index: 2; display: inline-flex; align-items: center; gap: 8px; width: fit-content; margin-top: 13px; padding: 8px 12px; border-radius: 999px; color: #5b3fd1; background: rgba(109,74,232,.1); text-decoration: none; font-size: 12px; font-weight: 700; transition: .2s ease; }
.project-play:hover { color: #fff; background: linear-gradient(135deg, #6d4ae8, #8560f2); transform: translateY(-1px); }
.project-play-dot { font-size: 9px; }
.project-card-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
}
.project-card-actions .el-button {
  --el-button-size: 28px;
  padding: 0;
}
.project-card-actions .el-button .el-icon {
  font-size: 14px;
}

/* 公共库弹窗 */
:global(.library-dialog .el-dialog__body) { padding-top: 8px; }

/* 编辑弹框内图片区 */
.lib-img-editor { display: flex; align-items: center; gap: 14px; }
.lib-img-thumb { width: 88px; height: 88px; border-radius: 8px; overflow: hidden; cursor: zoom-in; background: var(--bg-inner, #1c1c1e); border: 1px solid var(--border-color, #27272a); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.lib-img-thumb img { width: 100%; height: 100%; object-fit: cover; }
.lib-img-empty { color: var(--text-faint, #52525b); font-size: 26px; }
.lib-img-btns { display: flex; flex-direction: column; gap: 8px; }
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
  padding: 10px;
  background: #1c1c1e;
  border: 1px solid #27272a;
  border-radius: 8px;
}
.library-item-cover {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  background: #27272a;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.library-item-cover img { width: 100%; height: 100%; object-fit: cover; }
.library-item-placeholder { font-size: 0.8rem; color: #71717a; }
.library-item-info { flex: 1; min-width: 0; }
.library-item-name { font-weight: 500; margin-bottom: 4px; color: #fafafa; }
.library-item-desc { font-size: 0.85rem; color: #a1a1aa; margin-bottom: 8px; }
.library-item-actions { display: flex; gap: 8px; }
.library-empty { text-align: center; color: #71717a; padding: 40px 20px; }
.library-pagination { margin-top: 12px; display: flex; justify-content: center; }

/* ===== 亮色模式适配 ===== */
html.light .film-list {
  background: #f5f3ff;
  color: #1e1b4b;
  background-image:
    radial-gradient(ellipse 70% 45% at 50% -10%, rgba(99, 102, 241, 0.1) 0%, transparent 70%),
    radial-gradient(ellipse 50% 35% at 85% 55%, rgba(139, 92, 246, 0.06) 0%, transparent 60%);
}
html.light .header {
  background: rgba(248, 246, 255, 0.88);
  border-bottom-color: rgba(99, 102, 241, 0.2);
  box-shadow: 0 1px 0 rgba(99, 102, 241, 0.1), 0 4px 16px rgba(99, 102, 241, 0.06);
}
html.light .logo-main {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.2));
}
html.light .logo-sub {
  color: #9ca3af;
  -webkit-text-fill-color: #9ca3af;
}
html.light .project-card {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(199, 210, 254, 0.8);
  box-shadow: 0 1px 4px rgba(99, 102, 241, 0.06), 0 2px 12px rgba(0, 0, 0, 0.04);
  backdrop-filter: none;
}
html.light .project-card::before {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, transparent 60%);
}
html.light .project-card:hover {
  border-color: rgba(99, 102, 241, 0.5);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 12px 36px rgba(99, 102, 241, 0.12), 0 0 0 1px rgba(99, 102, 241, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
}
html.light .action-card {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(139, 92, 246, 0.04) 100%);
  border-color: rgba(99, 102, 241, 0.35);
}
html.light .action-card:hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.07) 100%);
  border-color: rgba(99, 102, 241, 0.55);
}
html.light .action-card-title { color: #4f46e5; }
html.light .project-title { color: #1e1b4b; }
html.light .project-desc { color: #4b5563; }
html.light .project-meta { color: #6b7280; }
html.light .example-hint-text { color: #6b7280; }
html.light .library-item {
  background: #faf9ff;
  border-color: #e5e7eb;
}
html.light .library-item-name { color: #1e1b4b; }
html.light .library-item-desc { color: #4b5563; }
html.light .library-empty { color: #6b7280; }
html.light .lib-img-thumb {
  background: #f3f4f6;
  border-color: #e5e7eb;
}
html.light .lib-img-empty { color: #9ca3af; }
html.light .badge-status--draft {
  background: rgba(107, 114, 128, 0.1);
  color: #4b5563;
  border-color: rgba(107, 114, 128, 0.25);
}

/* ===== 图片放大预览 ===== */
.image-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: zoom-out;
}
.image-preview-img {
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 8px;
  object-fit: contain;
}
/* 首页工作台最终主题层 */
.film-list { color:var(--text-primary); background:radial-gradient(circle at 8% -10%,rgba(109,74,232,.16) 0,transparent 30%),radial-gradient(circle at 88% 0,rgba(74,144,245,.12) 0,transparent 28%),var(--bg-page) !important; }
.film-list .home-header { height:68px; padding:0; background:color-mix(in srgb, var(--bg-card) 82%, transparent); border-bottom:1px solid var(--border-color); box-shadow:none; }
.film-list .home-main { max-width:1440px; margin:auto; padding:44px 32px 72px; }
</style>
