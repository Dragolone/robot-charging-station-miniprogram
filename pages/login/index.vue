<template>
	<view class="page">
		<view
			class="hero-panel"
			@touchstart.stop="handleHeroTouch"
			@touchmove.stop.prevent="handleHeroTouch"
			@touchend="handleHeroTouchEnd"
			@mousemove="handleHeroMouseMove"
		>
			<view class="hero-gradient-bg"></view>

			<view class="brand">
				<view class="brand-name">零一唯创</view>
			</view>

			<view class="hero-copy">
				<view class="hero-title">欢迎回来</view>
			</view>

			<view class="characters-shell">
				<AnimatedCharacters
					:is-typing="isTyping"
					:has-secret="!!password"
					:secret-visible="showPassword"
					:gaze-x="gaze.x"
					:gaze-y="gaze.y"
				/>
			</view>

		</view>

		<view class="form-card">
			<view class="header">
				<view class="title">欢迎回来</view>
				<view class="sub">请输入您的登录信息</view>
			</view>

			<view class="form">
				<view class="field">
					<view class="label">账号</view>
					<view class="input-shell">
						<input
							class="input-core"
							v-model="username"
							placeholder="用户名 / 邮箱"
							placeholder-class="input-placeholder"
							confirm-type="next"
							@focus="handleUsernameFocus"
							@blur="handleInputBlur"
						/>
					</view>
				</view>

				<view class="field">
					<view class="label">密码</view>
					<view class="input-shell password-shell">
						<input
							class="input-core password-core"
							:password="!showPassword"
							v-model="password"
							placeholder="请输入密码"
							placeholder-class="input-placeholder"
							confirm-type="done"
							@focus="handlePasswordFocus"
							@blur="handleInputBlur"
							@confirm="submit"
						/>
						<view class="password-toggle" @click="togglePassword">
							{{ showPassword ? '隐藏' : '显示' }}
						</view>
					</view>
				</view>

				<view class="options">
					<view class="remember" @click="toggleRemember">
						<view class="checkbox" :class="{ checked: remember }">
							<text class="checkbox-mark">{{ remember ? '✓' : '' }}</text>
						</view>
						<text>30天内自动登录</text>
					</view>
					<text class="forgot" @click="toRetrieve">忘记密码?</text>
				</view>

				<button class="btn-primary" :disabled="loading" @click="submit">
					{{ loading ? '登录中...' : '登录' }}
				</button>

				<view class="signup-line">
					<text class="signup-muted">还没有账号?</text>
					<text class="signup-link" @click="toRegister">立即注册</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { onLoad, onReady } from '@dcloudio/uni-app'
import { backToRedirect, isLoggedIn, REDIRECT_KEY, setToken } from '@/utils/auth.js'
import { fetchProfile, clearProfileState } from '@/utils/profile-store.js'
import AnimatedCharacters from '@/components/login-animation/AnimatedCharacters.vue'

const uniIdCo = uniCloud.importObject('uni-id-co', {
	customUI: true,
	errorOptions: { type: 'toast' }
})

// uni-id-co 在系统语言为英文时返回英文错误，前端统一转中文
const ERROR_ZH = {
	'Password error': '密码错误',
	'The number of password errors is excessive': '密码错误次数过多，请稍后再试',
	'invalid password': '密码不合法',
	'Passwords must have 8-16 characters and contain at least two of the following: letters, numbers, and symbols.': '密码必须为字母、数字和特殊符号任意两种的组合，长度8-16位',
	'Passwords must have 8-16 characters and contain letters and numbers.': '密码必须包含字母和数字，长度6-16位',
	'Passwords must have 8-16 characters and contain letters, numbers and symbols.': '密码必须包含字母、数字和特殊符号，长度8-16位',
	'Passwords must have 8-16 characters and contain uppercase letters, lowercase letters, numbers, and symbols.': '密码必须包含大小写字母、数字和特殊符号，长度8-16位',
	'This account does not exist': '此账号未注册',
	'Invalid username': '用户名不合法',
	'Invalid parameter': '参数错误',
	'This account has been banned': '此账号已封禁',
	'This account has been closed': '此账号已注销'
}

function toZhError(e) {
	const msg = e?.errMsg || e?.message || ''
	return ERROR_ZH[msg] || msg || '登录失败'
}

const username = ref('')
const password = ref('')
const loading = ref(false)
const remember = ref(false)
const showPassword = ref(false)
const isTyping = ref(false)
const gaze = reactive({ x: 0, y: 0 })
const heroRect = reactive({ left: 0, top: 0, width: 1, height: 1 })

