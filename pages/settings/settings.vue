<template>
	<view class="page">
		<!-- 账号 -->
		<view class="section">
			<text class="section-label">账号</text>
			<view class="card">
				<view class="card-item" hover-class="card-item-hover" @tap="goProfile">
					<view class="item-icon-wrap item-icon-purple">
						<uni-icons type="person" size="20" color="#5427e6"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title">个人资料</text>
						<text class="item-desc">查看并维护头像、昵称等信息</text>
					</view>
					<text class="item-arrow">›</text>
				</view>
				<view class="card-item">
					<view class="item-icon-wrap item-icon-blue">
						<uni-icons type="auth" size="20" color="#2563eb"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title">账号信息</text>
						<text class="item-desc">当前登录账号</text>
					</view>
					<text class="item-value">{{ displayUsername }}</text>
				</view>
			</view>
		</view>

		<!-- 设备 -->
		<view class="section">
			<text class="section-label">设备</text>
			<view class="card">
				<view class="card-item" hover-class="card-item-hover" @tap="goRobots">
					<view class="item-icon-wrap item-icon-purple">
						<uni-icons type="staff" size="20" color="#5427e6"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title">我的机器人</text>
						<text class="item-desc">查看机器人列表与设备状态</text>
					</view>
					<text class="item-arrow">›</text>
				</view>
				<view class="card-item" hover-class="card-item-hover" @tap="openBindRobotSheet">
					<view class="item-icon-wrap item-icon-green">
						<uni-icons type="plusempty" size="20" color="#16a34a"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title">绑定机器人</text>
						<text class="item-desc">手动输入设备编号或扫码绑定</text>
					</view>
					<text class="item-arrow">›</text>
				</view>
			</view>
		</view>

		<!-- 通用 -->
		<view class="section">
			<text class="section-label">通用</text>
			<view class="card">
				<view class="card-item" hover-class="card-item-hover" @tap="goNotification">
					<view class="item-icon-wrap item-icon-orange">
						<uni-icons type="notification" size="20" color="#8E3D00"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title">消息通知</text>
						<text class="item-desc">提醒偏好与通知管理</text>
					</view>
					<view class="item-tag">
						<text class="item-tag-text">即将推出</text>
					</view>
				</view>
				<view class="card-item" hover-class="card-item-hover" @tap="goHelp">
					<view class="item-icon-wrap item-icon-purple">
						<uni-icons type="help" size="20" color="#5427e6"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title">使用帮助</text>
						<text class="item-desc">产品说明、常见问题与操作建议</text>
					</view>
					<text class="item-arrow">›</text>
				</view>
				<view class="card-item" hover-class="card-item-hover" @tap="goFeedback">
					<view class="item-icon-wrap item-icon-orange">
						<uni-icons type="compose" size="20" color="#8E3D00"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title">意见反馈</text>
						<text class="item-desc">提交问题与建议</text>
					</view>
					<text class="item-arrow">›</text>
				</view>
				<view class="card-item" hover-class="card-item-hover" @tap="clearCache">
					<view class="item-icon-wrap item-icon-gray">
						<uni-icons type="trash" size="20" color="#6b7280"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title">清除本地缓存</text>
						<text class="item-desc">清理本地存储，不影响云端数据</text>
					</view>
					<text class="item-arrow">›</text>
				</view>
				<view class="card-item" hover-class="card-item-hover" @tap="goAbout">
					<view class="item-icon-wrap item-icon-blue">
						<uni-icons type="info" size="20" color="#2563eb"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title">关于我们</text>
						<text class="item-desc">产品信息与版本说明</text>
					</view>
					<text class="item-arrow">›</text>
				</view>
				<view class="card-item" hover-class="card-item-hover" @tap="copyDeviceInfo">
					<view class="item-icon-wrap item-icon-gray">
						<uni-icons type="phone" size="20" color="#6b7280"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title">复制设备信息</text>
						<text class="item-desc">{{ deviceSummary }}</text>
					</view>
					<text class="item-action">复制</text>
				</view>
			</view>
		</view>

		<!-- 退出 -->
		<view class="section">
			<view class="card">
				<view class="card-item card-item-danger" hover-class="card-item-hover" @tap="logout">
					<view class="item-icon-wrap item-icon-red">
						<uni-icons type="redo" size="20" color="#e53935"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title item-title-danger">退出登录</text>
						<text class="item-desc">清理登录态并返回登录页</text>
					</view>
				</view>
			</view>
		</view>

		<BindRobotSheet :visible="bindSheetVisible" @close="closeBindSheet" />
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { isLoggedIn, logoutAndGoLogin } from '@/utils/auth.js'
import BindRobotSheet from '@/components/BindRobotSheet.vue'
import { profileState, ensureProfileLoaded, clearProfileState } from '@/utils/profile-store.js'


