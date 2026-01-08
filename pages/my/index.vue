<template>
	<view class="page">
		<!-- Header Bar -->
		<view class="page-header">
			<view class="header-left">
				<text class="header-brand">我的</text>
			</view>
			<view class="header-right">
				<text class="header-signal">((•))</text>
			</view>
		</view>

		<!-- Profile Hero -->
		<view class="profile-hero">
			<view class="avatar-wrapper" @tap="goProfile">
				<image class="hero-avatar" :src="displayAvatar" mode="aspectFill"></image>
				<view class="avatar-badge">
					<uni-icons type="checkmarkempty" size="14" color="#FFFFFF"></uni-icons>
				</view>
			</view>
			<text class="hero-name">{{ displayNickname }}</text>
			<text class="hero-role">@{{ displayUsername }}</text>
		</view>

		<!-- Quick Access -->
		<view class="section">
			<text class="section-label">快捷入口</text>

			<view class="quick-card" hover-class="quick-card-hover" @tap="goRobots">
				<view class="quick-card-icon-wrap">
					<uni-icons type="staff" size="28" color="#5427e6"></uni-icons>
				</view>
				<view class="quick-card-content">
					<text class="quick-card-title">机器人列表</text>
					<text class="quick-card-desc">管理 {{ robotCount }} 台设备</text>
				</view>
				<text class="quick-card-arrow">›</text>
			</view>

			<view class="quick-grid">
				<view class="quick-grid-item" hover-class="quick-grid-item-hover" @tap="showHelp">
					<view class="grid-icon-wrap grid-icon-help">
						<uni-icons type="help-filled" size="24" color="#5427e6"></uni-icons>
					</view>
					<text class="grid-item-label">使用帮助</text>
				</view>
				<view class="quick-grid-item" hover-class="quick-grid-item-hover" @tap="feedback">
					<view class="grid-icon-wrap grid-icon-feedback">
						<uni-icons type="compose" size="24" color="#8E3D00"></uni-icons>
					</view>
					<text class="grid-item-label">意见反馈</text>
				</view>
			</view>
		</view>

		<!-- Developer Debugging -->
		<view class="section">
			<view class="section-header">
				<text class="section-label">开发调试</text>
				<view class="version-chip">
					<text class="version-text">V2.4.0-DEV</text>
				</view>
			</view>

			<view class="debug-card">
				<view class="debug-row">
					<text class="debug-label">登录状态</text>
					<view class="debug-status">
						<view class="debug-dot" :class="profile?.uid ? 'dot-active' : 'dot-inactive'"></view>
						<text class="debug-value">{{ debugLoginText }}</text>
					</view>
				</view>
				<view class="debug-row">
					<text class="debug-label">uid</text>
					<view class="uid-chip" v-if="profile?.uid">
						<text class="uid-text">{{ formatUid(profile?.uid) }}</text>
					</view>
					<text v-else class="debug-value">-</text>
				</view>
				<view class="debug-row">
					<text class="debug-label">username</text>
					<text class="debug-value debug-value-bold">{{ profile?.username || '-' }}</text>
				</view>
				<view class="debug-row">
					<text class="debug-label">nickname</text>
					<text class="debug-value debug-value-bold">{{ profile?.nickname || '-' }}</text>
				</view>
			</view>
		</view>

		<!-- System Settings -->
		<view class="section">
			<text class="section-label">系统设置</text>

			<view class="settings-list">
				<view class="settings-item" hover-class="settings-item-hover" @tap="goSettings">
					<view class="settings-icon-wrap">
						<uni-icons type="gear" size="22" color="#6b7280"></uni-icons>
					</view>
					<text class="settings-text">通用设置</text>
					<text class="settings-arrow">›</text>
				</view>
				<view class="settings-item" hover-class="settings-item-hover" @tap="goNotification">
					<view class="settings-icon-wrap">
						<uni-icons type="notification" size="22" color="#6b7280"></uni-icons>
					</view>
					<text class="settings-text">消息通知</text>
					<text class="settings-arrow">›</text>
				</view>
				<view class="settings-item" hover-class="settings-item-hover" @tap="goPrivacy">
					<view class="settings-icon-wrap">
						<uni-icons type="locked" size="22" color="#6b7280"></uni-icons>
					</view>
					<text class="settings-text">安全与隐私</text>
					<text class="settings-arrow">›</text>
				</view>
				<view class="settings-item settings-item-danger" hover-class="settings-item-hover" @tap="logout">
					<view class="settings-icon-wrap">
						<uni-icons type="redo" size="22" color="#e53935"></uni-icons>
					</view>
					<text class="settings-text settings-text-danger">退出登录</text>
				</view>
			</view>
		</view>

		<view class="page-footer"></view>

		<BindRobotSheet :visible="bindSheetVisible" @close="closeBindSheet" />
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { isLoggedIn, logoutAndGoLogin } from '@/utils/auth.js'
import BindRobotSheet from '@/components/BindRobotSheet.vue'
import { profileState, ensureProfileLoaded, clearProfileState } from '@/utils/profile-store.js'
import { robotListState, fetchRobotList } from '@/utils/robot-store.js'

