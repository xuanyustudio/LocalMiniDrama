# 从小说到短剧

打开 **本地短剧助手 → 项目 → 小说短剧工作台**。Windows 重启后双击 `Start-Studio.bat`。

1. **上传 TXT，选择本集章节。** 支持 UTF-8 和 GBK，文件最大 16 MiB。原文件保存在本机，选择的章节按完整段落改写，最多 48,000 字；过长时明确提示拆分。
2. **填改编要求和人物调整。** 点击「改写本章」。审阅并编辑改写正文，再点「用改写稿生成剧本」。保存为新一集，已有分集继续保留。
3. **做角色、场景、道具和分镜。** 在「本集制作」点「生成分镜」。确认镜序和台词，按需补角色与场景图。
4. **先试一镜。** 工作台只生成一个镜头，该镜缺首帧时一并生成。满意后再补完其余镜头。试拍使用 720p，每镜 4–15 秒。万相视频按无声档生成，角色配音单独处理。
5. **配音和后期。** 以「角色：台词」逐行写在分镜中，在「设置角色音色」选声线。补齐对白配音，再合成整集。剪映素材包带剧本、分镜顺序、SRT 和已下载的媒体；缺失素材在清单中为空。解压后可按镜号导入剪映。

未配置云端账户时，可以用本机 Ollama 试写短片段。用 15 秒目标时长先检查人物、地点和情节，篇幅较长的改写稿可在生成剧本前缩短。超出本地模型能力时，工作台会提示重试或切换文字模型。

## 服务和费用

点击改写、生成剧本、拆分镜、生图、生成视频或配音时，工作台会先列出本步的美元估价、使用的模型和工作量。补图、批量生成视频和试拍都会合并本次涉及的费用。点击取消即可放弃这次生成。上传原稿、保存剧本和用现有素材本机合成不产生模型费用。估价采用公开标价，实际账单会受模型输出量、免费额度、优惠和重试影响。

工作台接入的百炼、BytePlus 和 MiniMax 生成服务会在后端核对费用确认。助手发起生成时，点「查看费用」确认该次工具调用。直接调用本地生成接口的程序也需要完成报价和确认。Windows 启动脚本可使用本机已安装的 Node.js 22 或更新版本。

### 阿里云百炼新加坡区

在「模型与费用」选择「启用百炼新加坡区」。一把按量 API Key 可启用文字、图片、视频和配音。双击 `Set-Production-Keys.bat` 可查看本机设置，百炼对应 `DASHSCOPE_API_KEY=`。启用只切换当前工作台使用的模型。实际生成时按服务商用量计费。

| 工作 | 模型 | 新加坡区参考价格（美元） |
| --- | --- | --- |
| 改写、剧本和分镜 | 通义千问 3.7 Plus，Flash 可在 AI 配置中选用 | Plus 每百万输入 $0.40、输出 $1.60（单次输入不超过 256K） |
| 角色图、场景图和分镜首帧 | 万相 2.7 Image | $0.03/张 |
| 首帧转视频 | 万相 2.6 I2V Flash | 720p 无声 $0.025/秒 |
| 角色对白 | CosyVoice v3 Flash | $0.13/万计费字符，汉字计两个字符 |

