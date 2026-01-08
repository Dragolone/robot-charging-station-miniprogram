<template>
	<view class="page">
		<!-- Header -->
		<view class="page-header">
			<view class="header-left">
				<image class="header-avatar" :src="displayAvatar" mode="aspectFill" @tap="goProfile"></image>
				<text class="header-brand">{{ displayNickname }}</text>
			</view>
			<view class="header-right">
				<view class="ws-chip" :class="'ws-chip-' + wsState.mode">
					<view class="ws-dot" :class="{ 'ws-dot-pulse': wsState.mode === 'live' }"></view>
					<text class="ws-chip-text">{{ wsLabel }}</text>
				</view>
			</view>
		</view>

		<!-- Hero Stats -->
		<view class="hero-section">
			<view class="hero-stats">
				<text class="hero-count">{{ robotList.length }}</text>
				<text class="hero-label" :class="{ 'hero-label-active': onlineCount > 0 }">
					{{ onlineCount > 0 ? '活跃' : '无活跃' }}
				</text>
			</view>
			<view class="hero-tags" v-if="robotList.length > 0">
				<view class="hero-tag">
					<view class="hero-tag-dot hero-tag-dot-primary"></view>
					<text class="hero-tag-text">{{ robotList.length }} 台总计</text>
				</view>
				<view class="hero-tag hero-tag-secondary">
					<view class="hero-tag-dot hero-tag-dot-muted"></view>
					<text class="hero-tag-text">{{ robotList.length - onlineCount }} 待机</text>
				</view>
			</view>
		</view>

		<!-- Skeleton State -->
		<view v-if="showSkeleton" class="robot-list">
			<view v-for="i in 2" :key="'sk-' + i" class="robot-card skeleton-card">
				<view class="skeleton-header">
					<view class="skeleton-line skeleton-line-title"></view>
					<view class="skeleton-circle"></view>
				</view>
				<view class="skeleton-line skeleton-line-battery"></view>
				<view class="skeleton-divider"></view>
				<view class="skeleton-line skeleton-line-conn"></view>
			</view>
		</view>

		<!-- Empty State -->
		<view v-if="!showSkeleton && robotList.length === 0" class="empty-section">
			<text class="empty-hint">点击下方按钮绑定你的第一台机器人</text>
			<view class="add-card" hover-class="add-card-hover" @tap="openBindRobotSheet">
				<view class="add-icon-circle">
					<text class="add-icon">+</text>
				</view>
				<text class="add-text">添加机器人</text>
			</view>
		</view>

		<!-- Robot Cards -->
		<view v-if="!showSkeleton && robotList.length > 0" class="robot-list">
			<view
				v-for="robot in robotList"
				:key="robot.robotCode"
				class="robot-card"
				hover-class="robot-card-hover"
				@click="goToDetail(robot.robotCode)"
			>
				<!-- Header: name + icon -->
				<view class="card-header">
					<view class="card-identity">
						<text class="card-name">{{ robot.robotCode }}</text>
						<text class="card-serial">{{ robot.model || '未知型号' }}</text>
					</view>
					<view class="card-icon-wrap" :class="robot.online ? 'card-icon-online' : 'card-icon-offline'">
						<view class="robot-icon">
							<view class="robot-head" :class="robot.online ? 'robot-head-on' : 'robot-head-off'">
								<view class="robot-eye robot-eye-l"></view>
								<view class="robot-eye robot-eye-r"></view>
							</view>
							<view class="robot-body" :class="robot.online ? 'robot-body-on' : 'robot-body-off'"></view>
						</view>
					</view>
				</view>

				<!-- Battery: vehicle -->
				<view class="card-battery-row">
					<view class="card-battery-left">
						<view class="battery-3d">
							<view class="battery-3d-body" :class="getBatteryClass(robot.vehicleBattery)">
								<view class="battery-3d-fill" :style="{ width: getBatteryWidth(robot.vehicleBattery) }"></view>
							</view>
							<view class="battery-3d-tip"></view>
						</view>
						<text class="card-battery-pct">{{ formatBatteryDisplay(robot.vehicleBattery) }}</text>
					</view>
					<view class="card-status-chip" :class="robot.online ? 'chip-online' : 'chip-offline'">
						<text class="chip-text">{{ robot.online ? '工作中' : '待机中' }}</text>
					</view>
				</view>

				<!-- Divider -->
				<view class="card-divider"></view>

				<!-- Connection status -->
				<view class="card-conn-row">
					<text class="card-conn-label">连接状态</text>
					<view class="card-conn-value">
						<view v-if="!robot.online" class="conn-moon">☽</view>
						<view v-else class="conn-dot conn-dot-on"></view>
						<text class="conn-text">{{ robot.online ? '已连接' : '休眠' }}</text>
					</view>
				</view>
			</view>

			<!-- Add Card -->
			<view class="add-card" hover-class="add-card-hover" @tap="openBindRobotSheet">
				<view class="add-icon-circle">
					<text class="add-icon">+</text>
				</view>
				<text class="add-text">添加机器人</text>
			</view>
		</view>

		<BindRobotSheet
			:visible="bindSheetVisible"
			@close="closeBindRobotSheet"
			@success="handleBindSuccess"
		/>
	</view>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { formatBattery, formatDisplayTime } from '@/utils/format.js'
