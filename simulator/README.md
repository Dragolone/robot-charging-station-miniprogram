# 机器人模拟器（Mock IoT Gateway）

用来替代真实 IoT Gateway 和机器人，让你**没有硬件也能把整条链路跑通**：遥测上报 → 小程序实时显示 → 遥控指令 → 虚拟机器人移动 → 新遥测。

- 零依赖，只需要 Node.js ≥ 18，不用 `npm install`
- 和真实 Gateway 实现同一套接口（见下文[接口契约](#gateway-接口契约)），换上真实硬件时云端和前端都不用改
- 密钥直接读 `uni-config-center/telemetry/config.json`，和云端保持一致

```
小程序 ──sendCommand──► userService ──POST /sendCommand──► 模拟器 ──► 虚拟机器人
   ▲                                                         │
   └──────────── WS /ws 实时推送 ◄───────────────────────────┤
                                                             │
   userService ◄── telemetry_latest ◄── telemetryIngest ◄────┘ 每 10s 上报（行驶中 4s）
```

## 快速使用

在仓库根目录：

```bash
node scripts/setup.js        # 首次：生成密钥（已生成可跳过）
node simulator --ingest-url https://<服务空间域名>/telemetryIngest
```

`ingestUrl` 来自 uniCloud 控制台 → 云函数/云对象 → `telemetryIngest` → 云函数 URL 化。也可以用 `node scripts/setup.js --ingest-url <url>` 写进 `simulator/config.json`，之后直接 `node simulator`。

启动成功后，每台机器人第一次上报成功时，终端会打印 `遥测上报成功 ROBOT-001 → 小程序中应显示「在线」`。

## 虚拟机器人的行为

| 指令 | 行为 |
|---|---|
| `move {vx, vy, wz, enable}` | 速度控制：`vx/vy` × 0.6 m/s，`wz` × 1.2 rad/s。**超过 1s 收不到新的 move 就自动急停（deadman）**，跟真实 IoT 端一样 |
| `move {direction}` / `move {x, y}` | 兼容旧协议，换算成速度指令 |
| `goto {x, y}` | 先原地转向目标，再驶向目标，到达后停止 |
| `stop` | 立即停止，取消 goto |

电量会随时间缓慢下降，行驶时下降更快，这样数据看起来是"活"的。

## 配置

`simulator/config.json` 可以不建，不建就用默认值，字段参考 [`config.example.json`](config.example.json)：

| 字段 | 默认 | 说明 |
|---|---|---|
| `ingestUrl` | — | telemetryIngest 的 URL 化地址（必填） |
| `host` / `port` | `127.0.0.1` / `8787` | 监听地址；真机在局域网调试时把 host 改成 `0.0.0.0` |
| `robots` | ROBOT-001、ROBOT-002 | 虚拟机器人列表，`robotCode` 必须已在 `robots` 集合中 |
| `reportIntervalMs` | 10000 | 静止时的上报间隔。必须小于 15s 的在线窗口 |
| `activeReportIntervalMs` | 4000 | 行驶中的上报间隔。必须大于 telemetryIngest 的 3s 限流 |
| `wsPushIntervalMs` | 1000 | WebSocket 推送间隔 |
| `deadmanMs` | 1000 | 急停超时 |

命令行参数：`--ingest-url`、`--port`、`--host`、`--config`、`--telemetry-config`，另有 `--no-ingest`（只开 `/sendCommand` 和 `/ws`，不上报遥测）。完整说明见 `node simulator --help`。

## 自测

```bash
node --test simulator/index.test.js
```

覆盖令牌校验、deadman 急停、goto、WebSocket 鉴权与推送、遥测上报格式。

---

## Gateway 接口契约

接入真实硬件时，你自己的 Gateway 需要实现下面三个接口。模拟器的 [`index.js`](index.js) 就是一份可以直接对照的参考实现。

### 1. 接收指令：`POST {telemetry.commandBridge.url}`

调用方是 `userService.sendCommand`，它运行在 uniCloud 上，所以**这个地址必须能从公网访问**。

- 请求头：`x-command-token: {telemetry.commandBridge.token}`
- 请求体：

  ```json
  { "requestId": "cmd_...", "commandId": "...", "robotCode": "ROBOT-001", "cmd": "move", "params": { "vx": 0.5, "vy": 0, "wz": 0, "enable": true }, "ts": 1705291825000 }
  ```

  | cmd | params |
  |---|---|
  | `move` | `{vx, vy, wz, enable}`，取值都在 −1 ~ 1，`enable=false` 等同停止 |
  | `stop` | `{vx: 0, vy: 0, wz: 0, enable: false}` |
  | `goto` | `{x, y}` |

- 响应：`{"code": 0, "msg": "ok"}` 表示成功，`commands.status` 会变成 `sent`；其它 code 会变成 `failed`，`msg` 记入 `errorMessage`
- 超时：`telemetry.commandBridge.timeoutMs`（默认 5000ms）
- 按住 D-pad 或摇杆时，前端以 **5Hz** 连续下发 move。Gateway 侧应实现 deadman：超时收不到新的 move 就急停

### 2. 实时推送：`WS {telemetry.ws.url}?token=...`

- `token` = `${uid}:${expiresAt}:${hex(HMAC-SHA256(ws.secret, "${uid}:${expiresAt}"))}`，由 `userService.getWSToken` 签发，有效期 1 小时。Gateway 要校验签名和 `expiresAt > now`
- 推送格式：

  ```json
  { "type": "telemetry", "robotCode": "ROBOT-001", "data": { "vehicleBattery": 85.5, "packBattery": 92.3, "speed": 0.3, "ts": 1705291825000 } }
  ```

- 客户端每 25s 发一次 `{"type": "ping"}`
- 生产环境应该只推送该 uid 已绑定的机器人。模拟器为了简化会推送全部，前端会自动忽略未绑定的

### 3. 上报遥测：`POST {telemetryIngest 的 URL 化地址}`

- 请求头：`X-INGEST-TOKEN: {telemetry.ingestToken}`
- 请求体：`{ robotCode, vehicleBattery, packBattery, speed, x?, y?, ts?, raw? }`
- 同一台机器人 3s 内的重复上报会被丢弃（`minReportIntervalMs`）。**至少每 15s 上报一次**，否则会被判为离线，`sendCommand` 也会拒绝下发
