import { reactive } from 'vue'
import { isLoggedIn } from '@/utils/auth.js'

const LIST_MIN_REQUEST_INTERVAL_MS = 3 * 1000
const AUTO_REFRESH_INTERVAL_MS = 10 * 1000

let _userService = null
function getUserService() {
	if (!_userService) {
		_userService = uniCloud.importObject('userService', {
			customUI: true,
			errorOptions: { type: 'toast' }
		})
	}
	return _userService
}

export const robotListState = reactive({
	list: [],
	loaded: false,
	loading: false,
	lastFetchedAt: 0,
	lastRequestedAt: 0,
	inflight: null
})

// WebSocket 连接状态（UI 可直接绑定）
// mode: 'live' = WS 实时推送 | 'polling' = HTTP 10s 轮询 | 'idle' = 未登录/初始
export const wsState = reactive({
	active: false,
	mode: 'idle'
})

export function clearRobotListState() {
	robotListState.list = []
	robotListState.loaded = false
	robotListState.loading = false
	robotListState.lastFetchedAt = 0
	robotListState.lastRequestedAt = 0
	robotListState.inflight = null
	wsState.active = false
	wsState.mode = 'idle'
}

function normalizeRobotItem(item) {
	const telemetry = item.telemetry_latest || {}
	return {
		robotCode: String(item.robotCode || '').trim(),
		model: item.model,
		online: !!item.online,
		onlineStatusText: item.onlineStatusText || (item.online ? '工作中' : '离线'),
		location: item.location || telemetry.location || null,
		vehicleBattery: telemetry.vehicleBattery,
		packBattery: telemetry.packBattery,
		lastOnlineTime: telemetry.lastOnlineTime || item.lastOnlineTime || telemetry.lastSeen,
		faultCount: item.faultCount || 0
	}
}

export async function fetchRobotList(options = {}) {
	const { force = false } = options

	if (!isLoggedIn()) {
		clearRobotListState()
		return []
	}

	if (robotListState.inflight) return robotListState.inflight

	const now = Date.now()
	if (!force && robotListState.loaded) {
		if (
			robotListState.lastRequestedAt &&
			now - robotListState.lastRequestedAt < LIST_MIN_REQUEST_INTERVAL_MS
		) {
			return robotListState.list
		}
	}

	robotListState.loading = true
	robotListState.lastRequestedAt = now

	robotListState.inflight = getUserService().listMyRobots()
		.then((data) => {
			const rawList = (data && data.list) || []
			robotListState.list = rawList.map(normalizeRobotItem)
			robotListState.loaded = true
			robotListState.lastFetchedAt = Date.now()
			return robotListState.list
		})
		.catch((e) => {
			if (!robotListState.loaded) robotListState.list = []
			throw e
		})
		.finally(() => {
			robotListState.loading = false
			robotListState.inflight = null
		})

	return robotListState.inflight
}

// WS/polling coordination: WS 活跃时轮询自动让位
let _wsActive = false

export function setWSActive(active) {
	_wsActive = !!active
	wsState.active = _wsActive
	wsState.mode = _wsActive ? 'live' : (isLoggedIn() ? 'polling' : 'idle')
	if (_wsActive) stopAutoRefresh()
}

let refreshTimer = null

export function startAutoRefresh(options = {}) {
	if (_wsActive) return
	stopAutoRefresh()
	if (wsState.mode !== 'live') {
		wsState.mode = isLoggedIn() ? 'polling' : 'idle'
	}
	if (options.immediate) {
		fetchRobotList({ force: true }).catch(() => {})
	}
	refreshTimer = setInterval(() => {
		fetchRobotList().catch(() => {})
	}, AUTO_REFRESH_INTERVAL_MS)
}

export function stopAutoRefresh() {
	if (refreshTimer) {
		clearInterval(refreshTimer)
		refreshTimer = null
	}
}
