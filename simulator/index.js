/**
 * 虚拟机器人 + IoT Gateway 模拟实现（零依赖，Node.js >= 18）
 *
 * 与真实 IoT Gateway 实现同一套接口，用于在没有硬件的情况下端到端复现：
 * - 遥测上报：周期性 POST 到 telemetryIngest 云函数（URL 化），写入 telemetry_latest
 * - POST /sendCommand：接收 userService.sendCommand 转发的控制指令，驱动虚拟机器人
 * - WS /ws：校验 HMAC 令牌后，向小程序实时推送遥测
 *
 * 运行方式（在仓库根目录）：
 *   node scripts/setup.js
 *   node simulator --ingest-url https://<服务空间域名>/telemetryIngest
 *
 * 密钥统一读取 uni-config-center/telemetry/config.json，与云端保持一致，无需重复填写。
 */

'use strict'

const fs = require('fs')
const path = require('path')
const http = require('http')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..')
const DEFAULT_TELEMETRY_CONFIG = path.join(
	ROOT,
	'uni_modules/uni-config-center/uniCloud/cloudfunctions/common/uni-config-center/telemetry/config.json'
)
const DEFAULT_SIM_CONFIG = path.join(__dirname, 'config.json')

// telemetryIngest 默认 3s 内的重复上报会被丢弃（minReportIntervalMs）
const INGEST_MIN_INTERVAL_MS = 3000
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
const WS_MAX_PAYLOAD = 1024 * 1024

const DEFAULTS = {
	ingestUrl: '',
	host: '127.0.0.1',
	port: 8787,
	robots: [
		{ robotCode: 'ROBOT-001', x: 0, y: 0, heading: 0, vehicleBattery: 86, packBattery: 92 },
		{ robotCode: 'ROBOT-002', x: 5, y: 3, heading: 1.57, vehicleBattery: 64, packBattery: 78 }
	],
	// 在线判定窗口为 15s，静止时 10s 上报一次留足余量；行驶中加快到 4s
	reportIntervalMs: 10000,
	activeReportIntervalMs: 4000,
	wsPushIntervalMs: 1000,
	tickMs: 100,
	// 与真实 IoT 端一致：超过 1s 未收到 move 指令自动急停
	deadmanMs: 1000,
	maxLinearSpeed: 0.6,
	maxAngularSpeed: 1.2,
	gotoTolerance: 0.05,
	logLevel: 'info'
}

const DIRECTION_VELOCITY = {
	forward: { vx: 1 },
	backward: { vx: -1 },
	left: { wz: 0.45 },
	right: { wz: -0.45 }
}

const REDEPLOY_HINT = 'HBuilderX 右键 uniCloud-aliyun/cloudfunctions →「上传所有云函数、公共模块及 Actions」'
const INGEST_ERROR_HINTS = {
	401: `X-INGEST-TOKEN 与云端不一致，本地 config.json 改动后需重新部署：${REDEPLOY_HINT}`,
	5001: `云端未配置 telemetry.ingestToken，请先运行 node scripts/setup.js 再部署：${REDEPLOY_HINT}`
}

function createLogger(level) {
	const levels = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 }
	const cur = levels[level] || levels.info
	const stamp = () => new Date().toTimeString().slice(0, 8)
	const at = (l, fn) => (...a) => (levels[l] >= cur ? fn(`[${stamp()}]`, ...a) : undefined)
	return {
		debug: at('debug', console.log),
		info: at('info', console.log),
		warn: at('warn', console.warn),
		error: at('error', console.error)
	}
}

function num(value, fallback) {
	const n = Number(value)
	return Number.isFinite(n) ? n : fallback
}

function clamp(v, min, max) {
	return Math.max(min, Math.min(max, v))
}

function roundTo(v, decimals) {
	const p = Math.pow(10, decimals)
	return Math.round(v * p) / p
}

function wrapAngle(a) {
	return Math.atan2(Math.sin(a), Math.cos(a))
}

function safeEqual(a, b) {
	const x = Buffer.from(String(a || ''))
	const y = Buffer.from(String(b || ''))
	return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y)
}

function isPlaceholder(value) {
	return !value || /^REPLACE_WITH/.test(String(value))
}

// ---------------- 配置 ----------------

