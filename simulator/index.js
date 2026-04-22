/**
 * Phase 6：低频、省资源的数据模拟器（本地脚本）
 *
 * 目标集合（不改结构，只写入/更新必要字段）：
 * - robots
 * - telemetry_latest
 * - faults
 * - commands
 *
 * 运行方式：
 *   cd simulator
 *   cp config.example.json config.json
 *   npm i
 *   npm run start
 */

'use strict'

const fs = require('fs')
const path = require('path')

// 依赖：uniCloud 官方 server sdk
// npm 包名历史上有差异：优先使用 @dcloudio scope，兼容旧名（如你有私有源/旧项目）
let uniCloud
try {
	uniCloud = require('@dcloudio/uni-cloud-server-sdk')
} catch (e) {
	uniCloud = require('uni-cloud-server-sdk')
}

function now() {
	return Date.now()
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function randFloat(min, max) {
	return min + Math.random() * (max - min)
}

function randInt(min, max) {
	return Math.floor(min + Math.random() * (max - min + 1))
}

function pick(arr) {
	return arr[Math.floor(Math.random() * arr.length)]
}

function clamp(v, min, max) {
	return Math.max(min, Math.min(max, v))
}

function roundTo(v, decimals) {
	const p = Math.pow(10, decimals)
	return Math.round(v * p) / p
}

function loadJson(filePath) {
	const raw = fs.readFileSync(filePath, 'utf8')
	return JSON.parse(raw)
}

function getArgValue(argv, name) {
	const idx = argv.indexOf(name)
	if (idx === -1) return null
	return argv[idx + 1] || null
}

function logFactory(level) {
	const levels = { debug: 10, info: 20, warn: 30, error: 40 }
	const cur = levels[level] || levels.info
	const can = l => (levels[l] || 999) >= cur

	return {
		debug: (...a) => (can('debug') ? console.log('[debug]', ...a) : undefined),
		info: (...a) => (can('info') ? console.log('[info]', ...a) : undefined),
		warn: (...a) => (can('warn') ? console.warn('[warn]', ...a) : undefined),
		error: (...a) => (can('error') ? console.error('[error]', ...a) : undefined)
	}
}

/**
 * telemetry_latest 写入策略：
 * - 每台机器人维持内存缓存 state（电量、位置）
 * - 每 10–15 秒（可配置）生成小幅变化
 * - 若变化在“舍入后”仍相同，则跳过写库（省资源）
 * - upsert：先 update(where robotCode)，若 matched=0 再 add（仅首次）
 */

async function main() {
	const argv = process.argv.slice(2)
	const configPath =
		getArgValue(argv, '--config') ||
		process.env.SIM_CONFIG ||
		path.join(__dirname, 'config.json')

	if (!fs.existsSync(configPath)) {
		console.error(
			`找不到配置文件：${configPath}\n请先：cp config.example.json config.json 并填写 spaceId/clientSecret`
		)
		process.exit(1)
	}

	const cfg = loadJson(configPath)
	const log = logFactory((cfg.log && cfg.log.level) || 'info')

	if (!cfg.spaceId || !cfg.clientSecret) {
		console.error('配置缺失：spaceId / clientSecret 必填')
		process.exit(1)
	}

	uniCloud.init({
		provider: cfg.provider || 'aliyun',
		spaceId: cfg.spaceId,
		clientSecret: cfg.clientSecret
	})

	const db = uniCloud.database()
	const cmd = db.command

	log.info('模拟器启动', {
		spaceId: cfg.spaceId,
		provider: cfg.provider || 'aliyun'
	})

	// ---- 内存缓存 ----
	let robots = [] // [{robotCode, ...}]
	const telemetryState = new Map() // robotCode -> {vehicleBattery, packBattery, x, y, lastWritten}
	const processingCommands = new Set() // commandId

	async function refreshRobots() {
		try {
			const res = await db.collection('robots').field({ robotCode: true }).get()
			robots = (res.data || []).filter(r => r.robotCode)
			log.info('robots 刷新', { count: robots.length })
		} catch (e) {
			log.error('robots 刷新失败', e && e.message ? e.message : e)
		}
	}

	async function seedTelemetryStateOnce() {
		// 一次性拉取现有 telemetry_latest 作为种子，减少后续读库
		if (!robots.length) return
		try {
			const robotCodes = robots.map(r => r.robotCode)
			const res = await db
				.collection('telemetry_latest')
				.where({ robotCode: cmd.in(robotCodes) })
				.field({
					robotCode: true,
					vehicleBattery: true,
					packBattery: true,
					location: true
				})
				.get()

			for (const doc of res.data || []) {
				const loc = doc.location || {}
				telemetryState.set(doc.robotCode, {
					vehicleBattery:
						typeof doc.vehicleBattery === 'number' ? doc.vehicleBattery : randFloat(40, 95),
					packBattery: typeof doc.packBattery === 'number' ? doc.packBattery : randFloat(40, 95),
					x: typeof loc.x === 'number' ? loc.x : randFloat(120.0, 121.0),
					y: typeof loc.y === 'number' ? loc.y : randFloat(30.0, 31.0),
					lastWritten: 0
				})
			}

			// 没有 telemetry 的机器人补默认
			for (const r of robots) {
				if (!telemetryState.has(r.robotCode)) {
					telemetryState.set(r.robotCode, {
						vehicleBattery: randFloat(40, 95),
						packBattery: randFloat(40, 95),
						x: randFloat(120.0, 121.0),
						y: randFloat(30.0, 31.0),
						lastWritten: 0
					})
				}
			}

			log.info('telemetry 状态已初始化', { count: telemetryState.size })
		} catch (e) {
			log.error('telemetry 初始化失败', e && e.message ? e.message : e)
		}
	}

	function schedule(fn, minMs, maxMs) {
		const ms = randInt(minMs, maxMs)
		setTimeout(fn, ms)
		return ms
	}

	async function upsertTelemetry(robotCode, doc) {
		// 尽量少写：update 成功则结束，否则 add（仅首次）
		const updateRes = await db.collection('telemetry_latest').where({ robotCode }).update(doc)
		const updated = updateRes && (updateRes.updated || updateRes.modified || updateRes.matched)
		// uniCloud 各环境返回字段不完全一致，这里做容错：如果没有更新任何条目则 add
		if (updated === 0) {
			await db.collection('telemetry_latest').add({ robotCode, ...doc })
		}
	}

	async function telemetryTick(robotCode) {
		const tcfg = cfg.telemetry
		const state = telemetryState.get(robotCode)
		if (!state) return

		// 电量 ±0.1~0.3（舍入到 1 位小数后可能不变）
		const vbDelta = (Math.random() < 0.5 ? -1 : 1) * randFloat(tcfg.batteryDeltaMin, tcfg.batteryDeltaMax)
		const pbDelta = (Math.random() < 0.5 ? -1 : 1) * randFloat(tcfg.batteryDeltaMin, tcfg.batteryDeltaMax)
		const nextVB = roundTo(clamp(state.vehicleBattery + vbDelta, 0, 100), tcfg.batteryDecimals)
		const nextPB = roundTo(clamp(state.packBattery + pbDelta, 0, 100), tcfg.batteryDecimals)

		// 位置随机游走
		const xStep = (Math.random() < 0.5 ? -1 : 1) * randFloat(tcfg.xyStepMin, tcfg.xyStepMax)
		const yStep = (Math.random() < 0.5 ? -1 : 1) * randFloat(tcfg.xyStepMin, tcfg.xyStepMax)
		const nextX = roundTo(state.x + xStep, tcfg.xyDecimals)
		const nextY = roundTo(state.y + yStep, tcfg.xyDecimals)

		const changed =
			nextVB !== roundTo(state.vehicleBattery, tcfg.batteryDecimals) ||
			nextPB !== roundTo(state.packBattery, tcfg.batteryDecimals) ||
			nextX !== roundTo(state.x, tcfg.xyDecimals) ||
			nextY !== roundTo(state.y, tcfg.xyDecimals)

		if (!changed) {
			log.debug('telemetry 未变化，跳过写库', { robotCode })
		} else {
			const ts = now()
			const doc = {
				vehicleBattery: nextVB,
				packBattery: nextPB,
				location: { x: nextX, y: nextY },
				lastSeen: new Date(ts).toISOString(),
				ts,
				updateTime: ts
			}

			try {
				await upsertTelemetry(robotCode, doc)
				state.vehicleBattery = nextVB
				state.packBattery = nextPB
				state.x = nextX
				state.y = nextY
				state.lastWritten = ts
				log.info('telemetry 已更新', { robotCode, vehicleBattery: nextVB, packBattery: nextPB, x: nextX, y: nextY })
			} catch (e) {
				log.error('telemetry 写入失败', { robotCode, err: e && e.message ? e.message : e })
			}
		}

		// 继续调度下一次
		schedule(() => telemetryTick(robotCode), tcfg.intervalMinMs, tcfg.intervalMaxMs)
	}

	async function faultTryTick() {
		const fcfg = cfg.fault
		try {
			if (!robots.length) {
				log.warn('faultTry: robots 为空，跳过')
			} else if (Math.random() < fcfg.probability) {
				const robotCode = pick(robots).robotCode
				const ts = now()
				const level = pick(['info', 'warn', 'error'])
				const message = pick([
					'轻微偏航，已自动校正',
					'通信抖动，延迟升高',
					'电池温度偏高，请关注',
					'避障触发，临时停车',
					'定位漂移，正在重定位'
				])

				// 不改既有结构：写入最少字段；额外带 ts 便于索引 robotCode+ts
				await db.collection('faults').add({
					robotCode,
					level,
					message,
					createdAt: ts,
					ts
				})
				log.warn('fault 已生成', { robotCode, level, message })
			} else {
				log.debug('faultTry: 本轮未命中概率，跳过写库')
			}
		} catch (e) {
			log.error('faultTry 失败', e && e.message ? e.message : e)
		}

		schedule(faultTryTick, fcfg.tryIntervalMinMs, fcfg.tryIntervalMaxMs)
	}

	async function commandPollTick() {
		const ccfg = cfg.command
		const pollDelay = randInt(ccfg.pollIntervalMinMs, ccfg.pollIntervalMaxMs)

		try {
			const res = await db
				.collection('commands')
				.where({ status: 'pending' })
				.orderBy('ts', 'asc')
				.limit(ccfg.fetchLimit || 20)
				.get()

			const pending = res.data || []
			if (pending.length === 0) {
				log.debug('commands: 无 pending，跳过写库')
				setTimeout(commandPollTick, pollDelay)
				return
			}

			log.info('commands: 拉到 pending', { count: pending.length })

			for (const cmdDoc of pending) {
				const id = cmdDoc._id
				if (!id || processingCommands.has(id)) continue
				processingCommands.add(id)

				// 异步执行，不阻塞下次 poll
				;(async () => {
					try {
						const execDelay = randInt(ccfg.executeDelayMinMs, ccfg.executeDelayMaxMs)
						await sleep(execDelay)

						const ok = Math.random() < (ccfg.completeProbability || 0.85)
						const status = ok ? 'completed' : 'failed'
						const ts = now()
						const message = ok ? 'ACK: 模拟执行成功' : 'ACK: 模拟执行失败'

						// 只更新仍为 pending 的记录（避免并发重复消费）
						const updateRes = await db
							.collection('commands')
							.where({ _id: id, status: 'pending' })
							.update({
								status,
								ackAt: ts,
								message,
								updateTime: ts
							})

						const updated = updateRes && (updateRes.updated || updateRes.modified || updateRes.matched)
						if (updated === 0) {
							log.debug('commands: 记录已被其他消费者处理，跳过', { id })
						} else {
							log.info('commands: 已消费', { id, status })
						}
					} catch (e) {
						log.error('commands: 消费失败', { id, err: e && e.message ? e.message : e })
					} finally {
						processingCommands.delete(id)
					}
				})()
			}
		} catch (e) {
			log.error('commands: poll 失败', e && e.message ? e.message : e)
		}

		setTimeout(commandPollTick, pollDelay)
	}

	// 启动流程：robots -> telemetry seed -> 各循环
	await refreshRobots()
	await seedTelemetryStateOnce()

	// 周期性刷新 robots（尽量低频）
	if (cfg.robotsRefreshMs && cfg.robotsRefreshMs > 0) {
		setInterval(async () => {
			await refreshRobots()
			// 新增机器人补种子
			for (const r of robots) {
				if (!telemetryState.has(r.robotCode)) {
					telemetryState.set(r.robotCode, {
						vehicleBattery: randFloat(40, 95),
						packBattery: randFloat(40, 95),
						x: randFloat(120.0, 121.0),
						y: randFloat(30.0, 31.0),
						lastWritten: 0
					})
					log.info('telemetry 新机器人补种子', { robotCode: r.robotCode })
					// 立刻安排 telemetry 循环
					schedule(() => telemetryTick(r.robotCode), cfg.telemetry.intervalMinMs, cfg.telemetry.intervalMaxMs)
				}
			}
		}, cfg.robotsRefreshMs)
	}

	// telemetry：每台机器人一个独立随机间隔循环（低频）
	for (const r of robots) {
		schedule(() => telemetryTick(r.robotCode), cfg.telemetry.intervalMinMs, cfg.telemetry.intervalMaxMs)
	}

	// faults：全局低频尝试
	schedule(faultTryTick, cfg.fault.tryIntervalMinMs, cfg.fault.tryIntervalMaxMs)

	// commands：轮询 pending + 异步消费
	schedule(commandPollTick, cfg.command.pollIntervalMinMs, cfg.command.pollIntervalMaxMs)

	log.info('模拟器已进入循环（保持进程运行）')
}

main().catch(err => {
	console.error('模拟器启动失败:', err)
	process.exit(1)
})

