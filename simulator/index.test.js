'use strict'

const test = require('node:test')
const assert = require('node:assert')
const http = require('http')
const crypto = require('crypto')

const { DEFAULTS, createRobot, applyCommand, stepRobot, verifyWSToken, startSimulator } = require('./index.js')

const SECRETS = { ingestToken: 'ingest-test', bridgeToken: 'bridge-test', wsSecret: 'ws-test' }

// 与 userService.getWSToken 的签发逻辑保持一致
function signWSToken(uid, expiresAt, secret = SECRETS.wsSecret) {
	const signature = crypto.createHmac('sha256', secret).update(`${uid}:${expiresAt}`).digest('hex')
	return `${uid}:${expiresAt}:${signature}`
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

// 本地假 telemetryIngest：记录收到的上报
function startFakeIngest() {
	const received = []
	const server = http.createServer((req, res) => {
		let body = ''
		req.on('data', c => (body += c))
		req.on('end', () => {
			received.push({ token: req.headers['x-ingest-token'], body: JSON.parse(body) })
			res.setHeader('Content-Type', 'application/json')
			res.end(JSON.stringify({ code: 0, data: { ok: true } }))
		})
	})
	return new Promise(resolve => {
		server.listen(0, '127.0.0.1', () => resolve({ server, received, url: `http://127.0.0.1:${server.address().port}/telemetryIngest` }))
	})
}

test('verifyWSToken 接受 userService 签发的令牌，拒绝篡改与过期', () => {
	const now = Date.now()
	const uid = '65a1b2c3d4e5f6a7b8c9d0e1'
	assert.strictEqual(verifyWSToken(signWSToken(uid, now + 60000), SECRETS.wsSecret, now), uid)
	assert.strictEqual(verifyWSToken(signWSToken(uid, now - 1), SECRETS.wsSecret, now), null)
	assert.strictEqual(verifyWSToken(signWSToken(uid, now + 60000, 'other'), SECRETS.wsSecret, now), null)
	assert.strictEqual(verifyWSToken(signWSToken('someone-else', now + 60000).replace('someone-else', uid), SECRETS.wsSecret, now), null)
	assert.strictEqual(verifyWSToken('', SECRETS.wsSecret, now), null)
})

test('goto 转向并驶向目标，到达后停止', () => {
	const robot = createRobot({ robotCode: 'R', x: 0, y: 0, heading: 0 })
	assert.deepStrictEqual(applyCommand(robot, 'goto', { x: 1, y: 1 }, 0), { ok: true })
	let event = null
	for (let i = 0; i < 1000 && !event; i++) event = stepRobot(robot, 0.05, 0, DEFAULTS)
	assert.strictEqual(event, 'arrived')
	assert.strictEqual(robot.mode, 'idle')
	assert.ok(Math.hypot(robot.x - 1, robot.y - 1) <= DEFAULTS.gotoTolerance)
})

test('不支持或参数非法的指令被拒绝', () => {
	const robot = createRobot({ robotCode: 'R' })
	assert.strictEqual(applyCommand(robot, 'jump', {}, 0).ok, false)
	assert.strictEqual(applyCommand(robot, 'goto', { x: 'a' }, 0).ok, false)
	assert.strictEqual(applyCommand(robot, 'move', {}, 0).ok, false)
	assert.strictEqual(applyCommand(robot, 'move', { direction: 'forward' }, 0).ok, true)
	assert.strictEqual(robot.mode, 'velocity')
})

test('Gateway 端到端：指令、deadman、WebSocket、遥测上报', async t => {
	const ingest = await startFakeIngest()
	const sim = await startSimulator({
		...DEFAULTS,
		ingestUrl: ingest.url,
		port: 0,
		tickMs: 20,
		deadmanMs: 200,
		reportIntervalMs: 100,
		activeReportIntervalMs: 100,
		wsPushIntervalMs: 50,
		logLevel: 'silent'
	}, SECRETS)
	t.after(async () => {
		await sim.close()
		ingest.server.close()
	})

	const base = `http://127.0.0.1:${sim.port}`
	const robot = sim.robots.find(r => r.robotCode === 'ROBOT-001')
	const send = (body, token = SECRETS.bridgeToken) => fetch(`${base}/sendCommand`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'x-command-token': token },
		body: JSON.stringify(body)
	}).then(async res => ({ status: res.status, data: await res.json() }))

	await t.test('x-command-token 错误时拒绝', async () => {
		const res = await send({ robotCode: 'ROBOT-001', cmd: 'stop', params: {} }, 'wrong')
		assert.strictEqual(res.status, 401)
		assert.notStrictEqual(res.data.code, 0)
	})

	await t.test('未知机器人返回非 0 code', async () => {
		const res = await send({ robotCode: 'NOPE', cmd: 'stop', params: {} })
		assert.strictEqual(res.data.code, 404)
	})

	await t.test('move 驱动前进，停止发送后 deadman 急停', async () => {
		const res = await send({ robotCode: 'ROBOT-001', cmd: 'move', params: { vx: 1, vy: 0, wz: 0, enable: true } })
		assert.strictEqual(res.data.code, 0)
		await sleep(100)
		assert.strictEqual(robot.mode, 'velocity')
		assert.ok(robot.x > 0, `x 应增加，实际 ${robot.x}`)
		await sleep(250)
		assert.strictEqual(robot.mode, 'idle')
		assert.strictEqual(robot.speed, 0)
	})

	await t.test('遥测上报携带 X-INGEST-TOKEN 与坐标', async () => {
		await sleep(150)
		const report = ingest.received.find(r => r.body.robotCode === 'ROBOT-001')
		assert.ok(report, '应收到 ROBOT-001 的上报')
		assert.strictEqual(report.token, SECRETS.ingestToken)
		for (const key of ['vehicleBattery', 'packBattery', 'speed', 'x', 'y', 'ts']) {
			assert.strictEqual(typeof report.body[key], 'number', `${key} 应为数字`)
		}
	})

	await t.test('WebSocket 拒绝无效令牌', { skip: typeof WebSocket !== 'function' && '需要 Node.js >= 22' }, async () => {
		const ws = new WebSocket(`ws://127.0.0.1:${sim.port}/ws?token=${encodeURIComponent('u:1:bad')}`)
		const opened = await new Promise(resolve => {
			ws.addEventListener('open', () => resolve(true))
			ws.addEventListener('error', () => resolve(false))
		})
		assert.strictEqual(opened, false)
	})

	await t.test('WebSocket 有效令牌收到遥测推送与 pong', { skip: typeof WebSocket !== 'function' && '需要 Node.js >= 22' }, async () => {
		const token = signWSToken('uid-1', Date.now() + 60000)
		const ws = new WebSocket(`ws://127.0.0.1:${sim.port}/ws?token=${encodeURIComponent(token)}`)
		const seen = await new Promise((resolve, reject) => {
			const types = new Set()
			const timer = setTimeout(() => reject(new Error(`超时，仅收到 ${[...types]}`)), 2000)
			ws.addEventListener('open', () => ws.send(JSON.stringify({ type: 'ping' })))
			ws.addEventListener('message', ev => {
				const msg = JSON.parse(ev.data)
				if (msg.type === 'telemetry') {
					assert.ok(msg.robotCode)
					assert.strictEqual(typeof msg.data.vehicleBattery, 'number')
				}
				types.add(msg.type)
				if (types.has('telemetry') && types.has('pong')) {
					clearTimeout(timer)
					resolve(types)
				}
			})
			ws.addEventListener('error', () => reject(new Error('连接失败')))
		})
		assert.ok(seen.has('telemetry'))
		ws.close()
	})
})
