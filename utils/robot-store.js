import { reactive } from 'vue'
import { isLoggedIn } from '@/utils/auth.js'

const LIST_MIN_REQUEST_INTERVAL_MS = 3 * 1000

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

export function clearRobotListState() {
	robotListState.list = []
	robotListState.loaded = false
	robotListState.loading = false
	robotListState.lastFetchedAt = 0
	robotListState.lastRequestedAt = 0
	robotListState.inflight = null
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