import { ensureLoginForCurrentPage, isLoggedIn } from '@/utils/auth.js'
import { profileState, ensureProfileLoaded } from '@/utils/profile-store.js'
import { robotListState, wsState, fetchRobotList, startAutoRefresh, stopAutoRefresh } from '@/utils/robot-store.js'
import BindRobotSheet from '@/components/BindRobotSheet.vue'

const DEFAULT_AVATAR = '/static/default-avatar.png'
const robotList = computed(() => robotListState.list)
const showSkeleton = computed(() => !robotListState.loaded && robotListState.loading)
const bindSheetVisible = ref(false)

const profile = computed(() => profileState.profile)
const displayAvatar = computed(() => {
	const avatar = String(profile.value?.avatar || '').trim()
	return avatar || DEFAULT_AVATAR
})
const displayNickname = computed(() => {
	const nickname = String(profile.value?.nickname || '').trim()
	if (nickname) return nickname
	const username = String(profile.value?.username || '').trim()
	return username || '我的设备'
})
const onlineCount = computed(() => robotList.value.filter(r => r.online).length)
const wsLabel = computed(() => {
	if (wsState.mode === 'live') return '实时'
	if (wsState.mode === 'polling') return '轮询'
	return '离线'
})

onShow(() => {
	if (!ensureLoginForCurrentPage()) return
	Promise.all([
		fetchRobotList().catch((e) => {
			// timeout 静默处理（冷启动/网络波动），等下次自动刷新恢复
			if (e && /timeout/i.test(String(e.message || e.errMsg || ''))) return
			uni.showToast({ title: e?.errMsg || e?.message || '获取机器人列表失败', icon: 'none' })
		}),
		isLoggedIn() ? ensureProfileLoaded().catch(() => {}) : Promise.resolve()
	])
	startAutoRefresh()
})

onMounted(() => {
	uni.$on('robot:bound', onRobotBound)
	uni.$on('robot:unbound', onRobotBound)
})

onBeforeUnmount(() => {
	stopAutoRefresh()
	uni.$off('robot:bound', onRobotBound)
	uni.$off('robot:unbound', onRobotBound)
})

onHide(() => {
	stopAutoRefresh()
})

onUnload(() => {
	stopAutoRefresh()
})

function goToDetail(robotCode) {
	uni.navigateTo({
		url: `/pages/robots/detail?robotCode=${robotCode}`
	})
}

function goProfile() {
	if (!isLoggedIn()) {
		uni.navigateTo({ url: '/pages/login/index' })
		return
	}
	uni.navigateTo({ url: '/pages/profile/index' })
}

