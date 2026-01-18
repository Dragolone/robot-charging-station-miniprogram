import { reactive } from 'vue'
import { isLoggedIn } from '@/utils/auth.js'

const PROFILE_MIN_REQUEST_INTERVAL_MS = 10 * 1000

let _userService = null
function getUserService() {
	if (!_userService) {
		_userService = uniCloud.importObject('userService', {
			customUI: true,
			errorOptions: { type: 'none' }
		})
	}
	return _userService
}

export const profileState = reactive({
	profile: null,
	loaded: false,
	loading: false,
	lastFetchedAt: 0,
	lastRequestedAt: 0,
	inflight: null
})

export function clearProfileState() {
	profileState.profile = null
	profileState.loaded = false
	profileState.loading = false
	profileState.lastFetchedAt = 0
	profileState.lastRequestedAt = 0
	profileState.inflight = null
}

export function patchProfile(patch = {}) {
	const nextPatch = patch && typeof patch === 'object' ? patch : {}
	profileState.profile = {
		...(profileState.profile || {}),
		...nextPatch
	}
	profileState.loaded = true
}

export async function fetchProfile(options = {}) {
	const { force = false } = options

	if (!isLoggedIn()) {
		clearProfileState()
		return null
	}

	if (profileState.inflight) return profileState.inflight

	const now = Date.now()
	if (!force && profileState.loaded && profileState.profile) {
		return profileState.profile
	}

	if (
		profileState.lastRequestedAt &&
		now - profileState.lastRequestedAt < PROFILE_MIN_REQUEST_INTERVAL_MS
	) {
		return profileState.profile
	}

	profileState.loading = true
	profileState.lastRequestedAt = now

	async function callWithRetry() {
		try {
			return await getUserService().getMyProfile()
		} catch (e) {
			const isTimeout = e && /timeout/i.test(String(e.message || e.errMsg || ''))
			if (isTimeout) {
				try {
					return await getUserService().getMyProfile()
				} catch (_) {
					return null
				}
			}
			throw e
		}
	}

	profileState.inflight = callWithRetry()
		.then((data) => {
			profileState.profile = data || null
			profileState.loaded = true
			profileState.lastFetchedAt = Date.now()
			return profileState.profile
		})
		.finally(() => {
			profileState.loading = false
			profileState.inflight = null
		})

	return profileState.inflight
}

export async function ensureProfileLoaded() {
	if (profileState.loaded && profileState.profile) return profileState.profile
	return fetchProfile()
}
