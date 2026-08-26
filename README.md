# 医药代表工作助手 (rep-workbench)

为医药代表设计的模块化工作台：客户资料管理（含文件附件）、关键事宜提醒（万年历）、问卷调研台账。
支持电脑端与手机端**实时数据同步**（通过集中式后端），敏感信息（身份证号 / 银行卡）加密存储并默认脱敏显示。

## 功能

- **客户资料管理** — KOL 客户信息 CRUD（医院、姓名、身份证、银行卡、手机号，含格式校验与身份证校验码验证）；按姓名 / 手机号模糊搜索；每条记录附两个独立附件区：
  - **个人简介**（个人简历、学术资料、合影等）
  - **身份信息**（身份证、执业证、银行卡截图等）
  - 支持 JPG / PNG / Word (.doc/.docx) / Excel (.xls/.xlsx) / PDF 的上传、下载、图片预览、打开与删除。
- **关键事宜提醒** — 内嵌万年历（月视图，翻页 / 跳转今天），有事务的日期以圆点 + 角标显示，点击日期可新建 / 查看 / 编辑事务（含标题、详细描述、提醒时间）。
- **问卷调研台账** — 记录调研日期、对象、完成次数、状态、备注；支持按日期区间、完成状态、对象姓名模糊筛选。
- **扩展入口** — 侧边栏「添加新板块」为虚线占位，样式与正式板块统一，便于后续接入新模块。
- **数据备份 / 还原** — 设置页可一键导出全部数据 JSON（含加密字段），也可导入恢复。

## 界面与响应式

- 桌面端：左侧固定导航栏 + 右侧内容区。
- 移动端：顶部栏 + 底部标签栏 + 卡片式布局，触控操作友好。
- 同一 URL 在电脑 / 手机浏览器自适应。

## 本地运行

```bash
cd rep-workbench
npm install
node server.js
```

启动后访问 **http://localhost:3000**。

### 手机同步访问（同 WiFi，默认即可用）

架构上只有**一个后端数据库**：电脑和手机连同一个 WiFi / 局域网时，手机浏览器打开 `http://<电脑的局域网 IP>:3000`，就能和电脑访问 `http://localhost:3000` 看到**完全相同、实时同步**的数据。任一方新增 / 修改，另一方刷新即见。

**桌面已放好 4 个一键工具**（双击即用）：
- `启动工作台.bat` — 启动后端 + 自动打开电脑浏览器
- `关闭工作台.bat` — 关闭后台服务
- `手机访问地址.bat` — 双击会显示手机当前该打开的地址（`http://<局域网IP>:3000`，IP 变了也能动态算对）
- `医药代表工作台.url` — 直接打开电脑端页面

查看电脑局域网 IP（也可直接双击 `手机访问地址.bat`）：
- Windows: `ipconfig`（找 IPv4 Address，通常 192.168.x.x）
- macOS: 系统设置 → Wi-Fi → 详细信息

> 注意：电脑的 Windows 防火墙需允许 3000 端口入站。**首次用手机访问时，电脑会弹出"Windows 防火墙"提示，点【允许访问】即可**；若当时点了取消，后续手机连不上，重跑一次 `启动工作台.bat` 或手动放行端口 3000 即可。

## 数据安全

- **敏感字段加密**：身份证号、银行卡号使用 AES-256-GCM 加密后存入 `data/db.json`，密钥保存在 `data/.key`（权限 0600）。列表中默认显示脱敏值（如 `138****8000`、`**** **** **** 0123`），需手动点「显示敏感信息」才返回明文。
- **本地持久化**：所有数据保存在 `data/` 目录，刷新 / 重启不丢失。
- **数据备份**：设置页 → 「导出备份」下载完整 JSON；「导入备份」可恢复（会覆盖当前数据）。

## 部署到 Render（公网长期链接 + 跨设备同步）

如需在手机蜂窝网络下也能访问（不仅是同 WiFi），可将本应用一键部署到 Render 获得公网 HTTPS 链接。

### 步骤

1. 将本目录推送到你自己的 GitHub 仓库：
   ```bash
   cd rep-workbench
   git init && git add . && git commit -m "init"
   # 在 GitHub 新建一个空仓库，然后：
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git branch -M main
   git push -u origin main
   ```
2. 打开 https://render.com → New → **Blueprint** → 连接你的 GitHub 仓库，Render 会自动识别 `render.yaml` 并部署。
3. 部署完成后，Render 会给你一个 `https://xxx.onrender.com` 的公网链接，**电脑和手机（任何网络）打开同一个链接，数据自动同步**。

> Render 免费版实例在 15 分钟无访问后会休眠，下次访问约需 30 秒冷启动；链接本身长期有效。要常驻可升级到付费 plan。

## 目录结构

```
rep-workbench/
├── server.js                # Express 入口
├── package.json
├── render.yaml              # Render 部署配置（Blueprint）
├── src/
│   ├── db.js                # JSON 文件持久化（原子写 + 写锁）
│   ├── crypto.js            # AES-256-GCM 加密 / 脱敏
│   └── routes/
│       ├── customers.js     # 客户 + 附件 API
│       ├── events.js        # 日历事务 API
│       ├── surveys.js       # 调研台账 API
│       └── files.js         # 附件下载 / 预览
├── public/                  # 前端（响应式 SPA）
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── common.js        # toast / modal / 校验
│       ├── api.js           # API 封装
│       ├── customers.js     # 客户模块
│       ├── calendar.js      # 日历模块
│       ├── survey.js        # 台账模块
│       ├── settings.js      # 备份 / 还原
│       └── app.js           # 导航 / 路由
└── data/                    # 运行期生成
    ├── .key                 # 加密密钥（不要提交到 Git）
    ├── db.json              # 所有数据
    └── uploads/             # 附件文件
```

## API 概览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/customers?q=` | 客户列表（脱敏）/ 模糊搜索 |
| POST | `/api/customers` | 新建客户（校验手机 / 身份证校验码 / 银行卡） |
| GET | `/api/customers/:id` | 获取客户（明文，用于编辑） |
| PUT | `/api/customers/:id` | 更新客户 |
| DELETE | `/api/customers/:id` | 删除客户及其全部附件 |
| POST | `/api/customers/:id/attachments?section=profile\|identity` | 上传附件（multipart, field `file`） |
| DELETE | `/api/attachments/:fileId` | 删除附件 |
| GET | `/api/files/:fileId[?download=1]` | 预览 / 下载附件 |
| GET / POST / PUT / DELETE | `/api/events` | 日历事务 |
| GET / POST / PUT / DELETE | `/api/surveys` | 调研台账（GET 支持 `start/end/status/q` 过滤） |
| GET / POST | `/api/backup` | 导出 / 导入全量备份 |
| GET | `/api/stats` | 头部统计 |

## 由「不一书个人工作台生成器」生成
