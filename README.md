# 活动报名微信小程序

一个面向【参与人群】的活动报名小程序，包含活动首页、活动详情、在线报名、报名记录四个页面，支持微信授权登录；活动与报名数据存于云端数据库，活动封面图存于云端存储。

仓库：<https://github.com/cvcingcvc-code/2>

## 功能

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 活动首页 | `pages/index/index` | 活动卡片列表、加载/空态/错误态、下拉刷新、登录入口 |
| 活动详情 | `pages/detail/detail` | 时间地点、参与人群、名额、活动介绍、报名须知、设置封面 |
| 在线报名 | `pages/signup/signup` | 登录门控、姓名/手机号/人数/备注校验、重复报名拦截、成功回执 |
| 报名记录 | `pages/records/records` | 统计、本人报名明细、取消报名、退出登录 |

底部 tabBar：活动首页、报名记录。全项目使用统一线性风格本地图标，不使用 Emoji，不使用第三方 UI 框架。

## 技术栈

- 原生微信小程序（WXML / WXSS / JS），基础模板 `workbuddy-native-basic@1.0.0`
- `@tencent-ai/workbuddy-cloud-sdk@dev`，通过 `/miniprogram` 子路径初始化
- WorkBuddy 云服务：Auth（微信登录）、Database（PostgreSQL / PostgREST）、Storage（对象存储）
- 云数据库与云存储由 WorkBuddy 托管，数据不包含在本仓库中

## 目录结构

```text
app.js / app.json / app.wxss     应用入口、页面与 tabBar 配置、全局样式
pages/index|detail|signup|records 四个业务页面
components/wx-login/             微信授权登录组件
utils/cloud.js                  云客户端唯一初始化点（publicConfig）
utils/api.js                    业务数据访问层
utils/format.js                 日期与文本格式化
utils/workbuddy-data-access.js  云端单表 CRUD 封装
utils/workbuddy-cloud-diagnostics.js  云请求失败诊断
assets/icons/                   线性图标 PNG
tools/generate_icons.py         图标生成脚本（纯 Python 标准库）
```

## 云端数据结构

| 表 | 用途 | 权限 |
| --- | --- | --- |
| `activities` | 活动目录（标题、人群、简介、介绍、时间、地点、名额、标签、排序、状态） | 公开读；客户端不可写，由管理端维护 |
| `registrations` | 报名记录（`owner_id`、活动、姓名、手机、人数、备注、状态） | RLS：仅本人可读写；部分唯一索引防止同一用户对同一活动重复有效报名 |
| `activity_images` | 活动封面在云存储中的对象路径 | 登录用户可读；仅上传者本人可写/删 |

三张表均开启 RLS。`owner_id TEXT DEFAULT auth.uid()` 由数据库自动填充，客户端不传；写入策略 `WITH CHECK (owner_id = auth.uid())` 防止伪造身份。

## 配置

- `utils/cloud.js` 中的 `publicConfig.endpoint` 与 `publishableKey` 来自云服务开通结果，是可下发的公开值，不含任何长期密钥；不要改成硬编码的其他域名或环境变量来源。
- 安装依赖：`npm install`（`package.json` 使用 `dev` 通道，`package-lock.json` 已忽略，避免冻结 SDK 修复版本）。
- `project.config.json` 的 `appid` 当前为 `touristappid`，仅用于 WorkBuddy 内预览；用微信开发者工具打开需换成真实 appid。

## 替换活动名称与参与人群

需求里的【活动名称】【参与人群】是模板占位符，当前以示例值落地：

- 主活动：`城市青年阅读沙龙`，人群 `18-35 岁城市青年`（另附两场同期活动，共 3 条示例数据）。
- 活动标题、人群、时间、地点、名额、介绍：改云端 `activities` 表对应行即可，四个页面会自动读取。
- 首页副标题硬编码在 `pages/index/index.wxml` 的 `hero-subtitle`。
- 报名须知硬编码在 `pages/detail/detail.wxml` 的 `notice-card`。

## 活动图片

详情页右上角「设置封面」（需登录）：从相册选图 → 读取为 ArrayBuffer → 上传到云存储 `shared/<uid>/activity-covers/` → 对象路径写入 `activity_images` → 通过 600 秒签名 URL 展示。

- 支持 png / jpg / jpeg / webp，单张不超过 5 MB。
- 未登录或未上传时显示渐变占位封面，不使用本地图片冒充云端图片。
- 签名 URL 的域名需要在小程序后台配置为 `downloadFile` 合法域名。

## 运行与发布

1. `npm install` 后由 WorkBuddy 发布流程自动完成小程序 npm 构建，不需要手工「构建 npm」或复制 `miniprogram_npm`。
2. 在 WorkBuddy 中点击应用卡预览；应用当前状态为**未发布**。
3. 需要发布时，在预览面板右上角点击「分享 / Share」，完成试用或绑定、上传、提交审核、正式发布；全程不需要从微信开发者工具手工上传。
4. 真机前置条件：应用管理中开启微信登录开关并完成小程序绑定；`request` / `uploadFile` / `downloadFile` 合法域名包含云服务网关与签名 URL 域名；正式发布时按流程填写用户隐私保护指引。

## 已验证与未覆盖

- 已验证：严格 JSON、页面与 tabBar / 组件 / 图标引用、WXML 语法约束、JS 语法、云客户端初始化参数；建表 / RLS / 种子数据回读；报名表写入读回探针（已清理）。
- 未覆盖：真实 `wx.login` 会话、云存储上传与签名 URL 加载，这些必须在微信客户端或体验版中复核；H5 预览拿不到真实微信登录 code。

## 图标

`python tools/generate_icons.py` 可重新生成 `assets/icons/` 下全部图标（4 倍超采样抗锯齿，RGBA PNG，无外部依赖）。