onLoad((query = {}) => {
	// 已经登录则直接回跳（避免误入登录页）
	if (isLoggedIn()) {
		backToRedirect()
		return
	}

	// 兼容：如果外部仍通过 query 传 redirectUrl，则写入统一的 REDIRECT_KEY
	const q = String(query.redirectUrl || '').trim()
	if (q) uni.setStorageSync(REDIRECT_KEY, decodeURIComponent(q))
})

onReady(() => {
	updateHeroRect()
})

function toRegister() {
	uni.navigateTo({
		url: '/uni_modules/uni-id-pages/pages/register/register'
	})
}

function toRetrieve() {
	// 手机号功能暂时屏蔽，直接跳邮箱找回密码
	uni.navigateTo({
		url: '/uni_modules/uni-id-pages/pages/retrieve/retrieve-by-email'
	})
}

function toggleRemember() {
	remember.value = !remember.value
}

function togglePassword() {
	showPassword.value = !showPassword.value
}

function handleUsernameFocus() {
	isTyping.value = true
	setGaze(0.36, 0.38)
}

function handlePasswordFocus() {
	isTyping.value = true
	setGaze(0.14, 0.64)
}

function handleInputBlur() {
	isTyping.value = false
	resetGaze()
}

let lastHeroTouchTs = 0
function handleHeroTouch(event) {
	const now = Date.now()
	if (now - lastHeroTouchTs < 32) return
	lastHeroTouchTs = now
	const point = event?.touches?.[0]
	if (!point) return
	applyPointToGaze(point.clientX, point.clientY)
}

function handleHeroMouseMove(event) {
	if (typeof event?.clientX !== 'number') return
	applyPointToGaze(event.clientX, event.clientY)
}

function handleHeroTouchEnd() {
	if (!isTyping.value) resetGaze()
}

function applyPointToGaze(clientX, clientY) {
	const width = heroRect.width || 1
	const height = heroRect.height || 1
	const relativeX = (clientX - heroRect.left) / width
	const relativeY = (clientY - heroRect.top) / height
	setGaze((relativeX - 0.5) * 2, (relativeY - 0.5) * 2)
}

function setGaze(x, y) {
	gaze.x = clamp(x, -1, 1)
	gaze.y = clamp(y, -1, 1)
}

function resetGaze() {
	setGaze(0, 0)
}

function updateHeroRect(callback) {
	uni.createSelectorQuery()
		.select('.hero-panel')
		.boundingClientRect((rect) => {
			if (rect) {
				heroRect.left = rect.left
				heroRect.top = rect.top
				heroRect.width = rect.width || 1
				heroRect.height = rect.height || 1
			}
			if (typeof callback === 'function') callback()
		})
		.exec()
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value))
}

