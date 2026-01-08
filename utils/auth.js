import pagesJson from '@/pages.json'

export const TOKEN_KEY = 'uni_id_token'
export const EXPIRED_KEY = 'uni_id_token_expired'

const PROTECTED_ROUTES = new Set([
	'pages/robots/detail',
	'pages/profile/index'
])

function normalizeUrl(url) {
	const u = String(url || '').trim()
	if (!u) return ''
	return u.startsWith('/') ? u : `/${u}`
}

function getLoginPageUrl() {
	const configured = pagesJson?.uniIdRouter?.loginPage
	const fallback = 'pages/login/index'
	return normalizeUrl(configured || fallback)
}

export function getToken() {
	return String(uni.getStorageSync(TOKEN_KEY) || '').trim()
}

export function setToken(token, expired) {
	const t = String(token || '').trim()
	if (!t) return false
	uni.setStorageSync(TOKEN_KEY, t)
	uni.setStorageSync(EXPIRED_KEY, Number(expired || 0))
	return true
}

export function clearToken() {
	uni.removeStorageSync(TOKEN_KEY)
	uni.setStorageSync(EXPIRED_KEY, 0)
}

export function isLoggedIn() {
	const token = getToken()
	if (!token) return false
	const expired = Number(uni.getStorageSync(EXPIRED_KEY) || 0)
	if (!expired) return false
	return expired > Date.now()
}

export function ensureLoginForCurrentPage() {
	const pages = getCurrentPages()
	const page = pages && pages.length ? pages[pages.length - 1] : null
	const route = String(page?.route || '').trim()
	if (!route) return true
	if (!PROTECTED_ROUTES.has(route)) return true
	if (isLoggedIn()) return true

	uni.navigateTo({ url: getLoginPageUrl() })
	return false
}
