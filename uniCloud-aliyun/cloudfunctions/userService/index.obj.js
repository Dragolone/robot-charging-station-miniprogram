/**
 * 云对象教程: https://uniapp.dcloud.net.cn/uniCloud/cloud-obj
 *
 * userService（用户相关云对象）
 * - 后续所有“获取用户信息/用户数据查询”等操作统一收口到这里
 * - 安全原则：不信任前端参数；禁止前端传 uid/userId；所有用户数据操作必须基于 token 解密后的 uid
 */
'use strict'

const uniID = require('uni-id-common')
const createConfig = require('uni-config-center')
const db = uniCloud.database()
const dbCmd = db.command
const ONLINE_WINDOW_MS = 15 * 1000
const commandConfig = createConfig({ pluginId: 'telemetry' }).config()

function fail(errMsg, errCode = 1, data = {}) {
	return { errCode, errMsg, ...data }
}

function asNumberOrNull(value) {
	if (value === null || value === undefined || value === '') return null
	const num = Number(value)
	return Number.isNaN(num) ? null : num
}

function asText(value) {
	if (value === null || value === undefined) return ''
	return String(value).trim()
}

function normalizeRobotCode(value) {
	return asText(value)
}

function getCommandBridgeConfig() {
	const root = commandConfig && typeof commandConfig === 'object' ? commandConfig : {}
	const telemetry = root.telemetry && typeof root.telemetry === 'object' ? root.telemetry : {}
	const bridge = telemetry.commandBridge && typeof telemetry.commandBridge === 'object'
		? telemetry.commandBridge
		: root.commandBridge && typeof root.commandBridge === 'object'
			? root.commandBridge
			: {}

	return {
		url: asText(bridge.url || telemetry.commandBridgeUrl || root.commandBridgeUrl),
		timeoutMs: asNumberOrNull(bridge.timeoutMs) || 5000,
		token: asText(bridge.token)
	}
}

