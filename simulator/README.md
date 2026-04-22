### Phase 6：低频、省资源的数据模拟器（本地脚本）

只**新增**本目录脚本，不修改任何既有前端/后台/菜单/云函数/数据库结构。

本脚本会向以下集合写入“看起来像真实运行”的数据（严格控制频率，尽量少读写）：
- `telemetry_latest`：10–15 秒/台更新一次（无变化不写库）
- `faults`：1–2 分钟尝试一次，低概率（默认 5%）写入故障
- `commands`：5–10 秒轮询一次 `status="pending"`，无 pending 不写库；对 pending 模拟 1–3 秒执行后回写 `completed/failed`

---

### 依赖安装

进入本目录安装依赖：

```bash
cd simulator
# 清掉本机过期 token（避免出现 “Access token expired or revoked” 干扰安装）
npm logout || true
npm config delete //registry.npmjs.org/:_authToken || true
npm i
```

> 说明：本目录自带 `simulator/.npmrc`，把 `@dcloudio` scope 指向 DCloud registry（`https://registry.dcloud.io/`），否则在 npmjs 会 404。

---

### uniCloud 访问配置示例

1) 复制配置模板并填写：

```bash
cd simulator
cp config.example.json config.json
```

2) 编辑 `config.json`（最少需要 3 个字段）：
- `spaceId`：你的 uniCloud 阿里云服务空间 SpaceId
- `clientSecret`：uniCloud 控制台 -> 服务空间 -> 开发者密钥（ClientSecret）
- `provider`：`aliyun`

---

### 运行方式

```bash
cd simulator
npm run start
```

或指定配置文件路径：

```bash
cd simulator
node index.js --config /绝对路径/config.json
```

---

### 模拟逻辑说明（如何省资源）

- **Telemetry**
  - 对每台机器人维护内存缓存 state（电量/位置）。
  - 每次生成小幅变化后，会按配置的位数舍入（电量 1 位小数、坐标 4 位小数）。
  - 若“舍入后”与上一次一致，则**跳过写库**（包含 lastSeen/ts 一并不写）。
  - 写库使用 `update(where robotCode)`，仅首次不存在时才 `add`（减少读库）。

- **Fault**
  - 全局 1–2 分钟才尝试一次。
  - 命中概率默认 5%，否则不写库。
  - 写入字段：`robotCode / level / message / createdAt`，并附带 `ts` 方便索引 `robotCode+ts`。

- **Command 消费**
  - 5–10 秒轮询一次 `commands`，仅查询 `status="pending"`，没有 pending 不写库。
  - 对每条 pending，模拟 1–3 秒后更新：
    - `status: completed | failed`
    - `ackAt`
    - `message`
  - 更新时带条件 `_id + status=pending`，避免并发重复消费。

---

### 验收标准（你如何验证）

在 **后台管理项目**（你已完成且稳定的 Phase 5）中验证：

- **Telemetry 缓慢变化**
  - 进入机器人详情/列表数据面板
  - 预期：`vehicleBattery/packBattery` 每 10–15 秒有小幅变化（±0.1～0.3，0–100 之间）
  - 预期：位置 `x/y` 小范围随机游走
  - 预期：`lastSeen` 随更新变化（仅在写库时变化）

- **命令会被消费**
  - 在后台新建一条 `commands` 记录（或通过你现有前端下发），并确保 `status="pending"`
  - 预期：5–10 秒内变为 `completed` 或 `failed`，同时写入 `ackAt/message`

- **偶尔出现故障**
  - 预期：每 1–2 分钟“尝试一次”，约 5% 概率出现一条新 fault（取决于运行时长）
  - 在后台故障列表中能看到新增记录：`robotCode/level/message/createdAt`