async function submit() {
	if (loading.value) return

	const u = String(username.value || '').trim()
	const p = String(password.value || '')
	if (!u) {
		uni.showToast({ title: '请输入账号', icon: 'none' })
		return
	}
	if (!p) {
		uni.showToast({ title: '请输入密码', icon: 'none' })
		return
	}

	const data = { password: p }
	// TODO: 手机号登录暂时屏蔽，待接入微信隐私授权合规流程后恢复
	// if (/^1\d{10}$/.test(u)) data.mobile = u
	if (/@/.test(u)) data.email = u
	else data.username = u

	loading.value = true
	try {
		const res = await uniIdCo.login(data)

		// uni-id-co 标准返回：{ newToken: { token, tokenExpired }, uid, ... }
		const token = res?.token || res?.newToken?.token
		const tokenExpired = res?.tokenExpired || res?.newToken?.tokenExpired
		if (!setToken(token, tokenExpired)) {
			uni.showToast({ title: '登录失败：缺少 token', icon: 'none' })
			return
		}

		clearProfileState()
		try {
			await fetchProfile({ force: true })
		} catch (profileError) {
			console.error('[login] fetchProfile failed:', profileError)
		}

		uni.showToast({ title: '登录成功', icon: 'none' })
		backToRedirect()
	} catch (e) {
		uni.showToast({ title: toZhError(e), icon: 'none' })
	} finally {
		loading.value = false
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: linear-gradient(180deg, #E6E0F3 0%, #F0EDF6 28%, #F5F4F8 50%);
	padding: 28rpx 24rpx 40rpx;
	box-sizing: border-box;
}

.hero-panel {
	position: relative;
	width: 100%;
	min-height: 680rpx;
	border-radius: 42rpx;
	padding: 34rpx 30rpx 28rpx;
	box-sizing: border-box;
	background: linear-gradient(155deg, #DED8F0 0%, #D0E8E4 50%, #F2E0D0 100%);
	box-shadow: 0 20rpx 60rpx rgba(107, 93, 166, 0.12);
	overflow: hidden;
}

.hero-gradient-bg {
	position: absolute;
	inset: 0;
	background:
		radial-gradient(circle at 18% 60%, rgba(124, 111, 224, 0.12) 0%, transparent 40%),
		radial-gradient(circle at 82% 40%, rgba(78, 205, 196, 0.1) 0%, transparent 35%),
		radial-gradient(ellipse at 50% 85%, rgba(255, 176, 103, 0.1) 0%, transparent 40%);
}

.brand,
.hero-copy,
.characters-shell {
	position: relative;
	z-index: 1;
}

.brand {
	display: flex;
	align-items: center;
	gap: 12rpx;
	color: #4A4170;
	font-size: 28rpx;
	font-weight: 600;
}


.hero-copy {
	margin-top: 32rpx;
	color: #3D3560;
	text-align: center;
}

.hero-title {
	font-size: 56rpx;
	font-weight: 700;
	letter-spacing: 1rpx;
}

.characters-shell {
	margin-top: 32rpx;
	margin-bottom: 16rpx;
	display: flex;
	justify-content: center;
}

.form-card {
	position: relative;
	z-index: 2;
	margin-top: -46rpx;
	padding: 38rpx 30rpx 34rpx;
	border-radius: 36rpx;
	background: #ffffff;
	box-shadow: 0 20rpx 80rpx rgba(27, 33, 75, 0.1);
}

.header {
	text-align: center;
}

.title {
	font-size: 42rpx;
	font-weight: 700;
	color: #1f2430;
}

.sub {
	margin-top: 10rpx;
	font-size: 22rpx;
	color: #8c92a4;
}

.form {
	margin-top: 34rpx;
}

.field + .field {
	margin-top: 24rpx;
}

.label {
	margin-bottom: 12rpx;
	font-size: 24rpx;
	font-weight: 600;
	color: #333a4d;
}

.input-shell {
	height: 90rpx;
	padding: 0 24rpx;
	border-radius: 18rpx;
	border: 2rpx solid #d8dced;
	background: #ffffff;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.password-shell {
	position: relative;
	padding-right: 110rpx;
}

.input-shell:focus-within {
	border-color: #5427e6;
	box-shadow: 0 0 0 8rpx rgba(84, 39, 230, 0.1);
}

.input-core {
	width: 100%;
	height: 100%;
	font-size: 28rpx;
	color: #1f2430;
}

.password-core {
	padding-right: 0;
}

.input-placeholder {
	color: #b2b7c7;
}

.password-toggle {
	position: absolute;
	right: 24rpx;
	top: 50%;
	transform: translateY(-50%);
	font-size: 24rpx;
	font-weight: 600;
	color: #5427e6;
}

.options {
	margin-top: 24rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
}

.remember {
	display: flex;
	align-items: center;
	gap: 12rpx;
	font-size: 22rpx;
	color: #7a8094;
}

.checkbox {
	width: 26rpx;
	height: 26rpx;
	border-radius: 8rpx;
	border: 2rpx solid #c9cede;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #ffffff;
}

.checkbox.checked {
	border-color: #5427e6;
	background: #5427e6;
}

.checkbox-mark {
	font-size: 20rpx;
	line-height: 1;
	color: #ffffff;
}

.forgot {
	font-size: 22rpx;
	font-weight: 600;
	color: #5427e6;
}

.btn-primary {
	margin-top: 24rpx;
	height: 92rpx;
	line-height: 92rpx;
	border-radius: 18rpx;
	font-size: 28rpx;
	font-weight: 700;
	color: #ffffff;
	background: linear-gradient(135deg, #6C5CE7 0%, #5A4BD6 100%);
	box-shadow: 0 14rpx 28rpx rgba(90, 75, 214, 0.22);
}

.btn-primary[disabled] {
	opacity: 0.68;
}

.btn-primary::after {
	border: none;
}

.signup-line {
	margin-top: 28rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12rpx;
	font-size: 24rpx;
}

.signup-muted {
	color: #8c92a4;
}

.signup-link {
	color: #1f2430;
	font-weight: 700;
}
</style>

