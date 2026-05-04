# Robot Charging Station Mini Program

> 微信小程序 · 机器人远程管理与遥控平台
> uni-app (Vue 3) + uniCloud + IoT Gateway (MQTT / WebSocket)

> **本仓库为个人学习与作品集项目（personal portfolio）**，用于展示全栈 + IoT 端到端设计能力。代码以 MIT License 开源，使用前请替换所有占位密钥。

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

## 🛠 Tech Highlights

- **零依赖状态管理**：Vue 3 reactive 对象 + localStorage，避免 Vuex/Pinia 重量级开销
- **Stale-while-revalidate 缓存**：列表 + 详情 5 分钟 TTL + 20 条上限 + 3s 节流 + JSON diff 检测
- **WebSocket 三态指示**：live / polling / idle，UI 直接绑定响应式 `wsState.mode`
- **deadman 速度向量协议**：`{vx, vy, wz, enable}`，200ms 间隔连续发送，IoT 端 1s 超时急停
- **uniCloud 单通道鉴权**：所有 API 走 `userService` 云对象，`_before` 钩子统一校验，禁止前端传 uid

---

## 📜 License

[MIT License](LICENSE) — Copyright (c) 2026 Dragolone

---

## ⚠️ Disclaimer

本项目为个人学习作品，**不构成任何商业服务承诺**。第三方品牌（微信、uni-app、uniCloud 等）名称及商标归原所有方所有。代码示例可自由使用，但部署到生产环境前请务必：

1. 替换所有 `REPLACE_WITH_*` 占位符为强随机值
2. 不要公开任何真实密钥到 git 历史
3. 自行评估安全性，作者不为任何因使用本代码导致的损失负责
