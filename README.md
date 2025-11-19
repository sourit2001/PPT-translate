# PPT 翻译网站 - README（需求与开发设想）

## 概览
- 这是一个面向用户的在线 PPT 翻译网站。
- 用户上传 PPTX 文件，系统解析并翻译为目标语言（中英互译），提供页面级预览与在线编辑，最终导出可编辑的 PPTX。
- 免费部署路径：Fly.io（Web+Worker 同应用）+ Supabase（Postgres + Storage）。

## 目标与非目标
- 目标
  - 中英互译（双向）。
  - 保持页面版式，提供并排预览（原图+译文层）。
  - 元素级在线编辑与版本记录。
  - 导出 PPTX。
  - 用户账号系统（邮箱+密码，无验证）。
  - 文件大小限制 20MB。
  - 预留用户专用术语表（Glossary）。
- 非目标（MVP 不包含）
  - PDF 导出（后续可加）。
  - 智能图表/SmartArt 的复杂结构迁移。
  - 图片内文字 OCR（后续可选）。
  - 多人实时协作与评论。

## 用户故事
- 作为注册用户，我可以上传一个≤20MB 的 PPTX，选择中文→英文或英文→中文，得到翻译后的并排预览。
- 我可以逐页查看每个文本元素，在线修改翻译，保存后实时更新。
- 我可以导出包含我修改后的翻译的 PPTX 文件。
- 我可以维护个人术语表，在翻译时优先应用。

## 功能列表
- 上传与文件校验（类型与大小）。
- 解析 PPT 页与元素（文本框、表格单元格、备注）。
- 翻译（Replicate API，批处理与重试）。
- 预览渲染（每页 PNG 背景 + 文本层定位）。
- 在线编辑（元素级、撤销历史、长度/溢出提示）。
- 导出 PPTX（回写译文）。
- 账号体系（邮箱+密码），会话管理与基础限流。
- 项目/任务状态追踪（解析、翻译、渲染、导出）。
- 术语表（提示+后处理替换；MVP 为私有，作用域用户/项目）。

## 技术栈与部署
- 前端/后端（同应用）
  - Next.js（React），服务端渲染 + API 路由。
  - Fly.io 部署（免费层），与 Worker 共用同一容器实例。
- 文档处理与渲染 Worker
  - Python 3.11 + `python-pptx`。
  - LibreOffice headless（生成每页 PNG 预览）。
  - 中文/英文字体（如思源黑体、Noto Sans CJK）。
- 翻译服务
  - Replicate API（模型：NLLB-200 或 Llama 3.1 Instruct，配合“仅翻译”提示）。
- 数据与存储
  - Supabase Postgres（结构化数据、队列替代）。
  - Supabase Storage（对象存储：原文件、预览图、导出文件）。
- 队列策略
  - 不引入 Redis；使用 Postgres 的 LISTEN/NOTIFY + 状态轮询作为队列替代。

## 系统架构（简述）
- Web/API（Next.js）
  - 认证、上传签名、创建/查询项目与任务、编辑提交、导出触发。
- Worker（Python）
  - 监听/轮询任务 → 解析 → 翻译 → 渲染 → 导出 → 写回 DB/Storage。
- 存储
  - Storage 桶（私有）：ppt-original / ppt-previews / ppt-exports。
  - 下载通过签名 URL。
- 通知与任务流
  - Web 端创建/更新 `jobs` 表后 `NOTIFY job_channel`。
  - Worker `LISTEN job_channel` 或按间隔轮询 `pending` 任务。

## 数据模型（核心表）
- users：id，email(unique)，password_hash，created_at
- projects：id，user_id，source_lang，target_lang，status
- slides：id，project_id，index，preview_url，width，height
- elements：id，slide_id，type(text/table_cell/notes)，bbox，style，source_text，translated_text，status
- jobs：id，project_id，type(parse/translate/render/export)，status，progress，error，created_at，updated_at
- edit_history：id，element_id，old_text，new_text，editor_id，timestamp
- glossaries：id，user_id，name，entries(jsonb: term→target，选项：大小写、词形)