const DEFAULT_AVATAR = '/static/default-avatar.png'

const deviceSummary = ref('点击复制')
const bindSheetVisible = ref(false)
const robotCount = computed(() => robotListState.list.length)
const profile = computed(() => profileState.profile)
const profileLoading = computed(() => profileState.loading)

const userService = uniCloud.importObject('userService', {
	customUI: true,
	errorOptions: { type: 'toast' }
})

const displayUsername = computed(() => profile.value?.username || '-')
const displayNickname = computed(() => {
	const nickname = String(profile.value?.nickname || '').trim()
	if (nickname) return nickname

	const username = String(profile.value?.username || '').trim()
	if (username) return username

	return profileLoading.value ? '加载中…' : '未登录'
})
const displayAvatar = computed(() => {
	const avatar = String(profile.value?.avatar || '').trim()
	return avatar || DEFAULT_AVATAR
})

const debugLoginText = computed(() => {
	if (profileLoading.value) return '认证中…'
	if (profile.value && profile.value.uid) return '已认证'
	return '未登录'
})

onMounted(() => {
	try {
		const deviceInfo = uni.getDeviceInfo()
		const model = deviceInfo.model || ''
		const system = deviceInfo.system || ''
		const platform = deviceInfo.platform || ''
		deviceSummary.value = [platform, system, model].filter(Boolean).join(' / ') || '点击复制'
	} catch (e) {
		deviceSummary.value = '点击复制'
	}
})

onShow(() => {
	loadMyProfile().catch((e) => {
		console.error('[my] loadMyProfile failed:', e)
	})
	if (isLoggedIn()) fetchRobotList().catch((e) => {
		console.error('[my] fetchRobotList failed:', e)
	})
})

async function loadMyProfile() {
	if (!isLoggedIn()) {
		clearProfileState()
		return
	}
	await ensureProfileLoaded()
}


function formatUid(uid) {
	if (!uid) return '-'
	const str = String(uid)
	if (str.length <= 12) return str
	return str.substring(0, 4) + '-' + str.substring(4, 8) + '-' + str.substring(str.length - 3).toUpperCase()
}

function goRobots() {
	uni.switchTab({ url: '/pages/robots/index' })
}

function goProfile() {
	if (!isLoggedIn()) {
		uni.navigateTo({ url: '/pages/login/index' })
		return
	}
	uni.navigateTo({ url: '/pages/profile/index' })
}

function goSettings() {
	uni.navigateTo({ url: '/pages/settings/settings' })
}

function showHelp() {
	uni.navigateTo({ url: '/pages/settings/help' })
}

function feedback() {
	uni.showModal({
		title: '意见反馈',
		content: '如需反馈问题或提出建议，请发送邮件至 810170966qq@gmail.com，我们会尽快回复。',
		showCancel: false
	})
}

function goNotification() {
	uni.showToast({ title: '消息通知功能即将推出', icon: 'none' })
}

function goPrivacy() {
	uni.navigateTo({ url: '/pages/settings/privacy' })
}

function copyDeviceInfo() {
	const text = deviceSummary.value || '未知设备'
	uni.setClipboardData({
		data: text,
		success: () => {
			uni.showToast({ title: '已复制', icon: 'success' })
		}
	})
}

async function openBindRobotSheet() {
	if (!isLoggedIn()) {
		uni.navigateTo({ url: '/pages/login/index' })
		return
	}

	bindSheetVisible.value = true
}

function closeBindSheet() {
	bindSheetVisible.value = false
}

function clearCache() {
	uni.showModal({
		title: '清除本地缓存',
		content: '将清除本地存储（不影响云端数据）。是否继续？',
		success: (res) => {
			if (!res.confirm) return
			logoutAndGoLogin({ clearAllStorage: true })
		}
	})
}

function logout() {
	uni.showModal({
		title: '退出登录',
		content: '将清理本机登录态并返回登录页，是否继续？',
		success: (res) => {
			if (!res.confirm) return
			logoutAndGoLogin()
		}
	})
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F8F9FA;
	padding: 0 32rpx;
	padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
}

/* Header */
.page-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 24rpx 0 8rpx;
	padding-top: calc(var(--status-bar-height, 50px) + 20rpx);
}

.header-left {
	display: flex;
	align-items: center;
	gap: 16rpx;
}

.header-brand {
	font-size: 30rpx;
	font-weight: 700;
	color: #191C1D;
}

.header-right {
	display: flex;
	align-items: center;
}

.header-signal {
	font-size: 28rpx;
	color: #5427e6;
	font-weight: 600;
}