function createRequestId(prefix = 'cmd') {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeObjectPayload(payload) {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {}
	return { ...payload }
}

const ALLOWED_COMMAND_TYPES = new Set(['move', 'stop', 'goto'])

function getWSConfig() {
	const root = commandConfig && typeof commandConfig === 'object' ? commandConfig : {}
	const telemetry = root.telemetry && typeof root.telemetry === 'object' ? root.telemetry : {}
	const ws = telemetry.ws && typeof telemetry.ws === 'object' ? telemetry.ws : {}
	return {
		url: asText(ws.url),
		secret: asText(ws.secret)
	}
}

function clampNumber(value, min, max) {
	return Math.min(max, Math.max(min, value))
}

function normalizeCommandPayload(type, payload = {}) {
	const commandType = asText(type)
	const commandPayload = normalizeObjectPayload(payload)

	if (commandType === 'move') {
		// 速度向量模式：{vx, vy, wz}
		const hasVelocity = Object.prototype.hasOwnProperty.call(commandPayload, 'vx') ||
			Object.prototype.hasOwnProperty.call(commandPayload, 'vy') ||
			Object.prototype.hasOwnProperty.call(commandPayload, 'wz')
		if (hasVelocity) {
			const vx = asNumberOrNull(commandPayload.vx) ?? 0
			const vy = asNumberOrNull(commandPayload.vy) ?? 0
			const wz = asNumberOrNull(commandPayload.wz) ?? 0
			const enable = commandPayload.enable === true || commandPayload.enable === false
				? commandPayload.enable : true
			return {
				vx: clampNumber(vx, -1, 1),
				vy: clampNumber(vy, -1, 1),
				wz: clampNumber(wz, -1, 1),
				enable
			}
		}

		// 旧坐标模式：{x, y}（兼容保留）
		const hasXY = Object.prototype.hasOwnProperty.call(commandPayload, 'x') ||
			Object.prototype.hasOwnProperty.call(commandPayload, 'y')
		if (hasXY) {
			const x = asNumberOrNull(commandPayload.x)
			const y = asNumberOrNull(commandPayload.y)
			if (x === null || y === null) {
				throw fail('move 命令需要有效的 x/y 坐标', 400)
			}
			return {
				x: clampNumber(x, -1, 1),
				y: clampNumber(y, -1, 1)
			}
		}

		// 方向字符串模式（兼容保留）
		const direction = asText(commandPayload.direction || commandPayload.cmd)
		if (!['forward', 'backward', 'left', 'right'].includes(direction)) {
			throw fail('move 命令缺少合法 direction 或 velocity', 400)
		}
		return { direction, cmd: direction }
	}

	if (commandType === 'stop') {
		return {}
	}

	if (commandType === 'goto') {
		const x = asNumberOrNull(commandPayload.x)
		const y = asNumberOrNull(commandPayload.y)
		if (x === null || y === null) {
			throw fail('goto 命令需要有效的 x/y 坐标', 400)
		}
		if (x < -10000 || x > 10000 || y < -10000 || y > 10000) {
			throw fail('goto 坐标超出范围（-10000 ~ 10000）', 400)
		}
		return { x, y }
	}

	return commandPayload
}

function inferCommandAction(type, payload = {}) {
	const commandType = asText(type)
	if (commandType === 'move' && (payload.vx !== undefined || payload.vy !== undefined || payload.wz !== undefined)) return 'velocity'
	if (commandType === 'move' && (payload.x !== undefined || payload.y !== undefined)) return 'move'
	if (commandType === 'move') return asText(payload.direction) || 'move'
	if (commandType === 'stop') return 'stop'
	if (commandType === 'goto') return 'goto'
	return commandType || 'unknown'
}

function toBridgeCommand(type, payload = {}) {
	const commandType = asText(type)
	const commandPayload = normalizeObjectPayload(payload)

	if (commandType === 'move') {
		// 速度向量模式 → IoT 直接使用 {vx, vy, wz, enable}
		if (commandPayload.vx !== undefined || commandPayload.vy !== undefined || commandPayload.wz !== undefined) {
			return {
				cmd: 'move',
				params: {
					vx: commandPayload.vx ?? 0,
					vy: commandPayload.vy ?? 0,
					wz: commandPayload.wz ?? 0,
					enable: commandPayload.enable !== false
				}
			}
		}

		if (commandPayload.x !== undefined || commandPayload.y !== undefined) {
			return {
				cmd: 'move',
				params: {
					x: commandPayload.x,
					y: commandPayload.y
				}
			}
		}

		return {
			cmd: 'move',
			params: {
				direction: asText(commandPayload.direction || commandPayload.cmd)
			}
		}
	}

	if (commandType === 'stop') {
		return {
			cmd: 'stop',
			params: { vx: 0, vy: 0, wz: 0, enable: false }
		}
	}

	if (commandType === 'goto') {
		return {
			cmd: 'goto',
			params: {
				x: commandPayload.x,
				y: commandPayload.y
			}
		}
	}

	return {
		cmd: commandType,
		params: commandPayload
	}
}

function parseBridgeResponseData(rawData) {
	if (rawData === null || rawData === undefined) return {}
	if (typeof rawData === 'string') {
		const text = rawData.trim()
		if (!text) return {}
		try {
			return JSON.parse(text)
		} catch (e) {
			return { raw: text }
		}
	}
	if (typeof rawData === 'object') return rawData
	return { raw: String(rawData) }
}

function formatLocationText(x, y) {
	if (x === null && y === null) return '暂无数据'
	return `X: ${x === null ? '-' : x}, Y: ${y === null ? '-' : y}`
}

function getTelemetryTimestamp(raw) {
	if (!raw || typeof raw !== 'object') return null

	const candidates = [
		raw.receivedAt,
		raw.ts,
		raw.lastSeen,
		raw.updateTime,
		raw.updatedAt,
		raw.createTime,
		raw.createdAt
	]
	for (const value of candidates) {
		if (value === null || value === undefined || value === '') continue
		if (typeof value === 'number' && Number.isFinite(value)) return value

		const text = asText(value)
		if (!text) continue

		if (/^\d{10,13}$/.test(text)) {
			const numeric = Number(text)
			return text.length === 10 ? numeric * 1000 : numeric
		}

		const parsed = Date.parse(text)
		if (Number.isFinite(parsed)) return parsed
	}

	return null
}

function inferTaskStatus(raw) {
	const speed = asNumberOrNull(raw?.speed)
	if (speed === null) return ''
	return speed > 0 ? '行驶中' : '待机'
}

function normalizeTelemetryLatest(rawTelemetry, options = {}) {
	const raw = rawTelemetry && typeof rawTelemetry === 'object' ? rawTelemetry : null
	const robotCode = normalizeRobotCode(options.robotCode || raw?.robotCode)
	const vehicleBattery = asNumberOrNull(raw?.vehicleBattery)
	const packBattery = asNumberOrNull(raw?.packBattery)
	const x = asNumberOrNull(raw?.x ?? raw?.location?.x)
	const y = asNumberOrNull(raw?.y ?? raw?.location?.y)
	const telemetryTs = getTelemetryTimestamp(raw)
	const lastOnlineTime = telemetryTs || asText(raw?.receivedAt || raw?.ts || raw?.lastSeen || raw?.updateTime)
	const isOnline = !!telemetryTs && Date.now() - telemetryTs <= ONLINE_WINDOW_MS
	const location = x === null && y === null ? null : { x, y }
	const taskStatus = inferTaskStatus(raw)

	return {
		robotCode,
		isOnline,
		onlineStatusText: isOnline ? '在线' : '离线',
		vehicleBattery,
		packBattery,
		x,
		y,
		locationText: formatLocationText(x, y),
		faultCount: 0,
		lastOnlineTime,
		taskStatus,
		rawTelemetry: raw ? { ...raw } : null,
		// 向后兼容前端已有取值方式
		lastSeen: lastOnlineTime,
		location,
		speed: asNumberOrNull(raw?.speed)
	}
}

module.exports = {
	/**
	 * 通用预处理器：统一鉴权
	 * - 不允许前端传 uid/userId 来获取数据
	 * - 后端通过 token 校验并拿到 uid，后续方法统一使用 this.auth.uid
	 */
	_before: async function () {
		const clientInfo = this.getClientInfo()
		const token = this.getUniIdToken()

		if (!token) {
			throw fail('未登录', 30201)
		}

		const uniIDIns = uniID.createInstance({ clientInfo })
		const tokenRes = await uniIDIns.checkToken(token)
		if (!tokenRes || tokenRes.errCode !== 0 || !tokenRes.uid) {
			throw fail(tokenRes?.message || '登录状态失效', tokenRes?.errCode || 30202)
		}

		// 统一挂载鉴权信息，后续所有用户数据读写必须基于这里的 uid
		this.auth = {
			uid: tokenRes.uid,
			tokenRes
		}
	},

	/**
	 * 通用后处理器：统一错误格式
	 */
	_after: function (error, result) {
		if (error) {
			if (error.errCode) return error
			if (error instanceof Error) {
				return fail('服务异常', 5000)
			}
			throw error
		}
		return result
	},

	/**
	 * 绑定机器人（测试用）
	 * - 使用 this.auth.uid
	 * - 不信任前端 uid/userId 参数（不接收也不使用）
	 */
	async bindRobotForTest(robotCode) {
		const uid = this.auth.uid
		const code = normalizeRobotCode(robotCode)
		if (!code) throw fail('robotCode 不能为空', 400)

		const now = Date.now()

		// 1) 机器人是否存在
		const robotRes = await db.collection('robots').where({ robotCode: code }).limit(1).get()
		if (!robotRes.data || robotRes.data.length === 0) {
			throw fail('robotCode 不存在', 404)
		}

		// 2) 当前 uid 是否已绑定该 robotCode
		const myBindRes = await db
			.collection('robot_bindings')
			.where({ uid, robotCode: code, status: 'active' })
			.limit(1)
			.get()
		if (myBindRes.data && myBindRes.data.length > 0) {
			return {
				alreadyBound: true,
				robotCode: code,
				uid
			}
		}

		// 3) robotCode 是否已被其他 uid 绑定
		const anyBindRes = await db
			.collection('robot_bindings')
			.where({ robotCode: code, status: 'active' })
			.limit(1)
			.get()
		if (anyBindRes.data && anyBindRes.data.length > 0) {
			const exist = anyBindRes.data[0]
			if (exist.uid && exist.uid !== uid) {
				throw fail('该机器人已被其他用户绑定', 409)
			}
		}

		// 4) 创建绑定
		const doc = {
			uid,
			robotCode: code,
			bindTime: now,
			status: 'active',
			source: 'test',
			createTime: now,
			updateTime: now
		}
		const addRes = await db.collection('robot_bindings').add(doc)

		return {
			created: true,
			bindingId: addRes.id,
			robotCode: code,
			uid
		}
	},

	/**
	 * 获取当前登录用户绑定的机器人列表
	 * - 使用 this.auth.uid
	 */
	async listMyRobots() {
		const uid = this.auth.uid

		// 1) 查绑定
		const bindingsRes = await db
			.collection('robot_bindings')
			.where({ uid, status: 'active' })
			.field({ robotCode: true })
			.get()

		const robotCodes = Array.from(
			new Set(
				(bindingsRes.data || [])
					.map((b) => normalizeRobotCode(b.robotCode))
					.filter(Boolean)
			)
		)

		if (robotCodes.length === 0) {
			return { list: [] }
		}

		// 2) 查 robots + telemetry_latest（并行）
		const [robotsRes, telemetryRes] = await Promise.all([
			db.collection('robots').where({ robotCode: dbCmd.in(robotCodes) }).get(),
			db.collection('telemetry_latest').where({ robotCode: dbCmd.in(robotCodes) }).get()
		])
		const robots = robotsRes.data || []
		const robotMap = {}
		robots.forEach((r) => {
			const code = normalizeRobotCode(r?.robotCode)
			if (r && code) robotMap[code] = { ...r, robotCode: code }
		})
		const telemetryMap = {}
		;(telemetryRes.data || []).forEach((t) => {
			const code = normalizeRobotCode(t?.robotCode)
			if (t && code) telemetryMap[code] = { ...t, robotCode: code }
		})

		// 4) 按绑定顺序组装（且只返回属于该 uid 的 robots）
		const list = robotCodes
			.map((code) => {
				const robot = robotMap[code]
				if (!robot) return null
				const normalizedTelemetry = normalizeTelemetryLatest(telemetryMap[code], { robotCode: code })
				return {
					robotCode: code,
					model: robot.model,
					online: normalizedTelemetry.isOnline,
					onlineStatusText: normalizedTelemetry.onlineStatusText,
					location: normalizedTelemetry.location || robot.location || null,
					lastOnlineTime: normalizedTelemetry.lastOnlineTime,
					telemetry_latest: normalizedTelemetry,
					faultCount: 0
				}
			})
			.filter(Boolean)

		return { list }
	},

	/**
	 * 获取当前用户的机器人详情
	 * - 使用 this.auth.uid
	 * - 先校验 robotCode 是否属于当前 uid
	 */
	async getMyRobotDetail(robotCode) {
		const uid = this.auth.uid
		const code = normalizeRobotCode(robotCode)
		if (!code) throw fail('robotCode 不能为空', 400)

		// 1) 校验归属
		const bindRes = await db
			.collection('robot_bindings')
			.where({ uid, robotCode: code, status: 'active' })
			.limit(1)
			.get()
		if (!bindRes.data || bindRes.data.length === 0) {
			throw fail('无权限访问该机器人', 403)
		}

		// 2) 取 robot + telemetry_latest（并行）
		const [robotRes, telemetryRes] = await Promise.all([
			db.collection('robots').where({ robotCode: code }).limit(1).get(),
			db.collection('telemetry_latest').where({ robotCode: code }).orderBy('ts', 'desc').limit(1).get()
		])
		const robot = robotRes.data && robotRes.data.length ? robotRes.data[0] : null
		if (!robot) throw fail('robotCode 不存在', 404)
		const telemetry_latest =
			telemetryRes.data && telemetryRes.data.length ? telemetryRes.data[0] : null
		const normalizedTelemetry = normalizeTelemetryLatest(telemetry_latest, { robotCode: code })

		return {
			robot: {
				...robot,
				robotCode: code,
				online: normalizedTelemetry.isOnline,
				location: normalizedTelemetry.location || robot.location || null
			},
			telemetry_latest: normalizedTelemetry,
			faults: []
		}
	},

	/**
	 * 发送机器人控制命令
	 * - 只允许操作当前 uid 已绑定的机器人
	 * - 仅允许机器人在线时下发
	 * - 先写 commands(status=pending)，再调用 command-bridge，最后回写 sent/failed
	 */
	async sendCommand(data = {}) {
		const uid = this.auth.uid
		const payload = data && typeof data === 'object' ? data : {}
		const code = normalizeRobotCode(payload.robotCode)
		const type = asText(payload.type)
		if (!code) throw fail('robotCode 不能为空', 400)
		if (!type) throw fail('type 不能为空', 400)
		if (!ALLOWED_COMMAND_TYPES.has(type)) throw fail(`不支持的命令类型: ${type}`, 400)

		const incomingPayload = normalizeObjectPayload(payload.payload)
		const incomingParams = normalizeObjectPayload(payload.params)
		const compatiblePayload = {
			...incomingParams,
			...incomingPayload
		}
		if (type === 'move' && !compatiblePayload.direction) {
			compatiblePayload.direction = asText(
				compatiblePayload.direction || payload.direction || payload.cmd
			)
		}
		if (type === 'move' && !compatiblePayload.cmd) {
			compatiblePayload.cmd = asText(
				compatiblePayload.cmd || payload.cmd || payload.direction
			)
		}

		const commandPayload = normalizeCommandPayload(type, compatiblePayload)

		// 1) 绑定校验 与 2) 在线校验 查询可并行，减少一轮串行等待
		const bindPromise = db
			.collection('robot_bindings')
			.where({ uid, robotCode: code, status: 'active' })
			.limit(1)
			.get()
		const telemetryPromise = db
			.collection('telemetry_latest')
			.where({ robotCode: code })
			.orderBy('ts', 'desc')
			.limit(1)
			.get()
		const [bindRes, telemetryRes] = await Promise.all([bindPromise, telemetryPromise])
		if (!bindRes.data || bindRes.data.length === 0) {
			throw fail('无权限操作该机器人', 403)
		}

		// 2) 校验机器人是否在线
		const telemetryLatest =
			telemetryRes.data && telemetryRes.data.length ? telemetryRes.data[0] : null
		const normalizedTelemetry = normalizeTelemetryLatest(telemetryLatest, { robotCode: code })
		if (!normalizedTelemetry.isOnline) {
			throw fail('机器人当前离线，无法下发命令', 409)
		}

		const now = Date.now()
		const requestId = createRequestId()
		const action = inferCommandAction(type, commandPayload)

		// 3) 写入 commands(status=pending)
		const commandDoc = {
			uid,
			robotCode: code,
			type,
			action,
			params: commandPayload,
			payload: commandPayload,
			requestId,
			status: 'pending',
			source: 'miniapp',
			ts: now,
			createTime: now,
			updateTime: now
		}
		const addRes = await db.collection('commands').add(commandDoc)
		const commandId = addRes.id

		const { url, timeoutMs, token: commandToken } = getCommandBridgeConfig()
		const bridgeCommand = toBridgeCommand(type, commandPayload)
		const bridgeRequestBody = {
			requestId,
			commandId,
			robotCode: code,
			cmd: bridgeCommand.cmd,
			params: bridgeCommand.params,
			ts: now
		}

		if (!url) {
			const errorMessage = '未配置 command-bridge URL'
			await db.collection('commands').doc(commandId).update({
				status: 'failed',
				errorMessage,
				updateTime: Date.now()
			})
			throw fail(errorMessage, 500, { commandId, requestId, status: 'failed' })
		}

		if (!commandToken) {
			const errorMessage = '服务端未配置 x-command-token'
			await db.collection('commands').doc(commandId).update({
				status: 'failed',
				errorMessage,
				updateTime: Date.now()
			})
			throw fail(errorMessage, 500, { commandId, requestId, status: 'failed' })
		}

		// 4) 调用 command-bridge HTTP 接口
		try {
			const httpRes = await uniCloud.httpclient.request(url, {
				method: 'POST',
				contentType: 'json',
				dataType: 'json',
				timeout: timeoutMs,
				headers: {
					'x-command-token': commandToken
				},
				data: bridgeRequestBody
			})

			const bridgeData = parseBridgeResponseData(httpRes && httpRes.data)
			const bridgeCode = asNumberOrNull(bridgeData.code)
			const bridgeMessage = asText(bridgeData.msg || bridgeData.message)
			const httpStatus = asNumberOrNull(httpRes && httpRes.status)

			if (bridgeCode === 0) {
				// 5) command-bridge 返回成功，更新 commands.status = sent
				await db.collection('commands').doc(commandId).update({
					status: 'sent',
					sentTime: Date.now(),
					bridgeHttpStatus: httpStatus,
					bridgeCode,
					bridgeMessage,
					updateTime: Date.now()
				})

				return {
					ok: true,
					commandId,
					requestId,
					robotCode: code,
					type,
					status: 'sent',
					bridge: {
						httpStatus,
						code: bridgeCode,
						message: bridgeMessage,
						data: bridgeData
					}
				}
			}

			// 6) command-bridge 返回失败，更新 commands.status = failed
			const errorMessage = bridgeMessage || 'command-bridge 返回失败'
			await db.collection('commands').doc(commandId).update({
				status: 'failed',
				errorMessage,
				bridgeHttpStatus: httpStatus,
				bridgeCode,
				bridgeMessage,
				bridgeResponse: bridgeData,
				updateTime: Date.now()
			})

			throw fail(errorMessage, 500, {
				commandId,
				requestId,
				robotCode: code,
				type,
				status: 'failed',
				bridge: {
					httpStatus,
					code: bridgeCode,
					message: bridgeMessage,
					data: bridgeData
				}
			})
		} catch (error) {
			if (error && error.errCode) throw error

			const errorMessage = asText(error && error.message) || '调用 command-bridge 失败'
			await db.collection('commands').doc(commandId).update({
				status: 'failed',
				errorMessage,
				updateTime: Date.now()
			})

			throw fail(errorMessage, 500, {
				commandId,
				requestId,
				robotCode: code,
				type,
				status: 'failed'
			})
		}
	},

	/**
	 * 获取当前登录用户信息（开发调试用）
	 * - 必须基于 this.auth.uid
	 */
	async getMyProfile() {
		const uid = this.auth.uid
		const res = await db
			.collection('uni-id-users')
			.where({ _id: uid })
			.field({
				username: true,
				nickname: true,
				avatar: true
				// mobile: true  // 暂时屏蔽，待接入微信隐私授权合规流程后恢复
			})
			.limit(1)
			.get()

		const user = res.data && res.data.length ? res.data[0] : null

		return {
			uid,
			username: user?.username || '',
			nickname: user?.nickname || '',
			avatar: user?.avatar || ''
			// mobile: user?.mobile || ''  // 暂时屏蔽
		}
	},

	/**
	 * 更新当前登录用户资料
	 * - 仅允许修改 nickname / avatar
	 * - 必须基于 this.auth.uid，禁止前端传 uid 指定他人
	 */
	async updateMyProfile(data = {}) {
		const uid = this.auth.uid
		const payload = data && typeof data === 'object' ? data : {}

		if (payload.uid || payload.userId || payload._id) {
			// 明确拒绝“试图指定 uid”的行为
			throw fail('不允许指定 uid 更新资料', 403)
		}

		const updateDoc = {
			updateTime: Date.now()
		}
		const responseData = {
			ok: true,
			uid
		}
		let hasUpdatableField = false

		if (Object.prototype.hasOwnProperty.call(payload, 'nickname')) {
			let nickname = payload.nickname
			if (typeof nickname !== 'string') nickname = String(nickname ?? '')
			nickname = nickname.trim()
			if (!nickname) throw fail('昵称不能为空', 400)
			if (nickname.length < 1 || nickname.length > 20) {
				throw fail('昵称长度需为 1~20', 400)
			}
			updateDoc.nickname = nickname
			responseData.nickname = nickname
			hasUpdatableField = true
		}

		if (Object.prototype.hasOwnProperty.call(payload, 'avatar')) {
			let avatar = payload.avatar
			if (typeof avatar !== 'string') avatar = String(avatar ?? '')
			avatar = avatar.trim()
			if (avatar) {
				updateDoc.avatar = avatar
				responseData.avatar = avatar
				hasUpdatableField = true
			}
		}

		if (!hasUpdatableField) {
			throw fail('未提供可更新的资料字段', 400)
		}

		await db.collection('uni-id-users').doc(uid).update(updateDoc)

		return responseData
	},
	/**
	 * 注册后保存邮箱（用于找回密码）
	 * - 仅写入当前用户，不允许指定他人
	 */
	async saveEmail(email) {
		const uid = this.auth.uid
		if (!email || typeof email !== 'string') throw fail('邮箱不能为空', 400)
		const trimmed = email.trim().toLowerCase()
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) throw fail('邮箱格式不正确', 400)

		await db.collection('uni-id-users').doc(uid).update({
			email: trimmed,
			email_confirmed: 1,
			updateTime: Date.now()
		})
		return { ok: true }
	},

	/**
	 * 解绑机器人
	 * - 将 robot_bindings 中对应记录的 status 改为 'inactive'
	 * - 仅允许解绑自己绑定的机器人
	 */
	async unbindRobot(robotCode) {
		const uid = this.auth.uid
		const code = normalizeRobotCode(robotCode)
		if (!code) throw fail('robotCode 不能为空', 400)

		const bindRes = await db
			.collection('robot_bindings')
			.where({ uid, robotCode: code, status: 'active' })
			.limit(1)
			.get()

		if (!bindRes.data || bindRes.data.length === 0) {
			throw fail('未找到该机器人的绑定记录', 404)
		}

		const bindingId = bindRes.data[0]._id
		await db.collection('robot_bindings').doc(bindingId).update({
			status: 'inactive',
			unbindTime: Date.now(),
			updateTime: Date.now()
		})

		return {
			success: true,
			robotCode: code,
			uid
		}
	},

	/**
	 * 测试连通性（仅用于开发阶段）
	 * - 前端可调用
	 * - 会自动触发 _before（鉴权）
	 */
	async ping() {
		return {
		ok: true,
		uid: this.auth.uid
		}
	},

	/**
	 * 获取 WebSocket 连接令牌（HMAC 签名，1 小时有效）
	 * 前端拿到后用于连接 IoT Gateway /ws 端点
	 */
	async getWSToken() {
		const uid = this.auth.uid
		const crypto = require('crypto')
		const wsConfig = getWSConfig()
		if (!wsConfig.secret) throw fail('未配置 WebSocket 密钥', 500)
		if (!wsConfig.url) throw fail('未配置 WebSocket 地址', 500)

		const expiresAt = Date.now() + 3600000
		const payload = `${uid}:${expiresAt}`
		const signature = crypto.createHmac('sha256', wsConfig.secret).update(payload).digest('hex')

		return {
			url: wsConfig.url,
			token: `${uid}:${expiresAt}:${signature}`,
			expiresAt
		}
	}
}