function parseArgs(argv) {
	const out = {}
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		if (arg === '--no-ingest') out.noIngest = true
		else if (arg === '--config') out.config = argv[++i]
		else if (arg === '--telemetry-config') out.telemetryConfig = argv[++i]
		else if (arg === '--ingest-url') out.ingestUrl = argv[++i]
		else if (arg === '--port') out.port = Number(argv[++i])
		else if (arg === '--host') out.host = argv[++i]
		else if (arg === '-h' || arg === '--help') out.help = true
		else throw new Error(`未知参数：${arg}（使用 --help 查看用法）`)
	}
	return out
}

function loadJsonFile(file) {
	return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function loadConfig(args) {
	const file = args.config || DEFAULT_SIM_CONFIG
	const fromFile = fs.existsSync(file) ? loadJsonFile(file) : {}
	const cfg = { ...DEFAULTS, ...fromFile }
	if (args.ingestUrl) cfg.ingestUrl = args.ingestUrl
	if (args.port !== undefined) cfg.port = args.port
	if (args.host) cfg.host = args.host
	cfg.ingestUrl = String(cfg.ingestUrl || '').trim()
	return cfg
}

function loadSecrets(file) {
	const rel = path.relative(process.cwd(), file)
	if (!fs.existsSync(file)) {
		throw new Error(`找不到 ${rel}\n请先在仓库根目录运行：node scripts/setup.js`)
	}
	const telemetry = (loadJsonFile(file) || {}).telemetry || {}
	const secrets = {
		ingestToken: telemetry.ingestToken,
		bridgeToken: telemetry.commandBridge && telemetry.commandBridge.token,
		wsSecret: telemetry.ws && telemetry.ws.secret
	}
	const missing = Object.keys(secrets).filter(k => isPlaceholder(secrets[k]))
	if (missing.length) {
		throw new Error(`${rel} 中的密钥尚未生成（${missing.join(', ')}）\n请先运行：node scripts/setup.js`)
	}
	return secrets
}

// ---------------- 虚拟机器人 ----------------

function createRobot(seed) {
	return {
		robotCode: String(seed.robotCode),
		x: num(seed.x, 0),
		y: num(seed.y, 0),
		heading: num(seed.heading, 0),
		vehicleBattery: num(seed.vehicleBattery, 80),
		packBattery: num(seed.packBattery, 90),
		speed: 0,
		// idle | velocity | goto
		mode: 'idle',
		cmd: { vx: 0, vy: 0, wz: 0 },
		target: null,
		lastMoveAt: 0,
		lastReportAt: 0,
		reporting: false
	}
}

function stopRobot(robot) {
	robot.mode = 'idle'
	robot.cmd = { vx: 0, vy: 0, wz: 0 }
	robot.target = null
}

function toVelocity(p) {
	const has = k => Object.prototype.hasOwnProperty.call(p, k)
	if (has('vx') || has('vy') || has('wz')) {
		return {
			vx: clamp(num(p.vx, 0), -1, 1),
			vy: clamp(num(p.vy, 0), -1, 1),
			wz: clamp(num(p.wz, 0), -1, 1),
			enable: p.enable !== false
		}
	}
	// 旧摇杆坐标模式：y 为前后，x 为左右转向
	if (has('x') || has('y')) {
		return { vx: clamp(num(p.y, 0), -1, 1), vy: 0, wz: clamp(-num(p.x, 0), -1, 1), enable: true }
	}
	const preset = DIRECTION_VELOCITY[p.direction || p.cmd]
	return preset ? { vx: 0, vy: 0, wz: 0, ...preset, enable: true } : null
}

/**
 * 执行一条 command-bridge 指令（格式见 userService.toBridgeCommand）
 */
function applyCommand(robot, cmd, params, now) {
	const p = params && typeof params === 'object' ? params : {}

	if (cmd === 'stop') {
		stopRobot(robot)
		return { ok: true }
	}

	if (cmd === 'goto') {
		const x = Number(p.x)
		const y = Number(p.y)
		if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, msg: 'goto 需要数字 x/y' }
		robot.mode = 'goto'
		robot.cmd = { vx: 0, vy: 0, wz: 0 }
		robot.target = { x, y }
		return { ok: true }
	}

	if (cmd === 'move') {
		const v = toVelocity(p)
		if (!v) return { ok: false, msg: 'move 参数无法识别' }
		if (!v.enable || (v.vx === 0 && v.vy === 0 && v.wz === 0)) {
			stopRobot(robot)
			return { ok: true }
		}
		robot.mode = 'velocity'
		robot.cmd = { vx: v.vx, vy: v.vy, wz: v.wz }
		robot.target = null
		robot.lastMoveAt = now
		return { ok: true }
	}

	return { ok: false, msg: `不支持的指令：${cmd}` }
}