/* Profile Hero */
.profile-hero {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 40rpx 0 32rpx;
}

.avatar-wrapper {
	position: relative;
	margin-bottom: 20rpx;
}

.hero-avatar {
	width: 180rpx;
	height: 180rpx;
	border-radius: 90rpx;
	background: #F3F4F6;
}

.avatar-badge {
	position: absolute;
	right: 4rpx;
	bottom: 4rpx;
	width: 44rpx;
	height: 44rpx;
	border-radius: 22rpx;
	background: #5427e6;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 4rpx solid #F8F9FA;
}


.hero-name {
	font-size: 40rpx;
	font-weight: 800;
	color: #191C1D;
	letter-spacing: 0.5rpx;
}

.hero-role {
	margin-top: 4rpx;
	font-size: 26rpx;
	color: #6b7280;
}

/* Section */
.section {
	margin-top: 32rpx;
}

.section-label {
	font-size: 22rpx;
	font-weight: 600;
	color: #6b7280;
	letter-spacing: 3rpx;
	margin-bottom: 16rpx;
	display: block;
}

.section-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 16rpx;
}

.section-header .section-label {
	margin-bottom: 0;
}

/* Version Chip */
.version-chip {
	padding: 6rpx 16rpx;
	border-radius: 999rpx;
	background: #EADDFF;
}

.version-text {
	font-size: 20rpx;
	font-weight: 600;
	color: #5427e6;
	letter-spacing: 1rpx;
}

/* Quick Access Card */
.quick-card {
	display: flex;
	align-items: center;
	gap: 20rpx;
	padding: 28rpx 24rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	transition: transform 0.2s ease, opacity 0.2s ease;
}

.quick-card-hover {
	transform: scale(0.98);
	opacity: 0.92;
}

.quick-card-icon-wrap {
	width: 72rpx;
	height: 72rpx;
	border-radius: 20rpx;
	background: #EADDFF;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.quick-card-content {
	flex: 1;
	min-width: 0;
}

.quick-card-title {
	font-size: 30rpx;
	font-weight: 600;
	color: #191C1D;
	display: block;
}

.quick-card-desc {
	font-size: 22rpx;
	color: #6b7280;
	margin-top: 4rpx;
	display: block;
}

.quick-card-arrow {
	font-size: 36rpx;
	color: #9ca3af;
	flex-shrink: 0;
}

/* Quick Grid */
.quick-grid {
	display: flex;
	gap: 20rpx;
	margin-top: 20rpx;
}

.quick-grid-item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12rpx;
	padding: 28rpx 16rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	transition: transform 0.2s ease, opacity 0.2s ease;
}

.quick-grid-item-hover {
	transform: scale(0.96);
	opacity: 0.9;
}

.grid-icon-wrap {
	width: 64rpx;
	height: 64rpx;
	border-radius: 18rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.grid-icon-help {
	background: #EADDFF;
}

.grid-icon-feedback {
	background: #FFDAD6;
}

.grid-item-label {
	font-size: 26rpx;
	font-weight: 500;
	color: #191C1D;
}

/* Debug Card */
.debug-card {
	border-radius: 24rpx;
	background: #FFFFFF;
	padding: 8rpx 0;
}

.debug-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 20rpx 28rpx;
}

.debug-label {
	font-size: 26rpx;
	color: #6b7280;
}

.debug-status {
	display: flex;
	align-items: center;
	gap: 10rpx;
}

.debug-dot {
	width: 14rpx;
	height: 14rpx;
	border-radius: 50%;
}

.dot-active {
	background: #22c55e;
}

.dot-inactive {
	background: #d1d5db;
}

.debug-value {
	font-size: 26rpx;
	color: #191C1D;
}

.debug-value-bold {
	font-weight: 600;
}

/* UID Chip */
.uid-chip {
	padding: 6rpx 16rpx;
	border-radius: 12rpx;
	background: #F3F4F6;
}

.uid-text {
	font-size: 22rpx;
	font-weight: 500;
	color: #191C1D;
	font-family: 'Courier New', monospace;
	letter-spacing: 1rpx;
}

/* Settings */
.settings-list {
	border-radius: 24rpx;
	background: #FFFFFF;
	overflow: hidden;
}

.settings-item {
	display: flex;
	align-items: center;
	gap: 16rpx;
	padding: 26rpx 28rpx;
	transition: background-color 0.2s ease;
}

.settings-item-hover {
	background: #F8F9FA;
}

.settings-icon-wrap {
	width: 40rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.settings-text {
	flex: 1;
	font-size: 28rpx;
	font-weight: 500;
	color: #191C1D;
}

.settings-text-danger {
	color: #e53935;
}

.settings-arrow {
	font-size: 34rpx;
	color: #9ca3af;
	flex-shrink: 0;
}

.settings-item-danger {
	margin-top: 0;
}

/* Footer */
.page-footer {
	height: 32rpx;
}
</style>
