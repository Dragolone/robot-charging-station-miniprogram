import pagesJson from '@/pages.json'

export const TOKEN_KEY = 'uni_id_token'
export const EXPIRED_KEY = 'uni_id_token_expired'
export const REDIRECT_KEY = '_login_redirect_url_'

// tabBar 页面（robots/index, my/index）不放这里，它们自己在 onShow 中调 ensureLoginForCurrentPage
const PROTECTED_ROUTES = new Set([
	'pages/robots/detail',
	'pages/profile/index',
	'pages/profile/edit-nickname',
	'pages/settings/settings',
	'pages/settings/privacy'
])

let isRedirecting = false

function normalizeUrl(url) {
	const u = String(url || '').trim()
	if (!u) return ''
	return u.startsWith('/') ? u : `/${u}`
}

function stripQueryAndHash(url) {
	const u = String(url || '')
	const i = Math.min(
		...['?', '#'].map((ch) => {
			const idx = u.indexOf(ch)
			return idx === -1 ? u.length : idx
		})
	)
	return u.slice(0, i)
}

function toRoutePath(url) {
	const p = stripQueryAndHash(normalizeUrl(url))
	return p.startsWith('/') ? p.slice(1) : p
}

function getLoginPageUrl() {
	const configured = pagesJson?.uniIdRouter?.loginPage
	const fallback = 'pages/login/index'
	return normalizeUrl(configured || fallback)
}

function isLoginPageRoute(route) {
	const r = String(route || '').trim()
	if (!r) return false
	return normalizeUrl(r) === getLoginPageUrl()
}

function isProtectedRoute(route) {
	return PROTECTED_ROUTES.has(String(route || '').trim())
}

function isTabBarUrl(url) {
	const routePath = toRoutePath(url)
	const list = pagesJson?.tabBar?.list || []
	return list.some((item) => String(item?.pagePath || '').trim() === routePath)
}

function getCurrentFullPath() {
	const pages = getCurrentPages()
	const page = pages && pages.length ? pages[pages.length - 1] : null
	if (!page) return ''

	const fullPath = page?.$page?.fullPath
	if (typeof fullPath === 'string' && fullPath) {
		return normalizeUrl(fullPath)
	}

	const route = String(page.route || '').trim()
	const options = page.options || {}
	const keys = Object.keys(options)
	const query = keys.length
		? keys
				.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(options[k] ?? ''))}`)
				.join('&')
		: ''
	return route ? `/${route}${query ? `?${query}` : ''}` : ''
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

	// 优先使用本地存储的过期时间；没有时尝试从 uniCloud 运行时获取
	let expired = Number(uni.getStorageSync(EXPIRED_KEY) || 0)
	if (!expired) {
		try {
			expired = Number(uniCloud.getCurrentUserInfo()?.tokenExpired || 0)
		} catch (e) {
			expired = 0
		}
	}

	// expired 为 0 时，无法确认有效期：按“未登录/需重新登录”处理更安全
	if (!expired) return false
	return expired > Date.now()
}

/**
 * 全局/页面守卫：未登录则保存当前页面完整路径(含 query)并跳转登录页
 * @returns {boolean} true=已登录或无需保护；false=已跳转登录页
 */
export function ensureLoginForCurrentPage() {
	const pages = getCurrentPages()
	const page = pages && pages.length ? pages[pages.length - 1] : null
	const route = String(page?.route || '').trim()
	if (!route) return true

	if (isLoginPageRoute(route)) return false
	if (!isProtectedRoute(route)) return true
	if (isLoggedIn()) return true
	if (isRedirecting) return false

	isRedirecting = true
	setTimeout(() => {
		isRedirecting = false
	}, 500)

	const fullPath = getCurrentFullPath() || '/pages/robots/index'
	uni.setStorageSync(REDIRECT_KEY, fullPath)

	const loginUrl = getLoginPageUrl()
	uni.navigateTo({
		url: loginUrl,
		fail: () => {
			uni.redirectTo({ url: loginUrl })
		}
	})
	return false
}

/**
 * 登录成功后回跳：优先 redirectTo；若目标是 tabBar 页面则 switchTab；最后清理 REDIRECT_KEY
 */
export function backToRedirect() {
	const redirectUrl = normalizeUrl(uni.getStorageSync(REDIRECT_KEY) || '') || '/pages/robots/index'
	const clear = () => {
		uni.removeStorageSync(REDIRECT_KEY)
	}

	if (isTabBarUrl(redirectUrl)) {
		clear()
		return uni.switchTab({
			// switchTab 不稳定支持 query，这里只保留 path
			url: normalizeUrl(toRoutePath(redirectUrl))
		})
	}

	uni.redirectTo({
		url: redirectUrl,
		success: () => clear(),
		fail: () => {
			// 兜底：如果是 tabBar 导致 redirectTo 失败，改用 switchTab
			if (isTabBarUrl(redirectUrl)) {
				clear()
				return uni.switchTab({
					url: normalizeUrl(toRoutePath(redirectUrl))
				})
			}
			clear()
			uni.reLaunch({ url: redirectUrl })
		}
	})
}

/**
 * 退出登录并跳转到登录页（供“清缓存/退出登录”复用）
 * - 不引入/不依赖 uid 参数
 * - 不影响 ensureLoginForCurrentPage 现有逻辑
 */
export function logoutAndGoLogin(options = {}) {
	const clearAllStorage = !!options.clearAllStorage

	uni.$emit('user:logout')

	try {
		if (clearAllStorage) {
			uni.clearStorageSync()
		} else {
			clearToken()
			uni.removeStorageSync(REDIRECT_KEY)
		}
	} catch (e) {
		// 忽略清理异常，仍继续跳转
	}

	// 确保 redirectKey 一定被清掉（即使走了 clearStorageSync 失败）
	try {
		uni.removeStorageSync(REDIRECT_KEY)
	} catch (e) {}

	const loginUrl = getLoginPageUrl()

	// 兼容：若登录页未来被配置为 tabBar，则用 switchTab
	if (isTabBarUrl(loginUrl)) {
		return uni.switchTab({
			url: normalizeUrl(toRoutePath(loginUrl))
		})
	}

	return uni.reLaunch({ url: loginUrl })
}

