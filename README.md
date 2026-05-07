# Robot Charging Station Mini Program

> 微信小程序 · 机器人远程管理与实时遥控平台
> uni-app (Vue 3) + uniCloud Serverless + IoT Gateway (MQTT / WebSocket)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![uni-app](https://img.shields.io/badge/uni--app-Vue%203-42b883.svg)](https://uniapp.dcloud.net.cn/)
[![uniCloud](https://img.shields.io/badge/uniCloud-Aliyun-orange.svg)](https://uniapp.dcloud.net.cn/uniCloud/)
[![MQTT](https://img.shields.io/badge/IoT-MQTT%20%2F%20WebSocket-blue.svg)](#-architecture)
[![Platform](https://img.shields.io/badge/Platform-WeChat%20Mini%20Program-brightgreen.svg)](#)
[![Status](https://img.shields.io/badge/Status-Reference%20Implementation-blue.svg)](#)

端到端的机器人车队管理小程序：覆盖 **实时遥测 → 远程遥控 → 故障管理 → 用户绑定** 全链路，前端 / 云函数 / IoT 网关 之间通过统一鉴权通道串联。代码以 MIT License 开源，使用前请替换所有占位密钥。

> 🌏 **English version below** — scroll down to the [English README](#english-version).

---

## 📑 Table of Contents

- [Features](#-features)
- [Tech Highlights](#-tech-highlights)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Database](#-database)
- [Security](#-security)
- [Quick Start](#-quick-start)
- [License](#-license)
- [Disclaimer](#️-disclaimer)

---

## ✨ Features

| 模块 | 描述 |
|---|---|
| **机器人监控** | 列表 + 详情，电量 / 在线状态 / 坐标 / 任务态实时显示，15s 心跳窗口判定在线 |
| **远程遥控** | D-pad 长按持续控制 + 圆形摇杆 + 旋转按钮 + Goto 点位收藏，速度向量协议 `{vx, vy, wz, enable}`，200ms 间隔（5Hz）连续发送，enable 作 deadman 开关 |
| **实时遥测** | WebSocket 优先，断线自动降级 HTTP 轮询，UI 显示三态连接指示（live / polling / idle） |
| **故障管理** | 故障记录列表 + 严重等级 |
| **机器人绑定** | 手动输入 / 扫码（支持 `robot-bind:CODE` / JSON / URL 三种格式），排他绑定 |
| **用户体系** | uni-id 鉴权 + 路由守卫 + 邮箱注册找回密码，统一中文错误提示 |

---

## 🛠 Tech Highlights

- **零依赖状态管理**：Vue 3 reactive 对象 + localStorage，避免 Vuex/Pinia 重量级开销
- **Stale-while-revalidate 缓存**：列表 + 详情 5 分钟 TTL + 20 条上限 + 3s 节流 + JSON diff 检测，进入页面先渲染缓存再后台刷新
- **WebSocket 三态指示**：live / polling / idle，UI 直接绑定响应式 `wsState.mode`，连接异常时无感切换 HTTP 轮询
- **Deadman 速度向量协议**：`{vx, vy, wz, enable}`，200ms 间隔连续发送，IoT 端 1s 超时急停，断包即停车
- **uniCloud 单通道鉴权**：所有 API 走 `userService` 云对象，`_before` 钩子统一校验，前端永远不传 uid
- **WebSocket HMAC 动态令牌**：`uid:expiresAt:hmac` 签发，1 小时有效，避免小程序包反编译即拿到长期 token

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (uni-app Vue 3, mp-weixin)                    │
│                                                          │
│  pages/*.vue ──► userService.* (uniCloud Object)        │
│       │                                                  │
│       └─► ws-client.js ──┐                              │
└──────────────────────────┼──────────────────────────────┘
                           │ WebSocket (HMAC token)
                           ▼
┌─────────────────────────────────────────────────────────┐
│  IoT Gateway (Flask + flask-sock + paho-mqtt)           │
│                                                          │
│  ├─ POST /sendCommand  ──► MQTT publish ──► Robot       │
│  ├─ MQTT subscribe    ──► dedupe ──► uniCloud ingest   │
│  └─ WebSocket /ws     ──► realtime broadcast → 前端     │
└─────────────────────────────────────────────────────────┘
                           ▲
                           │ MQTT
                           │
                       ┌───┴────┐
                       │ Robot  │
                       └────────┘
```

**单后端通道**：所有前端调用统一走 `uniCloud.importObject('userService')`，`_before` 钩子统一鉴权，`uid` 永远从 server-side token 派生，不信任前端参数。

**IoT Gateway 不在本仓库**（位于另一个独立 repo），需自行部署。

---

## 📁 Project Structure

```
├── pages/
│   ├── login/              # 登录页（充电小伙伴动画角色）
│   ├── robots/
│   │   ├── index.vue       # 机器人列表（骨架屏 + 缓存 + WS 状态指示）
│   │   └── detail.vue      # 详情 + 遥控（D-pad / 摇杆 / 旋转 / Goto）
│   ├── my/                 # 我的 tab
│   ├── profile/            # 资料编辑
│   ├── settings/           # 设置 + 安全隐私 + 帮助 + 关于
│   └── agreements/         # 服务协议 / 隐私政策本地页面
├── components/
│   ├── BindRobotSheet.vue  # 绑定底部弹窗（手动 + 扫码）
│   └── login-animation/    # 登录页动画角色
├── utils/
│   ├── auth.js             # token 管理 + 路由守卫
│   ├── ws-client.js        # WebSocket 客户端（重连 / 心跳 / 降级轮询）
│   ├── robot-store.js      # 列表 + 详情缓存（stale-while-revalidate）
│   ├── profile-store.js    # 用户资料 reactive 状态
│   └── robotBind.js        # 扫码 / 绑定 payload 解析
├── uniCloud-aliyun/
│   ├── cloudfunctions/userService/    # 唯一鉴权云对象
│   └── database/                       # Schema + 初始化数据
└── simulator/              # 本地遥测模拟器（Node.js）
```

---

## 🗄 Database

| Collection | 索引 | 说明 |
|---|---|---|
| `robots` | `robotCode` (unique) | 机器人基础信息 |
| `telemetry_latest` | `robotCode` (unique) | 每台机器人最新遥测 |
| `faults` | `robotCode` + `ts` | 故障记录 |
| `commands` | `robotCode` + `type` + `ts` | 控制指令历史 |
| `robot_bindings` | `uid` + `robotCode` | 用户-机器人绑定 |
| `uni-id-users` | 系统内置 | 账号信息 |

所有 schema 的 `read / create / update / delete` 权限均为 `false`，仅云函数可访问。

---

## 🔐 Security

- **Token-based 鉴权**：`userService._before()` 自动校验 token → uid，每个方法无需重复鉴权代码
- **数据隔离**：用户只能访问自己绑定的机器人
- **白名单校验**：`sendCommand` 命令类型白名单（move / stop / goto）
- **WebSocket 鉴权**：HMAC-SHA256 动态令牌（`uid:expiresAt:hmac`），1 小时有效，绕开"小程序包反编译即拿到 token"的风险
- **数据库 schema 权限收紧**：直接客户端访问全关闭

---

## 🚀 Quick Start

### 1. 前置要求

- HBuilderX（最新版本，支持 Vue 3）
- 微信开发者工具
- uniCloud 账号 + 阿里云 serverless 空间
- 自行部署 IoT Gateway（可选，仅在需要真实机器人接入时）

### 2. 克隆仓库

```bash
git clone https://github.com/Dragolone/robot-charging-station-miniprogram.git
```

用 HBuilderX 「文件 → 导入 → 从本地目录导入」打开。

### 3. 配置密钥（必填）

⚠️ **以下 4 个文件含 `REPLACE_WITH_*` 占位符，必须替换为你自己的值才能运行：**

#### 3.1 `manifest.json`

```jsonc
{
  "appid": "__UNI__YOUR_UNI_APP_ID",          // 改为你的 DCloud 应用 ID
  "mp-weixin": {
    "appid": "wxYOUR_WECHAT_APPID"            // 改为你的微信小程序 AppID
  }
}
```

#### 3.2 `uni_modules/uni-config-center/uniCloud/cloudfunctions/common/uni-config-center/uni-id/config.json`

```jsonc
{
  "tokenSecret": "REPLACE_WITH_LONG_RANDOM_STRING_32PLUS",          // JWT 签名密钥（32+ 随机字符）
  "requestAuthSecret": "REPLACE_WITH_ANOTHER_LONG_RANDOM_STRING_32PLUS"
}
```

生成方法：`node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"`

#### 3.3 `uni_modules/uni-config-center/uniCloud/cloudfunctions/common/uni-config-center/telemetry/config.json` 与 `uniCloud-aliyun/uni-config-center/config.json`

```jsonc
{
  "telemetry": {
    "ingestToken": "REPLACE_WITH_INGEST_TOKEN",                    // 与 Gateway .env 一致
    "commandBridge": {
      "url": "https://your-gateway.example.com/sendCommand",       // 你的 Gateway 地址
      "token": "REPLACE_WITH_BRIDGE_TOKEN"
    },
    "ws": {
      "url": "wss://your-gateway.example.com/ws",
      "secret": "REPLACE_WITH_WS_HMAC_SECRET"                       // WS HMAC 密钥
    }
  }
}
```

#### 3.4 `simulator/config.json`（可选 - 仅在用本地模拟器时）

```jsonc
{
  "spaceId": "REPLACE_WITH_YOUR_UNICLOUD_SPACE_ID",
  "clientSecret": "REPLACE_WITH_YOUR_UNICLOUD_CLIENT_SECRET"
}
```

### 4. 部署后端

- HBuilderX 右键 `uniCloud-aliyun/database/` → 上传 DB Schema + 初始化数据
- 右键 `userService` 云对象 → 上传部署
- 右键 `uni-id-co` 云函数（位于 `uni_modules/uni-id-pages/uniCloud/cloudfunctions/uni-id-co/`）→ 上传部署
- uniCloud 控制台 → uni-config-center → 上传 `telemetry` 和 `uni-id` 配置

### 5. 微信公众平台后台

服务器域名白名单加上：

| 类型 | 域名 |
|---|---|
| request | `api.next.bspapp.com`、`api.bspapp.com` |
| socket | 你的 Gateway 域名 |
| uploadFile / downloadFile | uniCloud CDN 域名 |

> **提审前务必关闭"不校验合法域名"开关本地复测一次**，开发工具勾选此项会绕过审核期校验。

### 6. 运行

HBuilderX → 运行 → 微信开发者工具（mp-weixin）

---

## 📜 License

[MIT License](LICENSE) — Copyright (c) 2026 Dragolone

---

## ⚠️ Disclaimer

本项目为开源参考实现，**不构成任何商业服务承诺**。第三方品牌（微信、uni-app、uniCloud 等）名称及商标归原所有方所有。代码可在 MIT License 范围内自由使用，但部署到生产环境前请务必：

1. 替换所有 `REPLACE_WITH_*` 占位符为强随机值
2. 不要公开任何真实密钥到 git 历史
3. 自行评估安全性，作者不为任何因使用本代码导致的损失负责

---

<a id="english-version"></a>

# English Version

> WeChat Mini Program · Robot remote management & real-time teleoperation platform
> uni-app (Vue 3) + uniCloud Serverless + IoT Gateway (MQTT / WebSocket)

An end-to-end robot fleet management mini program covering the full **realtime telemetry → remote teleoperation → fault management → user binding** loop. Frontend, cloud functions, and the IoT gateway are wired together through a single auth-enforced channel. Open-sourced under the MIT License — replace all placeholder secrets before use.

---

## 📑 Table of Contents

- [Features](#-features-1)
- [Tech Highlights](#-tech-highlights-1)
- [Architecture](#-architecture-1)
- [Project Structure](#-project-structure-1)
- [Database](#-database-1)
- [Security](#-security-1)
- [Quick Start](#-quick-start-1)
- [License](#-license-1)
- [Disclaimer](#️-disclaimer-1)

---

## ✨ Features

| Module | Description |
|---|---|
| **Robot Monitoring** | List + detail views with real-time battery / online status / coordinates / task state. Online status determined by a 15s heartbeat window. |
| **Remote Control** | D-pad press-and-hold continuous control + circular joystick + rotation buttons + Goto waypoint favorites. Velocity-vector protocol `{vx, vy, wz, enable}` sent every 200ms (5Hz). `enable` acts as a deadman switch. |
| **Realtime Telemetry** | WebSocket-first, automatic fallback to HTTP polling on disconnect. UI shows a tri-state connection indicator (live / polling / idle). |
| **Fault Management** | Fault log list with severity levels. |
| **Robot Binding** | Manual entry / QR scan (supports `robot-bind:CODE`, JSON, or URL formats). Exclusive binding. |
| **User System** | uni-id authentication + route guards + email registration & password recovery. Unified Chinese error messages. |

---

## 🛠 Tech Highlights

- **Zero-dependency state management**: Vue 3 reactive objects + localStorage, avoiding the overhead of Vuex/Pinia.
- **Stale-while-revalidate cache**: list + detail with 5-minute TTL, 20-entry cap, 3s throttle, and JSON diff change detection — pages render from cache first, then refresh in the background.
- **Tri-state WebSocket indicator**: live / polling / idle, UI directly bound to reactive `wsState.mode`; transparently falls back to HTTP polling on disconnect.
- **Deadman velocity-vector protocol**: `{vx, vy, wz, enable}` sent every 200ms; the IoT side performs a 1s-timeout emergency stop — drop the stream, drop the throttle.
- **Single-channel uniCloud auth**: every API goes through the `userService` cloud object, the `_before` hook enforces auth uniformly, and the frontend never supplies a uid.
- **HMAC-signed dynamic WebSocket tokens**: `uid:expiresAt:hmac` valid for 1 hour, sidestepping the "decompile the mini program package and steal a long-lived token" risk.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (uni-app Vue 3, mp-weixin)                    │
│                                                          │
│  pages/*.vue ──► userService.* (uniCloud Object)        │
│       │                                                  │
│       └─► ws-client.js ──┐                              │
└──────────────────────────┼──────────────────────────────┘
                           │ WebSocket (HMAC token)
                           ▼
┌─────────────────────────────────────────────────────────┐
│  IoT Gateway (Flask + flask-sock + paho-mqtt)           │
│                                                          │
│  ├─ POST /sendCommand  ──► MQTT publish ──► Robot       │
│  ├─ MQTT subscribe    ──► dedupe ──► uniCloud ingest   │
│  └─ WebSocket /ws     ──► realtime broadcast → Frontend │
└─────────────────────────────────────────────────────────┘
                           ▲
                           │ MQTT
                           │
                       ┌───┴────┐
                       │ Robot  │
                       └────────┘
```

**Single backend channel**: every frontend call goes through `uniCloud.importObject('userService')`. The `_before` hook handles authentication uniformly, and `uid` is always derived from the server-side token — frontend-supplied uid is never trusted.

**The IoT Gateway is not in this repository** (it lives in a separate repo) — you'll need to deploy it yourself.

---

## 📁 Project Structure

```
├── pages/
│   ├── login/              # Login page (charging mascot animation)
│   ├── robots/
│   │   ├── index.vue       # Robot list (skeleton + cache + WS state indicator)
│   │   └── detail.vue      # Detail + remote control (D-pad / joystick / rotate / Goto)
│   ├── my/                 # "My" tab
│   ├── profile/            # Profile editor
│   ├── settings/           # Settings + privacy & security + help + about
│   └── agreements/         # Local Terms of Service / Privacy Policy pages
├── components/
│   ├── BindRobotSheet.vue  # Bottom-sheet binding dialog (manual + QR scan)
│   └── login-animation/    # Login page animation character
├── utils/
│   ├── auth.js             # Token management + route guards
│   ├── ws-client.js        # WebSocket client (reconnect / heartbeat / polling fallback)
│   ├── robot-store.js      # List + detail cache (stale-while-revalidate)
│   ├── profile-store.js    # User profile reactive store
│   └── robotBind.js        # QR scan / binding payload parser
├── uniCloud-aliyun/
│   ├── cloudfunctions/userService/    # Single auth-enforced cloud object
│   └── database/                       # Schema + seed data
└── simulator/              # Local telemetry simulator (Node.js)
```

---

## 🗄 Database

| Collection | Index | Description |
|---|---|---|
| `robots` | `robotCode` (unique) | Robot base info |
| `telemetry_latest` | `robotCode` (unique) | Latest telemetry per robot |
| `faults` | `robotCode` + `ts` | Fault records |
| `commands` | `robotCode` + `type` + `ts` | Control command history |
| `robot_bindings` | `uid` + `robotCode` | User-to-robot bindings |
| `uni-id-users` | Built-in | Account info |

All schema `read / create / update / delete` permissions are set to `false` — only cloud functions can access them.

---

## 🔐 Security

- **Token-based auth**: `userService._before()` automatically validates token → uid, so no method needs to repeat auth code.
- **Data isolation**: users can only access robots they've bound.
- **Whitelist validation**: `sendCommand` enforces a command-type whitelist (move / stop / goto).
- **WebSocket auth**: HMAC-SHA256 dynamic tokens (`uid:expiresAt:hmac`) valid for 1 hour, sidestepping the "decompile the mini program package and steal the token" risk.
- **Schema permissions locked down**: direct client access fully disabled.

---

## 🚀 Quick Start

### 1. Prerequisites

- HBuilderX (latest, with Vue 3 support)
- WeChat DevTools
- A uniCloud account + Aliyun serverless space
- Self-deployed IoT Gateway (optional — only required for real robot integration)

### 2. Clone the repo

```bash
git clone https://github.com/Dragolone/robot-charging-station-miniprogram.git
```

Open it in HBuilderX via "File → Import → Import from local directory".

### 3. Configure secrets (required)

⚠️ **The following 4 files contain `REPLACE_WITH_*` placeholders that must be replaced with your own values before the project will run:**

#### 3.1 `manifest.json`

```jsonc
{
  "appid": "__UNI__YOUR_UNI_APP_ID",          // Your DCloud app ID
  "mp-weixin": {
    "appid": "wxYOUR_WECHAT_APPID"            // Your WeChat Mini Program AppID
  }
}
```

#### 3.2 `uni_modules/uni-config-center/uniCloud/cloudfunctions/common/uni-config-center/uni-id/config.json`

```jsonc
{
  "tokenSecret": "REPLACE_WITH_LONG_RANDOM_STRING_32PLUS",          // JWT signing key (32+ random chars)
  "requestAuthSecret": "REPLACE_WITH_ANOTHER_LONG_RANDOM_STRING_32PLUS"
}
```

Generate one with: `node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"`

#### 3.3 `uni_modules/uni-config-center/uniCloud/cloudfunctions/common/uni-config-center/telemetry/config.json` and `uniCloud-aliyun/uni-config-center/config.json`

```jsonc
{
  "telemetry": {
    "ingestToken": "REPLACE_WITH_INGEST_TOKEN",                    // Must match Gateway .env
    "commandBridge": {
      "url": "https://your-gateway.example.com/sendCommand",       // Your Gateway URL
      "token": "REPLACE_WITH_BRIDGE_TOKEN"
    },
    "ws": {
      "url": "wss://your-gateway.example.com/ws",
      "secret": "REPLACE_WITH_WS_HMAC_SECRET"                       // WS HMAC secret
    }
  }
}
```

#### 3.4 `simulator/config.json` (optional — only when using the local simulator)

```jsonc
{
  "spaceId": "REPLACE_WITH_YOUR_UNICLOUD_SPACE_ID",
  "clientSecret": "REPLACE_WITH_YOUR_UNICLOUD_CLIENT_SECRET"
}
```

### 4. Deploy the backend

- In HBuilderX, right-click `uniCloud-aliyun/database/` → upload DB schema + seed data
- Right-click the `userService` cloud object → upload & deploy
- Right-click the `uni-id-co` cloud function (under `uni_modules/uni-id-pages/uniCloud/cloudfunctions/uni-id-co/`) → upload & deploy
- In the uniCloud console → uni-config-center → upload the `telemetry` and `uni-id` configs

### 5. WeChat Open Platform console

Add the following to your server domain whitelist:

| Type | Domain |
|---|---|
| request | `api.next.bspapp.com`, `api.bspapp.com` |
| socket | Your Gateway domain |
| uploadFile / downloadFile | uniCloud CDN domain |

> **Before submitting for review, disable the "Skip domain validation" toggle and re-test locally** — leaving it on in DevTools will bypass the same checks the review process enforces.

### 6. Run

HBuilderX → Run → WeChat DevTools (mp-weixin)

---

## 📜 License

[MIT License](LICENSE) — Copyright (c) 2026 Dragolone

---

## ⚠️ Disclaimer

This project is an open-source reference implementation and **does not constitute any commercial service commitment**. Third-party brands (WeChat, uni-app, uniCloud, etc.) and their trademarks belong to their respective owners. The code is free to use within the terms of the MIT License, but before deploying to production you must:

1. Replace all `REPLACE_WITH_*` placeholders with strong random values
2. Never expose any real secret to git history
3. Perform your own security review — the author accepts no liability for any losses arising from the use of this code