/**
 * 推进一步物理状态，返回本步发生的事件（'deadman' / 'arrived'），没有则返回 null
 */
function stepRobot(robot, dt, now, cfg) {
	let event = null
	let linear = 0
	let lateral = 0
	let angular = 0

	if (robot.mode === 'velocity' && now - robot.lastMoveAt > cfg.deadmanMs) {
		stopRobot(robot)
		event = 'deadman'
	}

	if (robot.mode === 'velocity') {
		linear = robot.cmd.vx * cfg.maxLinearSpeed
		lateral = robot.cmd.vy * cfg.maxLinearSpeed
		angular = robot.cmd.wz * cfg.maxAngularSpeed
	} else if (robot.mode === 'goto') {
		const dx = robot.target.x - robot.x
		const dy = robot.target.y - robot.y
		const dist = Math.hypot(dx, dy)
		if (dist <= cfg.gotoTolerance) {
			stopRobot(robot)
			event = 'arrived'
		} else {
			// 先原地转向目标，朝向误差足够小后再前进
			const err = wrapAngle(Math.atan2(dy, dx) - robot.heading)
			angular = clamp(err * 2, -cfg.maxAngularSpeed, cfg.maxAngularSpeed)
			linear = Math.abs(err) < 0.3 ? Math.min(cfg.maxLinearSpeed, dist) : 0
		}
	}

	robot.heading = wrapAngle(robot.heading + angular * dt)
	const cos = Math.cos(robot.heading)
	const sin = Math.sin(robot.heading)
	robot.x += (linear * cos - lateral * sin) * dt
	robot.y += (linear * sin + lateral * cos) * dt
	robot.speed = Math.hypot(linear, lateral)

	// 电量：静置缓慢下降，行驶时更快（仅用于让数据"活"起来）
	const drain = (0.002 + robot.speed * 0.02 + Math.abs(angular) * 0.005) * dt
	robot.vehicleBattery = Math.max(5, robot.vehicleBattery - drain)
	robot.packBattery = Math.max(5, robot.packBattery - drain * 0.5)

	return event
}

function snapshot(robot) {
	return {
		robotCode: robot.robotCode,
		x: roundTo(robot.x, 3),
		y: roundTo(robot.y, 3),
		heading: roundTo(robot.heading, 3),
		speed: roundTo(robot.speed, 2),
		vehicleBattery: roundTo(robot.vehicleBattery, 1),
		packBattery: roundTo(robot.packBattery, 1),
		mode: robot.mode
	}
}

// ---------------- WebSocket（RFC 6455 最小实现，仅文本帧） ----------------

/**
 * 校验 userService.getWSToken 签发的令牌：`${uid}:${expiresAt}:${hmacSha256Hex}`
 */
function verifyWSToken(token, secret, now) {
	const parts = String(token || '').split(':')
	if (parts.length < 3) return null
	const signature = parts.pop()
	const expiresAtText = parts.pop()
	const uid = parts.join(':')
	const expiresAt = Number(expiresAtText)
	if (!uid || !Number.isFinite(expiresAt) || expiresAt <= now) return null
	const expected = crypto.createHmac('sha256', secret).update(`${uid}:${expiresAtText}`).digest('hex')
	return safeEqual(signature, expected) ? uid : null
}

function encodeFrame(opcode, payload) {
	const len = payload.length
	let header
	if (len < 126) {
		header = Buffer.from([0x80 | opcode, len])
	} else if (len < 65536) {
		header = Buffer.alloc(4)
		header[1] = 126
		header.writeUInt16BE(len, 2)
	} else {
		header = Buffer.alloc(10)
		header[1] = 127
		header.writeBigUInt64BE(BigInt(len), 2)
	}
	header[0] = 0x80 | opcode
	return Buffer.concat([header, payload])
}

// 从缓冲区解析一帧；数据不完整时返回 null
function decodeFrame(buf) {
	if (buf.length < 2) return null
	const opcode = buf[0] & 0x0f
	const masked = (buf[1] & 0x80) !== 0
	let len = buf[1] & 0x7f
	let pos = 2
	if (len === 126) {
		if (buf.length < 4) return null
		len = buf.readUInt16BE(2)
		pos = 4
	} else if (len === 127) {
		if (buf.length < 10) return null
		len = Number(buf.readBigUInt64BE(2))
		pos = 10
	}
	if (len > WS_MAX_PAYLOAD) return { opcode: -1, size: buf.length, payload: Buffer.alloc(0) }
	const maskLen = masked ? 4 : 0
	if (buf.length < pos + maskLen + len) return null
	const payload = Buffer.from(buf.subarray(pos + maskLen, pos + maskLen + len))
	if (masked) {
		const mask = buf.subarray(pos, pos + 4)
		for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3]
	}
	return { opcode, size: pos + maskLen + len, payload }
}