function onRobotBound() {
	fetchRobotList({ force: true }).catch(() => {})
}

function openBindRobotSheet() {
	if (!ensureLoginForCurrentPage()) return
	bindSheetVisible.value = true
}

function closeBindRobotSheet() {
	bindSheetVisible.value = false
}

function handleBindSuccess() {
	closeBindRobotSheet()
	fetchRobotList({ force: true }).catch(() => {})
}

function formatBatteryDisplay(value) {
	if (value === null || value === undefined || value === '') return '--'
	return `${formatBattery(value)}%`
}

function getBatteryWidth(value) {
	if (value === null || value === undefined || value === '') return '0%'
	const num = Number(value)
	if (Number.isNaN(num)) return '0%'
	return `${Math.min(100, Math.max(0, num))}%`
}

function getBatteryClass(value) {
	if (value === null || value === undefined || value === '') return 'battery-empty'
	const num = Number(value)
	if (Number.isNaN(num) || num <= 0) return 'battery-empty'
	if (num <= 20) return 'battery-low'
	if (num <= 50) return 'battery-mid'
	return 'battery-high'
}

function getPackBatteryColor(value) {
	if (value === null || value === undefined || value === '') return '#7b7a7a'
	const num = Number(value)
	if (Number.isNaN(num) || num <= 0) return '#7b7a7a'
	if (num <= 20) return '#e53935'
	return '#e8845a'
}

</script>

<style scoped>
.page {
	min-height: 100vh;
	background-color: #F8F9FA;
	padding: 0 32rpx;
	padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
}

/* Header */
.page-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 24rpx 0 16rpx;
	padding-top: calc(var(--status-bar-height, 50px) + 20rpx);
}

.header-left {
	display: flex;
	align-items: center;
	gap: 16rpx;
}

.header-avatar {
	width: 72rpx;
	height: 72rpx;
	border-radius: 36rpx;
	background: #EADDFF;
}

.header-brand {
	font-size: 32rpx;
	font-weight: 700;
	color: #191C1D;
	letter-spacing: 0.5rpx;
}

.header-right {
	display: flex;
	align-items: center;
}

.ws-chip {
	display: flex;
	align-items: center;
	gap: 8rpx;
	padding: 8rpx 18rpx;
	border-radius: 999rpx;
	background: rgba(0, 0, 0, 0.04);
	transition: background 0.25s ease;
}

.ws-chip-live {
	background: rgba(16, 185, 129, 0.12);
}

.ws-chip-polling {
	background: rgba(249, 115, 22, 0.12);
}

.ws-chip-idle {
	background: rgba(120, 120, 120, 0.12);
}

.ws-dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 50%;
	background: #9ca3af;
	flex-shrink: 0;
}

.ws-chip-live .ws-dot {
	background: #10b981;
	box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5);
}

.ws-chip-polling .ws-dot {
	background: #f97316;
}

.ws-dot-pulse {
	animation: wsPulse 1.8s ease-out infinite;
}

@keyframes wsPulse {
	0% {
		box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.55);
	}
	70% {
		box-shadow: 0 0 0 12rpx rgba(16, 185, 129, 0);
	}
	100% {
		box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
	}
}

.ws-chip-text {
	font-size: 22rpx;
	font-weight: 600;
	line-height: 1;
	letter-spacing: 0.5rpx;
}

.ws-chip-live .ws-chip-text {
	color: #047857;
}

.ws-chip-polling .ws-chip-text {
	color: #c2410c;
}

.ws-chip-idle .ws-chip-text {
	color: #6b7280;
}

/* Hero */
.hero-section {
	padding: 24rpx 0 20rpx;
}

.hero-stats {
	display: flex;
	align-items: baseline;
	gap: 16rpx;
}

.hero-count {
	font-size: 96rpx;
	font-weight: 800;
	color: #191C1D;
	line-height: 1;
	letter-spacing: -2rpx;
}

.hero-label {
	font-size: 42rpx;
	font-weight: 700;
	color: #5427e6;
}

