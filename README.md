# Robot Charging Station Mini Program

> 微信小程序 · 机器人远程管理与实时遥控平台
> uni-app (Vue 3) + uniCloud Serverless + IoT Gateway (MQTT / WebSocket)

[![CI](https://github.com/Dragolone/robot-charging-station-miniprogram/actions/workflows/ci.yml/badge.svg)](https://github.com/Dragolone/robot-charging-station-miniprogram/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![uni-app](https://img.shields.io/badge/uni--app-Vue%203-42b883.svg)](https://uniapp.dcloud.net.cn/)
[![uniCloud](https://img.shields.io/badge/uniCloud-Aliyun-orange.svg)](https://uniapp.dcloud.net.cn/uniCloud/)
[![MQTT](https://img.shields.io/badge/IoT-MQTT%20%2F%20WebSocket-blue.svg)](#-architecture)
[![Platform](https://img.shields.io/badge/Platform-WeChat%20Mini%20Program-brightgreen.svg)](#)
[![Status](https://img.shields.io/badge/Status-Reference%20Implementation-blue.svg)](#)

端到端的机器人车队管理小程序：覆盖 **实时遥测 → 远程遥控 → 故障管理 → 用户绑定** 全链路，前端 / 云函数 / IoT 网关 之间通过统一鉴权通道串联。代码以 MIT License 开源，**无需真实硬件**，借助内置的模拟器即可端到端复现。

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
- [Troubleshooting](#-troubleshooting)
- [License](#-license)
- [Disclaimer](#️-disclaimer)

---

## ✨ Features

| 模块 | 描述 |
|---|---|
| **机器人监控** | 列表 + 详情，电量 / 在线状态 / 坐标 / 任务态实时显示，15s 心跳窗口判定在线 |
| **远程遥控** | D-pad 长按持续控制 + 圆形摇杆 + 旋转按钮 + Goto 点位收藏，速度向量协议 `{vx, vy, wz, enable}`，200ms 间隔（5Hz）连续发送，enable 作 deadman 开关 |
| **实时遥测** | WebSocket 优先，断线自动降级 HTTP 轮询，UI 显示三态连接指示（live / polling / idle） |
| **故障管理** | 详情页展示未解决故障（代码 / 时间 / 描述） |
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

**真实 IoT Gateway 不在本仓库。** [`simulator/`](simulator/) 提供了一份协议一致的模拟实现（零依赖），把「Gateway + 机器人」整体替换掉，没有硬件也能跑通全链路。接入真机时，按 [Gateway 接口契约](simulator/README.md#gateway-接口契约) 实现对应接口即可，前端和云函数都不需要改。

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
│   ├── cloudfunctions/
│   │   ├── userService/    # 唯一鉴权云对象（前端所有业务调用的入口）
│   │   └── telemetryIngest/# 遥测写入口（Gateway / 模拟器调用，需 URL 化）
│   └── database/           # Schema + 索引 + 示例数据（HBuilderX 一键初始化）
├── simulator/              # 虚拟机器人 + Mock IoT Gateway（零依赖 Node.js）
└── scripts/
    ├── setup.js            # 一键生成本地密钥配置
    └── check.js            # 仓库自检（CI 使用）
```

---

## 🗄 Database

| Collection | 索引 | 说明 |
|---|---|---|
| `robots` | `robotCode` (unique) | 机器人基础信息 |
| `telemetry_latest` | `robotCode` (unique) | 每台机器人最新遥测 |
| `telemetry_history` | `robotCode` + `ts` | 遥测历史 |
| `faults` | `robotCode` + `ts` | 故障记录 |
| `commands` | `robotCode` + `ts` | 控制指令历史 |
| `robot_bindings` | `uid` + `robotCode` | 用户-机器人绑定 |
| `uni-id-users` | 系统内置 | 账号信息 |

右键 `uniCloud-aliyun/database` →「初始化云数据库」，会自动创建上述集合与索引，并导入示例机器人 `ROBOT-001` / `ROBOT-002`。字段说明见 [数据库设计文档](uniCloud-aliyun/database/数据库设计文档.md)。

所有 schema 的 `read / create / update / delete` 权限均为 `false`，仅云函数可访问。

---

## 🔐 Security

- **Token-based 鉴权**：`userService._before()` 自动校验 token → uid，每个方法无需重复鉴权代码
- **数据隔离**：用户只能访问自己绑定的机器人
- **白名单校验**：`sendCommand` 命令类型白名单（move / stop / goto）
- **WebSocket 鉴权**：HMAC-SHA256 动态令牌（`uid:expiresAt:hmac`），1 小时有效，绕开"小程序包反编译即拿到 token"的风险
- **数据库 schema 权限收紧**：直接客户端访问全关闭
- **密钥不入库**：`config.json` 由 `scripts/setup.js` 在本地生成，已加入 `.gitignore`，仓库中只保留 `config.example.json` 模板

---

## 🚀 Quick Start

不需要真实机器人。复现分三级，走到哪一级都可以停下：

| 级别 | 你能看到什么 | 额外需要 |
|---|---|---|
| **L1 账号与绑定** | 注册登录、绑定机器人、列表 / 详情、故障记录 | — |
| **L2 实时遥测** | 机器人变成「在线」，电量和坐标持续变化，列表页指示灯显示「实时」 | Node.js ≥ 18 |
| **L3 远程遥控** | D-pad / 摇杆 / Goto 驱动虚拟机器人，松手 1s 后自动急停 | 内网穿透工具（cloudflared 或 ngrok） |

### 1. 前置要求

- [HBuilderX](https://www.dcloud.io/hbuilderx.html) 与 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- DCloud 账号，以及一个**阿里云**版 uniCloud 服务空间（免费版即可）
- Node.js ≥ 18（用来生成密钥、运行模拟器）

### 2. 克隆并生成密钥

```bash
git clone https://github.com/Dragolone/robot-charging-station-miniprogram.git
cd robot-charging-station-miniprogram
node scripts/setup.js
```

脚本会从各目录的 `config.example.json` 生成下面三份本地配置。它们都已加入 gitignore，不会被提交；脚本可以重复运行，已经生成的密钥不会被覆盖。

| 文件 | 内容 |
|---|---|
| `uni_modules/uni-config-center/.../uni-id/config.json` | uni-id 的 `tokenSecret` / `requestAuthSecret` |
| `uni_modules/uni-config-center/.../telemetry/config.json` | 遥测上报、指令桥、WebSocket 的密钥和地址（云端与模拟器共用这一份） |
| `simulator/config.json` | 模拟器参数 |

### 3. 部署 uniCloud（HBuilderX）

1. 「文件 → 导入 → 从本地目录导入」打开项目
2. 打开 `manifest.json`：「基础配置」里 uni-app 应用标识点「重新获取」；「微信小程序配置」里填你的 AppID（没有正式 AppID 可以先用测试号）
3. 右键 `uniCloud-aliyun` →「关联云服务空间或项目」，选择你的阿里云空间
4. 右键 `uniCloud-aliyun/database` →「初始化云数据库」：创建集合与索引，并导入示例机器人和故障
5. 右键 `uniCloud-aliyun/cloudfunctions` →「上传所有云函数、公共模块及 Actions」

> 密钥放在公共模块 `uni-config-center` 里，跟着云函数一起部署。**以后每次修改 config.json，都要重新执行第 5 步**，否则云端还在用旧配置。

### 4. L1：运行小程序

1. HBuilderX →「运行 → 运行到小程序模拟器 → 微信开发者工具」
2. 在开发者工具的「详情 → 本地设置」里，勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」
3. 注册账号并登录 → 机器人页「添加机器人」→「手动输入设备编号」→ 输入 `ROBOT-001`

此时机器人显示「离线」，这是正常的，因为还没有设备上报数据。进入详情页能看到示例故障 F001。

### 5. L2：启动模拟器

1. 进入 [uniCloud 控制台](https://unicloud.dcloud.net.cn/) → 云函数/云对象 → `telemetryIngest` → 云函数 URL 化，设置 path（比如 `/telemetryIngest`），复制完整 URL
2. 在仓库根目录运行：

   ```bash
   node scripts/setup.js --ingest-url https://<你的空间域名>/telemetryIngest
   node simulator
   ```

3. 终端出现「遥测上报成功」后回到小程序：机器人变成「在线」，电量和坐标大约每 10s 刷新一次；列表页指示灯显示「实时」（开发者工具会通过 `ws://127.0.0.1:8787/ws` 直连本机的模拟器）

### 6. L3：打通远程遥控

`sendCommand` 运行在阿里云上，它要能从公网访问到本机模拟器的 8787 端口：

```bash
cloudflared tunnel --url http://localhost:8787     # 或：ngrok http 8787
node scripts/setup.js --bridge-url https://<隧道域名>/sendCommand
```

然后重新执行第 3 步的第 5 小步上传云函数。之后在详情页按住 D-pad，模拟器终端会打印收到的指令，坐标随之变化；松手 1s 后自动急停。在 Goto 里输入坐标，机器人会先转向、再驶向目标点。

> cloudflared 的免费隧道每次重启地址都会变。地址变了，就重新执行上面的 `--bridge-url`，再上传一次。

### 7. 接入真实硬件

用自己的 IoT Gateway 替换模拟器，实现「接收指令」「WebSocket 推送」「上报遥测」三个接口即可，详见 [Gateway 接口契约](simulator/README.md#gateway-接口契约)。前端和云函数都不需要改。

### 8. 真机预览 / 提审

在微信公众平台的服务器域名白名单里加上：

| 类型 | 域名 |
|---|---|
| request | `api.next.bspapp.com`、`api.bspapp.com` |
| socket | 你的 Gateway 域名（必须是 `wss://`） |
| uploadFile / downloadFile | uniCloud CDN 域名 |

> **提审前，务必在开发者工具里取消勾选「不校验合法域名」，再完整测一遍**。勾选状态下开发工具会跳过审核时才会做的域名校验。

---

## 🧯 Troubleshooting

| 现象 | 原因 / 解决 |
|---|---|
| 注册时报「云函数不存在」，或验证码不显示 | `uni-captcha-co` / `uni-id-co` 没有部署：重新执行「上传所有云函数、公共模块及 Actions」 |
| 绑定时提示「robotCode 不存在」 | 示例数据没导入：右键 `database` →「初始化云数据库」，或者在控制台的 `robots` 集合里手动添加 |
| 模拟器报 `找不到 .../telemetry/config.json` | 还没生成密钥：先运行 `node scripts/setup.js` |
| 模拟器报 `code=401` | 云端的 ingestToken 和本地不一致：重新上传云函数 |
| 模拟器报 `HTTP 404` | `ingestUrl` 不是 telemetryIngest 的 URL 化地址：检查控制台里设置的 path |
| 机器人一直「离线」 | 模拟器没在运行，或上报失败（看终端报错）。判定规则是最近 15s 内有上报才算在线 |
| 遥控提示「未配置 command-bridge URL」 | 还没完成 L3：用 `--bridge-url` 设置地址后，重新上传云函数 |
| 遥控提示 `invalid x-command-token` | 云端和模拟器的 bridge token 不一致：重新上传云函数，再重启模拟器 |
| 遥控请求超时 | 隧道已断开或地址变了：重启隧道，重新设置 `--bridge-url` 并上传 |
| 列表页指示灯一直是「轮询」 | WebSocket 没连上：确认模拟器在运行、`ws.url` 正确。真机上 `127.0.0.1` 指的是手机自己，要换成手机能访问到的地址 |

---

## 📜 License

[MIT License](LICENSE) — Copyright (c) 2026 Dragolone

---

## ⚠️ Disclaimer

本项目为开源参考实现，**不构成任何商业服务承诺**。第三方品牌（微信、uni-app、uniCloud 等）名称及商标归原所有方所有。代码可在 MIT License 范围内自由使用，但部署到生产环境前请务必：

1. 使用 `node scripts/setup.js` 生成你自己的强随机密钥，不要沿用任何他人的配置
2. 不要把任何真实密钥提交到 git 历史
3. 自行评估安全性，作者不为任何因使用本代码导致的损失负责

---

<a id="english-version"></a>

# English Version

> WeChat Mini Program · Robot remote management & real-time teleoperation platform
> uni-app (Vue 3) + uniCloud Serverless + IoT Gateway (MQTT / WebSocket)

An end-to-end robot fleet management mini program covering the full **realtime telemetry → remote teleoperation → fault management → user binding** loop. Frontend, cloud functions, and the IoT gateway are wired together through a single auth-enforced channel. Open-sourced under the MIT License — **no hardware required**: the bundled simulator lets you reproduce the whole pipeline end to end.

---

## 📑 Table of Contents

- [Features](#-features-1)
- [Tech Highlights](#-tech-highlights-1)
- [Architecture](#-architecture-1)
- [Project Structure](#-project-structure-1)
- [Database](#-database-1)
- [Security](#-security-1)
- [Quick Start](#-quick-start-1)
- [Troubleshooting](#-troubleshooting-1)
- [License](#-license-1)
- [Disclaimer](#️-disclaimer-1)

---

## ✨ Features

| Module | Description |
|---|---|
| **Robot Monitoring** | List + detail views with real-time battery / online status / coordinates / task state. Online status determined by a 15s heartbeat window. |
| **Remote Control** | D-pad press-and-hold continuous control + circular joystick + rotation buttons + Goto waypoint favorites. Velocity-vector protocol `{vx, vy, wz, enable}` sent every 200ms (5Hz). `enable` acts as a deadman switch. |
| **Realtime Telemetry** | WebSocket-first, automatic fallback to HTTP polling on disconnect. UI shows a tri-state connection indicator (live / polling / idle). |
| **Fault Management** | Detail page lists unresolved faults (code / time / description). |
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

**The production IoT Gateway is not in this repository.** [`simulator/`](simulator/) is a protocol-compatible, zero-dependency stand-in for "gateway + robots", so the full pipeline runs without hardware. To integrate real robots, implement the endpoints in the [gateway interface contract](simulator/README.md#gateway-接口契约) (Chinese) — no frontend or cloud changes needed.

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
│   ├── cloudfunctions/
│   │   ├── userService/    # Single auth-enforced cloud object (all frontend calls)
│   │   └── telemetryIngest/# Telemetry write endpoint (called by gateway / simulator via URL)
│   └── database/           # Schemas + indexes + seed data (one-click init in HBuilderX)
├── simulator/              # Virtual robots + mock IoT gateway (zero-dependency Node.js)
└── scripts/
    ├── setup.js            # One-command local secret generation
    └── check.js            # Repository self-check (used by CI)
```

---

## 🗄 Database

| Collection | Index | Description |
|---|---|---|
| `robots` | `robotCode` (unique) | Robot base info |
| `telemetry_latest` | `robotCode` (unique) | Latest telemetry per robot |
| `telemetry_history` | `robotCode` + `ts` | Telemetry history |
| `faults` | `robotCode` + `ts` | Fault records |
| `commands` | `robotCode` + `ts` | Control command history |
| `robot_bindings` | `uid` + `robotCode` | User-to-robot bindings |
| `uni-id-users` | Built-in | Account info |

Right-click `uniCloud-aliyun/database` → **初始化云数据库** (Initialize cloud database) to create these collections and indexes and import the sample robots `ROBOT-001` / `ROBOT-002`. Field reference: [数据库设计文档](uniCloud-aliyun/database/数据库设计文档.md) (Chinese).

All schema `read / create / update / delete` permissions are set to `false` — only cloud functions can access them.

---

## 🔐 Security

- **Token-based auth**: `userService._before()` automatically validates token → uid, so no method needs to repeat auth code.
- **Data isolation**: users can only access robots they've bound.
- **Whitelist validation**: `sendCommand` enforces a command-type whitelist (move / stop / goto).
- **WebSocket auth**: HMAC-SHA256 dynamic tokens (`uid:expiresAt:hmac`) valid for 1 hour, sidestepping the "decompile the mini program package and steal the token" risk.
- **Schema permissions locked down**: direct client access fully disabled.
- **Secrets stay out of git**: every `config.json` is generated locally by `scripts/setup.js` and gitignored; only `config.example.json` templates are committed.

---

## 🚀 Quick Start

No physical robot needed. Reproduction comes in three levels — stop at whichever you need:

| Level | What you get | Extra requirement |
|---|---|---|
| **L1 Accounts & binding** | Sign-up / login, robot binding, list / detail, fault records | — |
| **L2 Live telemetry** | Robots go online; battery and position keep updating; list indicator shows "实时" (live) | Node.js ≥ 18 |
| **L3 Remote control** | D-pad / joystick / Goto drive the virtual robot; it emergency-stops 1s after release | A tunnel (cloudflared or ngrok) |

### 1. Prerequisites

- [HBuilderX](https://www.dcloud.io/hbuilderx.html) and [WeChat DevTools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- A DCloud account and an **Aliyun** uniCloud space (the free tier is fine)
- Node.js ≥ 18 (for secret generation and the simulator)

### 2. Clone and generate secrets

```bash
git clone https://github.com/Dragolone/robot-charging-station-miniprogram.git
cd robot-charging-station-miniprogram
node scripts/setup.js
```

This creates `uni-id/config.json`, `telemetry/config.json` (under `uni_modules/uni-config-center/...`) and `simulator/config.json` from their `config.example.json` templates. All are gitignored; the script is safe to re-run and never overwrites existing secrets.

### 3. Deploy uniCloud (HBuilderX)

1. Open the project via "File → Import → Import from local directory".
2. In `manifest.json`: regenerate the uni-app AppID under Basic settings; set your WeChat AppID under the mp-weixin settings (a test AppID works).
3. Right-click `uniCloud-aliyun` → **关联云服务空间或项目** (Link cloud space) and pick your Aliyun space.
4. Right-click `uniCloud-aliyun/database` → **初始化云数据库** (Initialize cloud database).
5. Right-click `uniCloud-aliyun/cloudfunctions` → **上传所有云函数、公共模块及 Actions** (Upload all cloud functions, common modules and Actions).

> Secrets live in the `uni-config-center` common module and deploy together with the cloud functions. **Re-run step 5 after every config.json change**, or the cloud keeps the old values.

### 4. L1: run the mini program

1. HBuilderX → Run → Run in mini program simulator → WeChat DevTools.
2. In DevTools, "Details → Local settings", enable "Do not verify valid domain names, web-view, TLS versions and HTTPS certificates".
3. Register and log in → Robots tab → **添加机器人** (Add robot) → **手动输入设备编号** (Enter code manually) → `ROBOT-001`.

The robot shows as offline because nothing reports telemetry yet. The detail page already shows sample fault F001.

### 5. L2: start the simulator

1. In the [uniCloud console](https://unicloud.dcloud.net.cn/) → Cloud functions → `telemetryIngest` → enable URL access (云函数 URL 化) with a path such as `/telemetryIngest`, and copy the full URL.
2. From the repo root:

   ```bash
   node scripts/setup.js --ingest-url https://<your-space-domain>/telemetryIngest
   node simulator
   ```

3. Once the terminal reports a successful upload, the robot goes online in the app, battery and position refresh roughly every 10s, and the list indicator switches to live (DevTools connects straight to the simulator at `ws://127.0.0.1:8787/ws`).

### 6. L3: enable remote control

`sendCommand` runs on Aliyun, so it needs a public route to port 8787 on your machine:

```bash
cloudflared tunnel --url http://localhost:8787     # or: ngrok http 8787
node scripts/setup.js --bridge-url https://<tunnel-domain>/sendCommand
```

Re-upload the cloud functions (step 3.5). Now hold the D-pad on the detail page: the simulator logs each command and the position changes; release it and the robot stops 1s later. Goto turns toward the target and drives there.

> Free cloudflared tunnels get a new URL on every restart — re-run `--bridge-url` and re-upload when that happens.

### 7. Real hardware

Replace the simulator with your own IoT gateway implementing the three endpoints (command intake, WebSocket push, telemetry ingest) described in the [gateway interface contract](simulator/README.md#gateway-接口契约). The frontend and cloud functions stay unchanged.

### 8. Device preview / review submission

Add these to the server domain whitelist in the WeChat console:

| Type | Domain |
|---|---|
| request | `api.next.bspapp.com`, `api.bspapp.com` |
| socket | Your gateway domain (must be `wss://`) |
| uploadFile / downloadFile | uniCloud CDN domain |

> **Before submitting for review, turn the "skip domain validation" option off and test again** — leaving it on in DevTools bypasses the checks the review process enforces.

---

## 🧯 Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Registration says the cloud function doesn't exist, or no captcha appears | `uni-captcha-co` / `uni-id-co` not deployed — re-run "upload all cloud functions" |
| Binding says `robotCode 不存在` (robotCode not found) | Seed data missing — run "Initialize cloud database", or add the robot to `robots` in the console |
| Simulator can't find `.../telemetry/config.json` | Secrets not generated yet — run `node scripts/setup.js` |
| Simulator reports `code=401` | Cloud ingestToken differs from local — re-upload the cloud functions |
| Simulator reports `HTTP 404` | `ingestUrl` isn't telemetryIngest's URL — check the path in the console |
| Robot stays offline | Simulator not running or uploads failing (check the terminal); a robot is online only if it reported within the last 15s |
| Control says `未配置 command-bridge URL` (bridge URL not configured) | L3 not set up — set `--bridge-url`, then re-upload |
| Control says `invalid x-command-token` | Bridge token mismatch — re-upload the cloud functions and restart the simulator |
| Control requests time out | Tunnel died or its URL changed — restart it, re-set `--bridge-url`, re-upload |
| List indicator stuck on polling | WebSocket not connected — check the simulator is running and `ws.url` is right; on a real phone `127.0.0.1` is the phone itself |

---

## 📜 License

[MIT License](LICENSE) — Copyright (c) 2026 Dragolone

---

## ⚠️ Disclaimer

This project is an open-source reference implementation and **does not constitute any commercial service commitment**. Third-party brands (WeChat, uni-app, uniCloud, etc.) and their trademarks belong to their respective owners. The code is free to use within the terms of the MIT License, but before deploying to production you must:

1. Generate your own strong random secrets with `node scripts/setup.js` — never reuse anyone else's config
2. Never expose any real secret to git history
3. Perform your own security review — the author accepts no liability for any losses arising from the use of this code