function rejectUpgrade(socket, status, text) {
	socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
}

// ---------------- Gateway ----------------

function readJsonBody(req, limit = 64 * 1024) {
	return new Promise((resolve, reject) => {
		let size = 0
		const chunks = []
		req.on('data', chunk => {
			size += chunk.length
			if (size > limit) {
				reject(new Error('body too large'))
				req.destroy()
				return
			}
			chunks.push(chunk)
		})
		req.on('end', () => {
			try {
				const text = Buffer.concat(chunks).toString('utf8').trim()
				resolve(text ? JSON.parse(text) : {})
			} catch (e) {
				reject(e)
			}
		})
		req.on('error', reject)
	})
}

function sendJson(res, status, data) {
	const body = JSON.stringify(data)
	res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) })
	res.end(body)
}

function describeCommand(robot) {
	if (robot.mode === 'velocity') {
		const { vx, vy, wz } = robot.cmd
		return `velocity vx=${vx.toFixed(2)} vy=${vy.toFixed(2)} wz=${wz.toFixed(2)}`
	}
	if (robot.mode === 'goto') return `goto (${robot.target.x}, ${robot.target.y})`
	return 'stop'
}

/**
 * 启动模拟器；返回 { port, robots, close }
 */
function startSimulator(cfg, secrets) {
	const log = createLogger(cfg.logLevel)
	const robots = (cfg.robots || []).map(createRobot)
	const robotMap = new Map(robots.map(r => [r.robotCode, r]))
	const clients = new Set()
	const lastCommandText = new Map()
	const reportState = { lastError: '', okOnce: new Set() }

	if (!robots.length) throw new Error('robots 为空：至少配置一台机器人')
	if (cfg.ingestUrl && Math.min(cfg.reportIntervalMs, cfg.activeReportIntervalMs) < INGEST_MIN_INTERVAL_MS + 500) {
		log.warn(`上报间隔低于 ${INGEST_MIN_INTERVAL_MS + 500}ms，可能被 telemetryIngest 限流丢弃`)
	}

	async function reportTelemetry(robot) {
		robot.reporting = true
		robot.lastReportAt = Date.now()
		const s = snapshot(robot)
		const body = {
			robotCode: s.robotCode,
			speed: s.speed,
			vehicleBattery: s.vehicleBattery,
			packBattery: s.packBattery,
			x: s.x,
			y: s.y,
			ts: robot.lastReportAt,
			// raw 中带上 ts，避免静止时被 telemetryIngest 判为重复上报而跳过写库
			raw: { source: 'simulator', heading: s.heading, mode: s.mode, ts: robot.lastReportAt }
		}
		let problem = ''
		try {
			const res = await fetch(cfg.ingestUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-INGEST-TOKEN': secrets.ingestToken },
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(8000)
			})
			const text = await res.text()
			let data = null
			try {
				data = JSON.parse(text)
			} catch (e) {}
			if (!res.ok) {
				problem = `HTTP ${res.status}（检查 ingestUrl 是否为 telemetryIngest 的 URL 化地址）`
			} else if (!data || data.code !== 0) {
				const code = data && data.code
				problem = `code=${code} ${(data && data.message) || text.slice(0, 120)}`
				if (INGEST_ERROR_HINTS[code]) problem += `\n    → ${INGEST_ERROR_HINTS[code]}`
			}
		} catch (e) {
			problem = `请求失败：${(e && e.message) || e}`
		} finally {
			robot.reporting = false
		}

		if (problem) {
			if (problem !== reportState.lastError) log.error(`遥测上报失败 ${robot.robotCode}: ${problem}`)
			reportState.lastError = problem
			return
		}
		if (reportState.lastError) log.info('遥测上报已恢复')
		reportState.lastError = ''
		if (!reportState.okOnce.has(robot.robotCode)) {
			reportState.okOnce.add(robot.robotCode)
			log.info(`遥测上报成功 ${robot.robotCode} → 小程序中应显示「在线」`)
		}
		log.debug('遥测已上报', s)
	}

	let lastTickAt = Date.now()
	const tickTimer = setInterval(() => {
		const now = Date.now()
		const dt = (now - lastTickAt) / 1000
		lastTickAt = now
		for (const robot of robots) {
			const event = stepRobot(robot, dt, now, cfg)
			if (event === 'deadman') log.info(`${robot.robotCode} 超过 ${cfg.deadmanMs}ms 未收到 move，急停（deadman）`)
			if (event === 'arrived') log.info(`${robot.robotCode} 已到达目标点 (${roundTo(robot.x, 2)}, ${roundTo(robot.y, 2)})`)
			if (event) lastCommandText.delete(robot.robotCode)

			if (!cfg.ingestUrl || robot.reporting) continue
			const moving = robot.mode !== 'idle'
			const interval = moving ? cfg.activeReportIntervalMs : cfg.reportIntervalMs
			if (now - robot.lastReportAt >= interval) reportTelemetry(robot)
		}
	}, cfg.tickMs)

	const pushTimer = setInterval(() => {
		if (!clients.size) return
		const frames = robots.map(robot => {
			const s = snapshot(robot)
			return encodeFrame(0x1, Buffer.from(JSON.stringify({
				type: 'telemetry',
				robotCode: s.robotCode,
				data: { ...s, ts: Date.now() }
			})))
		})
		for (const client of clients) frames.forEach(f => client.socket.write(f))
	}, cfg.wsPushIntervalMs)

	async function handleSendCommand(req, res) {
		if (req.method !== 'POST') return sendJson(res, 405, { code: 405, msg: 'Method Not Allowed' })
		if (!safeEqual(req.headers['x-command-token'], secrets.bridgeToken)) {
			log.warn(`拒绝 /sendCommand：x-command-token 与云端不一致，需重新部署：${REDEPLOY_HINT}`)
			return sendJson(res, 401, { code: 401, msg: 'invalid x-command-token' })
		}
		let body
		try {
			body = await readJsonBody(req)
		} catch (e) {
			return sendJson(res, 400, { code: 400, msg: 'invalid json body' })
		}
		const robot = robotMap.get(String(body.robotCode || '').trim())
		if (!robot) return sendJson(res, 404, { code: 404, msg: `unknown robot: ${body.robotCode}` })

		const result = applyCommand(robot, String(body.cmd || ''), body.params, Date.now())
		if (!result.ok) return sendJson(res, 400, { code: 400, msg: result.msg })

		// D-pad / 摇杆按住时 5Hz 连发，只在指令内容变化时打印
		const text = describeCommand(robot)
		if (lastCommandText.get(robot.robotCode) !== text) {
			lastCommandText.set(robot.robotCode, text)
			log.info(`收到指令 ${robot.robotCode}: ${text}`)
		}
		return sendJson(res, 200, {
			code: 0,
			msg: 'ok',
			data: { requestId: body.requestId, robotCode: robot.robotCode, mode: robot.mode }
		})
	}

	const server = http.createServer((req, res) => {
		const url = new URL(req.url, 'http://localhost')
		if (url.pathname === '/sendCommand') {
			handleSendCommand(req, res).catch(e => sendJson(res, 500, { code: 500, msg: e.message }))
			return
		}
		if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
			return sendJson(res, 200, { ok: true, wsClients: clients.size, robots: robots.map(snapshot) })
		}
		sendJson(res, 404, { code: 404, msg: 'Not Found' })
	})

	server.on('upgrade', (req, socket, head) => {
		const url = new URL(req.url, 'http://localhost')
		if (url.pathname !== '/ws') return rejectUpgrade(socket, 404, 'Not Found')
		const key = req.headers['sec-websocket-key']
		if (!key || String(req.headers.upgrade || '').toLowerCase() !== 'websocket') {
			return rejectUpgrade(socket, 400, 'Bad Request')
		}
		const uid = verifyWSToken(url.searchParams.get('token'), secrets.wsSecret, Date.now())
		if (!uid) {
			log.warn('拒绝 WebSocket 连接：令牌无效或已过期')
			return rejectUpgrade(socket, 401, 'Unauthorized')
		}

		const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64')
		const headers = ['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`]
		const protocol = String(req.headers['sec-websocket-protocol'] || '').split(',')[0].trim()
		if (protocol) headers.push(`Sec-WebSocket-Protocol: ${protocol}`)
		socket.write(headers.join('\r\n') + '\r\n\r\n')

		const client = { uid, socket }
		clients.add(client)
		log.info(`WebSocket 已连接 uid=${uid}（当前 ${clients.size} 个）`)

		let buffer = head && head.length ? Buffer.from(head) : Buffer.alloc(0)
		const drop = () => {
			if (clients.delete(client)) log.info(`WebSocket 已断开 uid=${uid}`)
		}
		socket.on('data', chunk => {
			buffer = Buffer.concat([buffer, chunk])
			let frame
			while ((frame = decodeFrame(buffer))) {
				buffer = buffer.subarray(frame.size)
				if (frame.opcode === -1) return socket.destroy()
				if (frame.opcode === 0x8) {
					socket.end(encodeFrame(0x8, frame.payload.subarray(0, 2)))
					return drop()
				}
				if (frame.opcode === 0x9) socket.write(encodeFrame(0xa, frame.payload))
				if (frame.opcode !== 0x1) continue
				let msg = null
				try {
					msg = JSON.parse(frame.payload.toString('utf8'))
				} catch (e) {}
				if (msg && msg.type === 'ping') {
					socket.write(encodeFrame(0x1, Buffer.from(JSON.stringify({ type: 'pong', ts: Date.now() }))))
				}
			}
		})
		socket.on('close', drop)
		socket.on('error', drop)
	})

	return new Promise((resolve, reject) => {
		server.once('error', reject)
		server.listen(cfg.port, cfg.host, () => {
			resolve({
				port: server.address().port,
				robots,
				close() {
					clearInterval(tickTimer)
					clearInterval(pushTimer)
					for (const client of clients) client.socket.destroy()
					clients.clear()
					return new Promise(done => server.close(() => done()))
				}
			})
		})
	})
}