## API 设计（摘要）
- POST /api/projects：创建项目（包含语言方向）。
- POST /api/projects/:id/upload：上传 PPTX（≤20MB）。
- GET /api/projects/:id/status：项目与任务状态。
- GET /api/projects/:id/slides：页列表与预览图 URL。
- GET /api/slides/:id/elements：元素列表与源/译文本、bbox。
- PATCH /api/elements/:id：更新译文，记录历史。
- POST /api/projects/:id/translate：触发翻译。
- POST /api/projects/:id/export：触发导出，返回下载链接。
- POST/PUT /api/glossaries：管理用户术语表（MVP：私有）。

## 交互设计（要点）
- 上传页
  - 显示 20MB 限制。
  - 语言方向开关（中→英 / 英→中）。
  - 任务进度条（解析/翻译/渲染）。
- 预览/编辑页
  - 左侧缩略图导航。
  - 中间并排：原图背景 + 文本层（译文侧可编辑）。
  - 右侧面板：文本编辑、术语提示、溢出警告、重译按钮。
- 导出
  - 导出进度提示，完成后提供签名 URL 下载。

## 翻译与术语策略
- 模型：优先 NLLB-200（稳定），备选 Llama-3.1-Instruct（配合提示严格“仅翻译”）。
- 批处理：按元素/段落分块，合并短文本，控制并发与重试。
- 术语：提示中约束 + 翻译后进行词边界/大小写敏感替换。
- 去重：相同文本缓存，减少调用成本。

## 安全与隐私
- 账号：邮箱+密码（无邮件验证），密码加盐哈希（Argon2 或 bcrypt），会话 Cookie（HTTP-only, SameSite=Lax, Secure）。
- 速率限制：登录/注册与任务触发端点做 IP+账号限流。
- RLS：所有数据表按 `user_id` 行级权限隔离；Worker 用 service role 进行内部操作。
- 文件：默认私有存储，下载使用签名 URL；自动清理过期文件。

## 免费层与限制
- Fly.io：单实例与 CPU/带宽受限。Web+Worker 共用，Worker 采用短轮询+退避，避免持续满载。
- Supabase：数据库与存储额度有限；定期清理老项目文件；预览图进行压缩与合理分辨率控制。
- Replicate：控制并发和重试，缓存重复文本。

## 已知局限与后续路线
- 版式保持：对极端排版或超长文本，可能需要手动微调。
- 图表/SmartArt：MVP 不完全支持复杂结构迁移。
- OCR：图片内文字不做识别（可作为后续增量）。
- 后续可加：PDF 导出、团队协作、项目记忆库、术语增强、引入 Redis 提升吞吐。

## 部署方案（免费最简）
- 平台：Fly.io + Supabase（2 平台）
  - Fly.io：单应用双进程（Next.js Web/API + Python Worker + LibreOffice + 字体）。
  - Supabase：Postgres + Storage（3 桶：ppt-original / ppt-previews / ppt-exports）。
- 环境变量（示例项名）
  - DATABASE_URL
  - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY
  - SESSION_SECRET
  - REPLICATE_API_TOKEN
  - TRANSLATION_MODEL
  - MAX_UPLOAD_MB=20
  - ALLOWED_MIME=.pptx
  - BASE_URL

## 开发阶段与里程碑（建议）
- M1：认证、上传（20MB 限制）、项目与任务骨架、解析基础。
- M2：预览渲染（LibreOffice PNG）、并排视图、翻译接入（Replicate）。
- M3：元素级编辑与历史、溢出提示、导出 PPTX。
- M4：成本/配额/速率限制、质量保护、错误重试、清理策略。
- 后续：PDF 导出、OCR、协作与评论、术语增强、引入 Redis 提升吞吐。

## 开发优先级（MVP）
- 高优先：账号体系、上传/解析、翻译集成、预览并排、在线编辑、导出 PPTX。
- 中优先：术语表（私有）、历史记录、长度/溢出提示。
- 低优先：PDF、OCR、团队/协作、复杂图表/SmartArt。

## 验收标准（MVP）
- 上传一个中/英文 PPTX（≤20MB），可完成解析→翻译→渲染→编辑→导出闭环。
- 并排预览与元素可编辑，保存后的导出文件内容与编辑一致。
- 术语表中指定词汇在翻译或后处理生效。
- 非授权用户不能访问他人数据；下载链接仅限签名 URL 有效期内访问。
