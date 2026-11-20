# 图库补充素材来源调研

核验日期为 2026-11-20。按 GitHub 上可追溯的项目、实际发布的资产和公开图库的使用条件筛选。首批建议试接 Shisei 线稿/法线与额外服装、The Met 公版馆藏服装，以及 CharacterCreator 自渲染的虚构成人头像。需要更写实的头像时可抽查 SFHQ-T2I。［[项目现有素材说明](../README.md)］

## 最接近现有工作台的项目

- **opensegra/ai-library** 有可浏览的姿势、服装和合成台。README 列有 288 个姿势、1,439 张多角度姿势图和 1,407 套服装，库存规模与本库的ギア姿势、写实服装高度吻合，扩容前应按来源与图片去重。最值得借鉴的是可调节相机的 3D 人台、用户自定义姿势和 GLB、BVH、深度 PNG 导出。其 MIT 声明覆盖源码，CC0 声明覆盖指定基础人台。图库图片的再发布许可需要另查。［[项目 README](https://github.com/opensegra/ai-library#readme) · [基础人台许可](https://github.com/opensegra/ai-library/blob/main/public/assets/base-female-LICENSE.txt)］

## 姿势

- **Shisei** 是接入成本最低的图像来源。本库已经导入其中国历代服装，但没有导入姿势。固定版本 README 列有 280 个姿势，线稿/照片合集有 1,301 张，深度和法线也各有独立包。固定版本 NOTICE 声明项目原创图片为 CC0，姿势选目、原始编号、名称和分类沿用ギア，不受该声明覆盖。建议在已有姿势卡上加独立的 Shisei 线稿/法线视图，先人工核对 `orig_id`、实际构图与安全分级。优先抽查常规全身和上半身，同一姿势的另一种参考图不计作新增动作。［[固定版本 README](https://github.com/wquguru/shisei/tree/8f61ceab10e45f8d3afd254900903733a0ba76ee#readme) · [素材声明](../data/shisei/NOTICE) · [本库接入说明](SHISEI-COSTUMES.md)］
- **CMU Motion Capture Database** 是动作增量来源。CMU 官网 FAQ 允许复制、修改、再分发动作捕捉数据。它提供运动序列，要将精选帧重定向到许可明确的人台并渲染成现有的白模和深度图。可以先选体育、舞蹈、行走、跳跃等动作，记录序列号、帧号和渲染相机。［[CMU 数据目录](https://mocap.cs.cmu.edu/) · [CMU 使用条款](https://mocap.cs.cmu.edu/faqs.php) · [可选 CC0 人台](https://github.com/opensegra/ai-library/blob/main/public/assets/base-female-LICENSE.txt)］

## 服装

现有 3,224 套包含ギア写实 1,407、ギア动漫 1,320、CharaDB 440 和 Shisei 中国历代 57 套。ギア动漫和 CharaDB 采用原站图链接，Shisei 的 57 套 CC0 AI 参考已按服装组织了 227 个视角。优先补充可自托管的实物服装照片，以及能统一人台、背景和视角的自渲染服装。［[项目 README](../README.md) · [ギア动漫接入说明](GIA-ANIME-COSTUMES.md) · [Shisei 接入说明](SHISEI-COSTUMES.md)］

### Shisei 其他服装分类｜沿用现有多视角接入

- 本地固定快照的原始目录中有 434 条非中国历代服装候选。可优先检查 `FN` 骑士板甲等幻想服饰、`WH` 世界历代服装、`WK` 职业服装和 `WE` 和服等世界传统服装。与现有图库按款式去重，并核对上游质检和图片是否实际存在，候选数不代表可发布数。沿用 `shisei-` ID、正面/斜侧/侧面/背面视角和来源标识，保留原始安全分级。［[本地原始目录](../data/shisei/costumes.json) · [固定版本质检](https://github.com/wquguru/shisei/blob/8f61ceab10e45f8d3afd254900903733a0ba76ee/data/costume-qc.json) · [原版授权声明](../data/shisei/NOTICE)］

### The Met Open Access｜实物服装照片

- **数据和图片分别核验。** `metmuseum/openaccess` 发布 CC0 1.0 馆藏元数据 CSV，覆盖范围也包括仍受版权保护的馆藏。CSV 本身不含图片。图片使用馆方 Open Access 的逐件公版标记。馆方 README 明确指出覆盖对象会在藏品页显示 CC0 图标，并建议保留来源、注明翻译和数据修改。可将通过核验的开放图片保存为本地缩略图和参考图。［[馆方 GitHub README](https://github.com/metmuseum/openaccess#images-not-included) · [数据 CC0 原文](https://github.com/metmuseum/openaccess/blob/master/LICENSE) · [馆方图像政策](https://www.metmuseum.org/about-the-met/policies-and-documents/image-resources)］
- **样本已查官方对象 JSON。** `106571` 是 1898–1900 年的丝、棉晚礼服，藏品号 `1976.258.4a, b`，有 1 张主图及 5 条附图记录。`68510` 是亚洲艺术部的丝织金属线朝服，官方英文名为 *Imperial Court Robe*，藏品号 `30.75.6`，有主图、无附图。两条均返回 `isPublicDomain: true`、非空 `primaryImage` 和 `primaryImageSmall`。附图的角度和内容需看图后标注。朝服样本的 `objectDate` 为空，导入时保留未知值。［[晚礼服馆藏页](https://www.metmuseum.org/art/collection/search/106571) · [晚礼服 JSON](https://collectionapi.metmuseum.org/public/collection/v1/objects/106571) · [朝服馆藏页](https://www.metmuseum.org/art/collection/search/68510) · [朝服 JSON](https://collectionapi.metmuseum.org/public/collection/v1/objects/68510)］
- **卡片落地。** 建议先选 20–30 件，优先完整可见、轮廓清晰的晚礼服、外套和袍服。馆方部门列表中 `8` 是服装学院，`6` 是亚洲艺术部，后者可补充 Shisei 的中国历史服装实物参照。将搜索结果作为候选，逐件核对 `isPublicDomain === true`、可用主图和馆方权利标记。实际访问时旧 `/v1/search` 返回 HTTP 410，同类查询走 `/v1.1/search` 成功，单件详情仍可读 `/v1/objects/{id}`。［[部门 API](https://collectionapi.metmuseum.org/public/collection/v1/departments) · [已测试的新版礼服搜索](https://collectionapi.metmuseum.org/public/collection/v1.1/search?departmentId=8&isPublicDomain=true&hasImages=true&title=true&q=evening%20dress&limit=5)］
- **字段建议。** 用 `met-106571` 一类稳定 ID 和「现实 / 馆藏服饰」分类。中文名注明为本项目译名，标签优先使用确有记录的类别、年代、材质和产地。`objectURL` 留作来源，另存 `accessionNumber`、权利标记及核验日期。主图用作默认参考，附图只在确认是同一件衣物的相应角度后写入 `views`，局部细节可另标。保留「馆藏实物」标识，供用户区分 Shisei 的 AI 历史服装参考。［[本项目服装卡与视角字段](../src/types/gallery.ts) · [馆方对象 JSON 样本](https://collectionapi.metmuseum.org/public/collection/v1/objects/106571)］

### MakeHuman｜可自渲染，适合统一多视角

- **程序和资产采用不同许可。** 官方 `LICENSE.md` 将程序代码和界面图标等列为 AGPL-3.0-or-later，将随发行版捆绑的基模、服装（MHCLO）和纹理等列为 CC0 1.0。官方明确对使用这些内置资产得到的导出模型、渲染图和截图不主张权利。只把渲染图接入图库即可。社区服装、纹理和外部配件按各自的许可证审核。［[官方 GitHub 许可说明](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md) · [资产 CC0 原文](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.ASSETS.md)］
- **卡片落地。** 先按发行版的实际捆绑清单选基础服装及可组合的款式，用固定人台、背景、光照和构图渲染正面、斜侧、侧面和背面，供换装参考和 ComfyUI 选图使用。每套一张卡并标注「3D 渲染」，记录软件版本、用到的服装和纹理，以及渲染配置。源码 README 指向资产下载脚本，该脚本引用的 `makehuman-assets` 仓库在本次公开 API 核验中返回 404。可从官方发行版入口先核对实际捆绑清单，款式数量和渲染效果仍待验证。［[官方 README](https://github.com/makehumancommunity/makehuman#readme) · [官方资产脚本](https://github.com/makehumancommunity/makehuman/blob/master/makehuman/download_assets_git.py) · [官方发行版](https://github.com/makehumancommunity/makehuman/releases)］

### DeepFashion 系列｜研究与标注参考，排除出公开服装卡

- **DeepFashion。** 港中文 MMLab 的官方协议限定非商业研究用途，说明图像来自互联网且并非实验室所有，并禁止进一步复制、发表或分发数据集；协议列有同一组织单一站点内部使用的有限例外。适合阅读类别和属性设计。服装卡原图、裁剪图、缩略图或发布包均不应采用这套图像。［[MMLab 官方项目页与 Agreement](https://mmlab.ie.cuhk.edu.hk/projects/DeepFashion.html)］
- **DeepFashion2。** 官方 GitHub README 的 13 类服装、视角、轮廓掩码和遮挡标注可作为标签或质量筛选的设计参考。照片来自商店和消费者，数据包需填表取得解压密码。公开 README 未给出照片再发布授权，本次也未能读取表单条款。将其留在研究候选，避免把第一代协议或仓库里的评测代码当作第二代照片的许可。［[官方仓库、取数流程与标注说明](https://github.com/switchablenorms/DeepFashion2#download-the-data)］

## 人脸与人像

- **CharacterCreator** 可用同一个虚构角色生成正脸、斜侧和侧脸。仓库有基于 MakeHuman 的 3D 角色、可调脸部参数、头发 GLB 和服装 GLB。项目代码为 GPL-3.0-or-later，官方许可说明对完全采用 CC0 或项目原创来源制作的 GLB 等输出采用 CC0。先选资产清单标明为 CC0 的项目，自渲染一批虚构成人角色，按发型、视角和表情组织，在卡片上标注「3D 渲染」。［[项目 README](https://github.com/kblood/CharacterCreator#readme) · [输出与上游资产许可](https://github.com/kblood/CharacterCreator/blob/master/LICENSE-NOTES.md)］
- **SFHQ-T2I** 是可直接筛图的写实合成人脸候选。发布方列有 122,726 张 1024×1024 合成图，覆盖发型、姿态、表情与光照，Kaggle 数据页标为 MIT。数据混合多个模型输出，而且每张脸首先应当按独立人物处理。建议先结合发布包和生成模型条款核验小样，再挑虚构成人、统一裁切，检查是否有明显伪影和近重复。需要严格同脸多角度时优先使用自渲染方案。［[发布方 GitHub](https://github.com/SelfishGene/SFHQ-T2I-dataset#readme) · [发布方 Kaggle 数据页](https://www.kaggle.com/datasets/selfishgene/sfhq-t2i-synthetic-faces-from-text-2-image-models)］
- **FFHQ 和 Face Synthetics** 可供研究参考。FFHQ 从 Flickr 收录约 7 万张真人脸，单图有各自的许可、署名及可能涉及的肖像授权，NVIDIA 的数据集编排采用 CC BY-NC-SA 4.0。微软 Face Synthetics 明确限定非商业研究用途。公开图库优先采用有明确素材授权的合成图或自渲染图。［[FFHQ 官方许可](https://github.com/NVlabs/ffhq-dataset#licenses) · [Face Synthetics 官方许可](https://github.com/microsoft/FaceSynthetics/blob/main/LICENSE.txt)］

## 首批接入建议

1. 姿势选 20 个已有条目，匹配 Shisei 线稿或法线，检查原姿势 ID 与视图切换。新增动作单独用 CMU 精选帧试渲染。
2. 服装选 20–30 件 The Met 公版实物或 Shisei 非中国历代款式，验证来源标签、主图和可选视角。
3. 人像先做 24–30 位虚构成人角色，每人保留 2–3 个固定视角，对比 Web 合成台与 ComfyUI 中的可用性。

每份入库清单记录来源链接、固定版本或馆藏编号、素材级许可、原始 ID 和实际视图。上述数量是试接规模，本文仅整理候选来源。