// ---------------- CLI ----------------

const HELP = `用法：node simulator [选项]

  --ingest-url <url>        telemetryIngest 云函数的 URL 化地址（必填，或写入 simulator/config.json）
  --port <n>                监听端口（默认 8787）
  --host <addr>             监听地址（默认 127.0.0.1；真机局域网调试可设为 0.0.0.0）
  --config <file>           模拟器配置（默认 simulator/config.json，可选）
  --telemetry-config <file> 密钥来源（默认 uni-config-center/telemetry/config.json）
  --no-ingest               不上报遥测，仅启动 /sendCommand 与 /ws（调试用）
`

async function main() {
	const args = parseArgs(process.argv.slice(2))
	if (args.help) {
		console.log(HELP)
		return
	}
	const cfg = loadConfig(args)
	const secrets = loadSecrets(args.telemetryConfig || DEFAULT_TELEMETRY_CONFIG)

	if (args.noIngest) {
		cfg.ingestUrl = ''
	} else if (!/^https?:\/\//.test(cfg.ingestUrl)) {
		throw new Error(
			'缺少 ingestUrl：uniCloud 控制台 → 云函数 → telemetryIngest → 云函数 URL 化，然后运行\n' +
			'  node simulator --ingest-url https://<服务空间域名>/telemetryIngest'
		)
	}

	const sim = await startSimulator(cfg, secrets)
	const base = `http://${cfg.host === '0.0.0.0' ? '127.0.0.1' : cfg.host}:${sim.port}`
	console.log('')
	console.log(`  虚拟机器人  ${sim.robots.map(r => `${r.robotCode} (${r.x}, ${r.y})`).join('  ')}`)
	console.log(`  健康检查    ${base}/health`)
	console.log(`  实时推送    ${base.replace('http', 'ws')}/ws`)
	console.log(`  指令接收    POST ${base}/sendCommand  （云函数需经内网穿透访问，见 README「L3 远程遥控」）`)
	console.log(`  遥测上报    ${cfg.ingestUrl ? `${cfg.ingestUrl}  每 ${cfg.reportIntervalMs / 1000}s（行驶中 ${cfg.activeReportIntervalMs / 1000}s）` : '已关闭（--no-ingest）'}`)
	console.log('')

	const shutdown = () => {
		console.log('\n正在退出...')
		sim.close().then(() => process.exit(0))
	}
	process.on('SIGINT', shutdown)
	process.on('SIGTERM', shutdown)
}

if (require.main === module) {
	main().catch(err => {
		console.error(`\n模拟器启动失败：${(err && err.message) || err}\n`)
		process.exit(1)
	})
}

module.exports = {
	DEFAULTS,
	createRobot,
	applyCommand,
	stepRobot,
	snapshot,
	verifyWSToken,
	startSimulator
}