.hero-label-active {
	color: #5427e6;
}

.hero-tags {
	margin-top: 20rpx;
	display: flex;
	gap: 16rpx;
}

.hero-tag {
	display: flex;
	align-items: center;
	gap: 10rpx;
	padding: 8rpx 20rpx;
	border-radius: 999rpx;
	background: #f0eded;
}

.hero-tag-secondary {
	background: #f6f3f2;
}

.hero-tag-dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 50%;
}

.hero-tag-dot-primary {
	background: #5427e6;
}

.hero-tag-dot-muted {
	background: #b3b2b1;
}

.hero-tag-text {
	font-size: 24rpx;
	font-weight: 500;
	color: #5f5f5f;
}

/* Empty */
.empty-section {
	padding-top: 40rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.empty-hint {
	font-size: 26rpx;
	color: #9ca3af;
	margin-bottom: 32rpx;
}

/* Robot List */
.robot-list {
	display: flex;
	flex-direction: column;
	gap: 24rpx;
	padding-top: 8rpx;
}

/* Robot Card */
.robot-card {
	background: #FFFFFF;
	border-radius: 40rpx;
	padding: 40rpx;
	transition: transform 0.2s ease, opacity 0.2s ease;
}

.robot-card-hover {
	transform: scale(0.98);
	opacity: 0.95;
}

/* Card Header */
.card-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	margin-bottom: 36rpx;
}

.card-identity {
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}

.card-name {
	font-size: 38rpx;
	font-weight: 700;
	color: #191C1D;
	letter-spacing: -1rpx;
}

.card-serial {
	font-size: 20rpx;
	color: #7b7a7a;
	text-transform: uppercase;
	letter-spacing: 2rpx;
}