现有的 8 秒首镜若需要一张首帧，估计 $0.23。实际以账单为准。[百炼官方定价](https://www.alibabacloud.com/help/en/model-studio/model-pricing)

### BytePlus 与 MiniMax 方案

| 工作 | 所选服务 | 参考价格（美元） |
| --- | --- | --- |
| 解释改编要求、润色和写剧本、拆分镜 | BytePlus ModelArk 亚太，Dola Seed 2.1 Turbo | 每百万未缓存输入 $0.50，每百万输出 $2.50 |
| 角色图、场景图及分镜首帧 | BytePlus Seedream 5.0 Pro | $0.045–0.09/张，第 2 张起的输入参考图 $0.003/张 |
| 参考图转视频 | BytePlus Seedance 2.0 Fast | 720×1280、24 fps、无视频输入约 $0.121/输出秒 |
| 角色配音 | MiniMax 国际版 Speech 2.8 Turbo | $0.06/千字 |
| 合成、字幕和精剪交接 | 本地 FFmpeg 和已有剪映 | 本地合成无按次 API 费 |

定价来源：[BytePlus ModelArk](https://docs.byteplus.com/en/docs/modelark/model-pricing?redirect=1)、[MiniMax](https://platform.minimax.io/subscribe/token-plan?tab=api-enterprise)。模型可用性和收费以账户与账单为准，未计税和重生成用量。BytePlus 服务开放地区包含新西兰，具体模型有账户和激活要求。Seedance 2.0 激活通常需要约 $30 的账户余额或符合条件的资源包。这笔余额和单个镜头的实际耗用是两件事。[地区说明](https://docs.byteplus.com/en/docs/modelark/availability)、[激活说明](https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api?redirect=1)

**低成本首轮。** 先做 1–3 个镜头，合计 5–15 秒。按 3 张图和 15 秒视频算，素材调用约 $2.10，另加少量文字与配音费用。60 秒全视频，生成了 90–120 秒候选、出图约 12 张时，约 $12–16，额外参考图、文字、配音及税费另计。只让关键镜头动起来，会显著减少预算。

同镜对比的其他候选包括 [fal 的 Kling 3.0 Standard](https://fal.ai/models/fal-ai/kling-video/v3/standard/image-to-video) 和 [DeepSeek 文本接口](https://api-docs.deepseek.com/quick_start/pricing/)。

BytePlus 也列出了价格更低的 Seedream 5.0 Flash（$0.018/张）和 Seedance 2.0 Mini（其 720p 询价样例约 $0.08/秒）。首轮使用已有的 Pro 和 Fast 配置，确认一镜中角色参考图和动作效果后，再用同一镜评估哪些镜头可以换成低价模型。[BytePlus 官方定价](https://docs.byteplus.com/en/docs/modelark/model-pricing?redirect=1)

## 开源组件怎么选

- 本地工作台继续使用已有分镜、图片和视频任务；合成复用 FFmpeg，按镜序处理视频、对白和字幕。[FFmpeg 拼接文档](https://ffmpeg.org/faq.html#How-can-I-concatenate-video-files_003f)
- MoneyPrinterTurbo 擅长从主题或关键词写文案、匹配素材和自动剪辑。小说短剧需要先保存人物关系与改编决定，再逐镜复用参考图，因此保留工作台自己的小说与分镜流程。[MoneyPrinterTurbo 项目](https://github.com/harry0703/MoneyPrinterTurbo)
- ComfyUI 的工作流可以作为未来的本地生图接口。首轮以云端生图和视频控制安装成本，暂缓配置本地模型与显卡环境。[ComfyUI 项目](https://github.com/Comfy-Org/ComfyUI)
- Seedance 2.0 Skill OS 适合检查镜头提示词、参考素材和跨镜衔接。实际生成和计费由视频服务商负责，工作台直接接官方接口。[Seedance 2.0 Skill OS](https://github.com/Emily2040/seedance-2.0)

## 开启 BytePlus 或 MiniMax

- 在 [BytePlus ModelArk](https://ai.byteplus.com/ark/region:ap-southeast-1/apikey) 创建亚太区 API Key，按账户要求开通所用模型。需要配音时再在 [MiniMax 国际站](https://platform.minimax.io/) 创建 API Key。
- 双击 `Set-Production-Keys.bat`。在打开的本机文件中填写 `BYTEPLUS_ARK_API_KEY=` 与 `MINIMAX_API_KEY=`。保存后，在工作台的「模型与费用」刷新并启用。若已有旧文件，在末尾添加这两项。
- 启用模型只改本地配置。点生成时，所选章节或提示词、所选参考图或对白才会提交给对应服务；模型运行和生成质量须用自己的账户确认。小说全文留在本地，云端改写按选定的一章逐段提交。
- 首镜通过后再批量制作。角色与场景一致性依赖参考图和模型输出。Seedance 真人肖像有其官方限制，建议先用合成的素材试镜。[肖像参考说明](https://docs.byteplus.com/en/docs/modelark/seedance-portrait-asset-guide)