const bindSheetVisible = ref(false)
const deviceSummary = ref('用于问题排查与反馈')
const profile = computed(() => profileState.profile)
const profileLoading = computed(() => profileState.loading)

const displayUsername = computed(() => {
	const username = String(profile.value?.username || '').trim()
	return username || (profileLoading.value ? '加载中…' : '暂无数据')
})

onMounted(() => {
	try {
		const deviceInfo = uni.getDeviceInfo()
		const model = deviceInfo.model || ''
		const system = deviceInfo.system || ''
		const platform = deviceInfo.platform || ''
		deviceSummary.value = [platform, system, model].filter(Boolean).join(' / ') || '用于问题排查与反馈'
	} catch (e) {
		deviceSummary.value = '用于问题排查与反馈'
	}
})

onShow(() => {
	loadMyProfile().catch((e) => {
		console.error('[settings] loadMyProfile failed:', e)
	})
})

async function loadMyProfile() {
	if (!isLoggedIn()) {
		clearProfileState()
		return
	}
	await ensureProfileLoaded()
}

function goProfile() {
	if (!isLoggedIn()) {
		uni.navigateTo({ url: '/pages/login/index' })
		return
	}
	uni.navigateTo({ url: '/pages/profile/index' })
}

function goRobots() {
	uni.switchTab({ url: '/pages/robots/index' })
}

function goHelp() {
	uni.navigateTo({ url: '/pages/settings/help' })
}

function goAbout() {
	uni.navigateTo({ url: '/pages/settings/about' })
}

function goNotification() {
	uni.showToast({ title: '消息通知功能即将推出', icon: 'none' })
}

function goFeedback() {
	uni.showModal({
		title: '意见反馈',
		content: '如需反馈问题或提出建议，请发送邮件至 810170966qq@gmail.com，我们会尽快回复。',
		showCancel: false
	})
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
	padding: 20rpx 32rpx 48rpx;
	background: #F8F9FA;
	min-height: 100vh;
	box-sizing: border-box;
}

.section {
	margin-top: 32rpx;
}

.section:first-child {
	margin-top: 0;
}

.section-label {
	font-size: 22rpx;
	font-weight: 600;
	color: #6b7280;
	letter-spacing: 3rpx;
	margin-bottom: 16rpx;
	padding-left: 4rpx;
	display: block;
}

.card {
	border-radius: 24rpx;
	background: #FFFFFF;
	overflow: hidden;
}

.card-item {
	display: flex;
	align-items: center;
	gap: 16rpx;
	padding: 24rpx 28rpx;
	transition: background-color 0.2s ease;
}

.card-item-hover {
	background: #F8F9FA;
}

.item-icon-wrap {
	width: 48rpx;
	height: 48rpx;
	border-radius: 14rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.item-icon-purple {
	background: #EADDFF;
}

.item-icon-blue {
	background: #DBEAFE;
}

.item-icon-green {
	background: #DCFCE7;
}

.item-icon-orange {
	background: #FFDAD6;
}

.item-icon-gray {
	background: #F3F4F6;
}

.item-icon-red {
	background: #FFDAD6;
}

.item-content {
	flex: 1;
	min-width: 0;
}

.item-title {
	font-size: 28rpx;
	font-weight: 500;
	color: #191C1D;
	display: block;
}

.item-title-danger {
	color: #e53935;
}

.item-desc {
	font-size: 22rpx;
	color: #9ca3af;
	margin-top: 4rpx;
	display: block;
}

.item-arrow {
	font-size: 34rpx;
	color: #d1d5db;
	flex-shrink: 0;
	line-height: 1;
}

.item-value {
	font-size: 24rpx;
	color: #6b7280;
	flex-shrink: 0;
	max-width: 280rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.item-action {
	font-size: 24rpx;
	font-weight: 500;
	color: #5427e6;
	flex-shrink: 0;
}

.item-tag {
	padding: 4rpx 14rpx;
	border-radius: 999rpx;
	background: #EADDFF;
	flex-shrink: 0;
}

.item-tag-text {
	font-size: 20rpx;
	font-weight: 500;
	color: #5427e6;
}
</style>
