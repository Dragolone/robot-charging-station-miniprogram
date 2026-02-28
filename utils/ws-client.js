/**
 * WebSocket 实时推送客户端
 *
 * 与 IoT Gateway 的 /ws 端点通信，接收机器人遥测数据。
 * 连接前从 userService.getWSToken() 获取 HMAC 签名令牌（不硬编码密钥）。
 * 断线时自动降级为 HTTP 轮询，重连后恢复实时推送。
 */

import { isLoggedIn } from './auth.js'
import { robotListState, setWSActive, startAutoRefresh } from './robot-store.js'

const HEARTBEAT_MS = 25000
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

let socketTask = null
let heartbeatTimer = null
let reconnectTimer = null
let reconnectAttempt = 0
let manualClose = false

let _wsConfig = null
let _userService = null

function getUserService() {
	if (!_userService) {
		_userService = uniCloud.importObject('userService', { customUI: true })
	}
	return _userService
}

async function fetchWSConfig() {
	const res = await getUserService().getWSToken()
	_wsConfig = res
	return res
}

function isTokenValid() {
	return _wsConfig && _wsConfig.token && _wsConfig.url &&
		_wsConfig.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS
}

export async function connectWS() {
	if (!isLoggedIn()) return
	if (socketTask) return

	manualClose = false

	try {
		if (!isTokenValid()) {
			await fetchWSConfig()
		}
	} catch (e) {
		if (reconnectAttempt < 3) {
			console.error('[ws] 获取 token 失败:', e)
		}
		if (reconnectAttempt >= 5) return
		scheduleReconnect()
		return
	}

	const url = `${_wsConfig.url}?token=${encodeURIComponent(_wsConfig.token)}`

	socketTask = uni.connectSocket({ url, success() {}, fail(err) {
		console.error('[ws] 连接失败:', err)
		socketTask = null
		scheduleReconnect()
	}})

	if (!socketTask) return

	socketTask.onOpen(() => {
		console.log('[ws] 已连接')
		reconnectAttempt = 0
		startHeartbeat()
		setWSActive(true)
	})

	socketTask.onMessage(({ data }) => {
		handleMessage(data)
	})

	socketTask.onClose(() => {
		console.log('[ws] 已断开')
		cleanup()
		socketTask = null
		setWSActive(false)
		// 自然断开：立刻降级为 HTTP 轮询 + 立即拉一次补全 UI + 调度重连
		// 手动关闭（登出 / App 切后台）：不触发轮询和重连
		if (!manualClose) {
			startAutoRefresh({ immediate: true })
			scheduleReconnect()
		}
	})

	socketTask.onError((err) => {
		console.error('[ws] 错误:', err)
	})
}

export function disconnectWS() {
	manualClose = true
	cleanup()
	if (socketTask) {
		try { socketTask.close({}) } catch (e) {}
		socketTask = null
	}
}

export function clearWSConfig() {
	_wsConfig = null
}

export function isWSConnected() {
	return socketTask !== null && !manualClose
}

function cleanup() {
	if (heartbeatTimer) {
		clearInterval(heartbeatTimer)
		heartbeatTimer = null
	}
	if (reconnectTimer) {
		clearTimeout(reconnectTimer)
		reconnectTimer = null
	}
}

function startHeartbeat() {
	if (heartbeatTimer) clearInterval(heartbeatTimer)
	heartbeatTimer = setInterval(() => {
		if (!socketTask) return
		try {
			socketTask.send({ data: JSON.stringify({ type: 'ping' }) })
		} catch (e) {}
	}, HEARTBEAT_MS)
}

function scheduleReconnect() {
	if (manualClose) return
	if (reconnectTimer) return
	const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)]
	reconnectAttempt++
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null
		socketTask = null
		connectWS()
	}, delay)
}

function handleMessage(raw) {
	let msg
	try {
		msg = JSON.parse(raw)
	} catch (e) {
		return
	}
	if (msg.type === 'telemetry') {
		applyTelemetryUpdate(msg)
	}
}

function applyTelemetryUpdate(msg) {
	const robotCode = String(msg.robotCode || '').trim()
	if (!robotCode) return

	const data = msg.data || {}
	const idx = robotListState.list.findIndex(r => r.robotCode === robotCode)
	if (idx === -1) return

	const current = robotListState.list[idx]
	const updated = { ...current }

	if (data.vehicleBattery !== undefined && data.vehicleBattery !== null)
		updated.vehicleBattery = data.vehicleBattery
	if (data.packBattery !== undefined && data.packBattery !== null)
		updated.packBattery = data.packBattery
	if (data.speed !== undefined)
		updated.speed = data.speed

	updated.online = true
	updated.onlineStatusText = '工作中'
	if (data.ts) updated.lastOnlineTime = data.ts

	robotListState.list[idx] = updated
	robotListState.lastFetchedAt = Date.now()
}
