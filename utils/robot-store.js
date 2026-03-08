import { reactive } from 'vue'
import { isLoggedIn } from '@/utils/auth.js'

const LIST_MIN_REQUEST_INTERVAL_MS = 3 * 1000
const AUTO_REFRESH_INTERVAL_MS = 10 * 1000
const DETAIL_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const DETAIL_CACHE_MAX_SIZE = 20

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
	inflight: null,
	lastResponseJSON: ''
})

// WebSocket 连接状态（UI 可直接绑定）
// mode: 'live' = WS 实时推送 | 'polling' = HTTP 10s 轮询 | 'idle' = 未登录/初始
export const wsState = reactive({
	active: false,
	mode: 'idle'
})

// Detail cache: robotCode -> { data, fetchedAt }
const detailCache = {}

export function clearRobotListState() {
	robotListState.list = []
	robotListState.loaded = false
	robotListState.loading = false
	robotListState.lastFetchedAt = 0
	robotListState.lastRequestedAt = 0
	robotListState.inflight = null
	robotListState.lastResponseJSON = ''
	wsState.active = false
	wsState.mode = 'idle'
	Object.keys(detailCache).forEach(k => delete detailCache[k])
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
	if (!force && robotListState.loaded && robotListState.list.length >= 0) {
		if (
			robotListState.lastRequestedAt &&
			now - robotListState.lastRequestedAt < LIST_MIN_REQUEST_INTERVAL_MS
		) {
			return robotListState.list
		}
	}

	robotListState.loading = true
	robotListState.lastRequestedAt = now

	async function callWithRetry() {
		try {
			return await getUserService().listMyRobots()
		} catch (e) {
			const isTimeout = e && /timeout/i.test(String(e.message || e.errMsg || ''))
			if (isTimeout) {
				// 冷启动 timeout，静默重试一次
				try {
					return await getUserService().listMyRobots()
				} catch (_) {
					// 重试仍失败，静默返回 null（保留现有列表，等自动刷新恢复）
					return null
				}
			}
			throw e
		}
	}

	robotListState.inflight = callWithRetry()
		.then((data) => {
			// timeout 静默返回 null 时，跳过更新，保留现有数据
			if (data === null) return robotListState.list

			const rawList = (data && data.list) || []
			const mapped = rawList.map(normalizeRobotItem)
			const json = JSON.stringify(mapped)

			// Diff check: only trigger Vue reactivity if data actually changed
			if (json !== robotListState.lastResponseJSON) {
				robotListState.list = mapped
				robotListState.lastResponseJSON = json
			}

			robotListState.loaded = true
			robotListState.lastFetchedAt = Date.now()
			return robotListState.list
		})
		.catch((e) => {
			if (!robotListState.loaded) {
				robotListState.list = []
			}
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

// Auto-refresh management
let refreshTimer = null

export function startAutoRefresh(options = {}) {
	if (_wsActive) return
	stopAutoRefresh()
	// 轮询在跑时，UI 状态必须如实反映（登录则 polling，未登录则 idle）
	if (wsState.mode !== 'live') {
		wsState.mode = isLoggedIn() ? 'polling' : 'idle'
	}
	// WS 断开刚切换到轮询时，立即拉一次拯救陈旧 UI（不等 10s）
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

// Detail cache helpers
export function getCachedDetail(robotCode) {
	const cached = detailCache[robotCode]
	if (!cached) return null
	// TTL check: discard stale cache
	if (Date.now() - cached.fetchedAt > DETAIL_CACHE_TTL_MS) {
		delete detailCache[robotCode]
		return null
	}
	return cached.data
}

export function setCachedDetail(robotCode, data) {
	// Evict oldest entries if cache exceeds max size
	const keys = Object.keys(detailCache)
	if (keys.length >= DETAIL_CACHE_MAX_SIZE) {
		let oldestKey = keys[0]
		let oldestTime = detailCache[oldestKey].fetchedAt
		for (let i = 1; i < keys.length; i++) {
			if (detailCache[keys[i]].fetchedAt < oldestTime) {
				oldestKey = keys[i]
				oldestTime = detailCache[keys[i]].fetchedAt
			}
		}
		delete detailCache[oldestKey]
	}
	detailCache[robotCode] = { data, fetchedAt: Date.now() }
}