.card-icon-wrap {
	width: 88rpx;
	height: 88rpx;
	border-radius: 28rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.card-icon-online {
	background: rgba(84, 39, 230, 0.08);
}

.card-icon-offline {
	background: #f0eded;
}

/* Robot Icon */
.robot-icon {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4rpx;
}

.robot-head {
	width: 36rpx;
	height: 28rpx;
	border-radius: 10rpx 10rpx 6rpx 6rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
}

.robot-head-on {
	background: linear-gradient(180deg, #7c6dd8, #5427e6);
	box-shadow: 0 4rpx 10rpx rgba(84, 39, 230, 0.25);
}

.robot-head-off {
	background: linear-gradient(180deg, #b3b2b1, #9e9c9c);
}

.robot-eye {
	width: 8rpx;
	height: 8rpx;
	border-radius: 50%;
	background: #ffffff;
}

.robot-body {
	width: 30rpx;
	height: 18rpx;
	border-radius: 4rpx 4rpx 8rpx 8rpx;
}

.robot-body-on {
	background: linear-gradient(180deg, #5427e6, #4520c9);
	box-shadow: 0 3rpx 8rpx rgba(84, 39, 230, 0.2);
}

.robot-body-off {
	background: linear-gradient(180deg, #9e9c9c, #8a8888);
}

/* Battery Row */
.card-battery-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 8rpx 0;
}

.card-battery-left {
	display: flex;
	align-items: center;
	gap: 14rpx;
}

/* 3D Battery Icon */
.battery-3d {
	display: flex;
	align-items: center;
}

.battery-3d-body {
	width: 32rpx;
	height: 18rpx;
	border-radius: 5rpx;
	border: 3rpx solid #5427e6;
	background: rgba(84, 39, 230, 0.06);
	position: relative;
	overflow: hidden;
	box-shadow: 0 2rpx 6rpx rgba(84, 39, 230, 0.12);
}

.battery-3d-body.battery-low {
	border-color: #e53935;
	background: rgba(229, 57, 53, 0.06);
	box-shadow: 0 2rpx 6rpx rgba(229, 57, 53, 0.12);
}

.battery-3d-fill {
	position: absolute;
	left: 0;
	top: 0;
	bottom: 0;
	background: linear-gradient(180deg, #7c6dd8, #5427e6);
	border-radius: 2rpx;
	transition: width 0.6s ease;
}

.battery-low .battery-3d-fill {
	background: linear-gradient(180deg, #ef5350, #e53935);
}

.battery-3d-tip {
	width: 5rpx;
	height: 8rpx;
	background: linear-gradient(180deg, #7c6dd8, #5427e6);
	border-radius: 0 3rpx 3rpx 0;
	margin-left: 1rpx;
	box-shadow: 0 2rpx 4rpx rgba(84, 39, 230, 0.15);
}

.battery-low + .battery-3d-tip {
	background: linear-gradient(180deg, #ef5350, #e53935);
}

.card-battery-pct {
	font-size: 28rpx;
	font-weight: 600;
	color: #191C1D;
}

/* Status Chip */
.card-status-chip {
	padding: 6rpx 16rpx;
	border-radius: 999rpx;
}

.chip-online {
	background: rgba(84, 39, 230, 0.08);
}

.chip-offline {
	background: #f0eded;
}

.chip-text {
	font-size: 22rpx;
	font-weight: 500;
	color: #5427e6;
}

.chip-offline .chip-text {
	color: #7b7a7a;
}

/* Divider */
.card-divider {
	height: 1rpx;
	background: #f0eded;
	margin: 18rpx 0;
}

/* Connection Row */
.card-conn-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.card-conn-label {
	font-size: 26rpx;
	color: #7b7a7a;
}

.card-conn-value {
	display: flex;
	align-items: center;
	gap: 10rpx;
}

.conn-dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 50%;
}

.conn-dot-on {
	background: #22c55e;
	will-change: transform, opacity;
	animation: pulse-ring 2s ease-in-out infinite;
}

.conn-moon {
	font-size: 24rpx;
	line-height: 1;
	color: #5427e6;
}

.conn-text {
	font-size: 26rpx;
	font-weight: 500;
	color: #191C1D;
}

@keyframes pulse-ring {
	0%, 100% { opacity: 1; transform: scale3d(1, 1, 1); }
	50% { opacity: 0.6; transform: scale3d(1.4, 1.4, 1); }
}

/* Add Card */
.add-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 16rpx;
	padding: 48rpx 24rpx;
	border-radius: 24rpx;
	border: 3rpx dashed #D1C4E9;
	background: transparent;
	transition: transform 0.2s ease, opacity 0.2s ease;
}

.add-card-hover {
	transform: scale(0.98);
	opacity: 0.85;
}

.add-icon-circle {
	width: 72rpx;
	height: 72rpx;
	border-radius: 50%;
	background: #F3F4F6;
	display: flex;
	align-items: center;
	justify-content: center;
}

.add-icon {
	font-size: 40rpx;
	font-weight: 300;
	color: #5427e6;
	line-height: 1;
}

.add-text {
	font-size: 28rpx;
	font-weight: 500;
	color: #6b7280;
}

/* Skeleton */
.skeleton-card {
	padding: 40rpx;
}

.skeleton-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 36rpx;
}

.skeleton-line {
	border-radius: 8rpx;
	background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
	background-size: 400% 100%;
	animation: skeleton-shimmer 1.4s ease infinite;
}

.skeleton-line-title {
	width: 200rpx;
	height: 36rpx;
}

.skeleton-circle {
	width: 88rpx;
	height: 88rpx;
	border-radius: 28rpx;
	background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
	background-size: 400% 100%;
	animation: skeleton-shimmer 1.4s ease infinite;
}

.skeleton-line-battery {
	width: 60%;
	height: 24rpx;
	margin-bottom: 18rpx;
}

.skeleton-divider {
	height: 1rpx;
	background: #f0eded;
	margin: 18rpx 0;
}

.skeleton-line-conn {
	width: 40%;
	height: 24rpx;
}

@keyframes skeleton-shimmer {
	0% { background-position: 100% 0; }
	100% { background-position: -100% 0; }
}
</style>
