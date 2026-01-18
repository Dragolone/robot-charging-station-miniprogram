<template>
	<view class="page">
		<!-- Custom Nav Bar -->
		<view class="nav-bar">
			<view class="nav-bar-inner">
				<view class="nav-back" @click="goBack">
					<uni-icons type="left" size="22" color="#5427e6"></uni-icons>
				</view>
				<text class="nav-title">{{ robotDetail?.robotCode || '加载中' }}</text>
				<view class="nav-actions">
					<view class="nav-action-btn" @click="showMoreMenu">
						<uni-icons type="more-filled" size="22" color="#1f2430"></uni-icons>
					</view>
				</view>
			</view>
		</view>

		<scroll-view scroll-y class="scroll-content">
			<view class="page-content">

				<!-- Skeleton (first load only) -->
				<view v-if="!robotDetail" class="detail-skeleton">
					<view class="detail-sk-card">
						<view class="detail-sk-line detail-sk-line-lg"></view>
						<view class="detail-sk-line detail-sk-line-md"></view>
						<view class="detail-sk-line detail-sk-line-sm"></view>
					</view>
					<view class="detail-sk-grid">
						<view class="detail-sk-box"></view>
						<view class="detail-sk-box"></view>
					</view>
				</view>

				<!-- Device Profile Card -->
				<view v-if="robotDetail" class="profile-card">
					<view class="profile-label">设备概况</view>
					<view class="profile-header">
						<view class="profile-name-row">
							<text class="profile-name">{{ displayText(robotDetail?.robotCode) }}</text>
							<view class="model-chip" v-if="robotDetail?.model">
								<text class="model-chip-text">{{ robotDetail.model }}</text>
							</view>
						</view>
						<view class="status-badge" :class="robotDetail?.online ? 'is-online' : 'is-offline'">
							<view class="status-dot" :class="robotDetail?.online ? 'dot-online' : 'dot-offline'"></view>
							<text class="status-text">{{ getOnlineStatusText(robotDetail?.online) }}</text>
						</view>
					</view>
					<view class="profile-meta">
						<text class="profile-meta-text">最后在线: {{ formatDisplayTime(robotDetail?.lastSeen) }}</text>
						<text class="profile-meta-text">任务: {{ getTaskStatusText() }}</text>
					</view>
				</view>

				<!-- Bento Stats Grid -->
				<view class="bento-grid">
					<view class="bento-card">
						<view class="bento-icon-wrap bento-icon-battery">
							<view class="battery-icon">
								<view class="battery-icon-body"></view>
								<view class="battery-icon-tip"></view>
							</view>
						</view>
						<text class="bento-label">车体电量</text>
						<text class="bento-value">{{ displayBattery(robotDetail?.vehicleBattery) }}</text>
						<view class="bento-bar-track" v-if="hasDisplayValue(robotDetail?.vehicleBattery)">
							<view class="bento-bar-fill" :class="getBatteryBarClass(robotDetail?.vehicleBattery, 'primary')" :style="{ width: getBatteryPercent(robotDetail?.vehicleBattery) + '%' }"></view>
						</view>
					</view>
					<view class="bento-card">
						<view class="bento-icon-wrap bento-icon-pack">
							<uni-icons type="wallet-filled" size="18" color="#e8845a"></uni-icons>
						</view>
						<text class="bento-label">电池包</text>
						<text class="bento-value">{{ displayBattery(robotDetail?.packBattery) }}</text>
						<view class="bento-bar-track" v-if="hasDisplayValue(robotDetail?.packBattery)">
							<view class="bento-bar-fill" :class="getBatteryBarClass(robotDetail?.packBattery, 'orange')" :style="{ width: getBatteryPercent(robotDetail?.packBattery) + '%' }"></view>
						</view>
					</view>
					<view class="bento-card">
						<view class="bento-icon-wrap bento-icon-fault">
							<uni-icons type="info-filled" size="18" color="#e25c5c"></uni-icons>
						</view>
						<text class="bento-label">故障</text>
						<text class="bento-value" :class="{ 'bento-value-warn': faults.length > 0 }">{{ getFaultCountText() }} 项</text>
					</view>
					<view class="bento-card">
						<view class="bento-icon-wrap bento-icon-location">
							<uni-icons type="location-filled" size="18" color="#47a16c"></uni-icons>
						</view>
						<text class="bento-label">坐标</text>
						<text class="bento-value bento-value-small">{{ formatLocation(robotDetail?.location) }}</text>
					</view>
				</view>

				<!-- Control Center -->
				<view class="section-card">
					<view class="section-header">
						<text class="section-title">控制中心</text>
						<text class="section-status">{{ controlStatusText }}</text>
					</view>

					<!-- D-Pad -->
					<view class="control-area">
						<view class="control-sub-header">
							<text class="control-sub-label">方向控制</text>
							<text class="control-sub-hint">{{ dpadActive ? dpadStatusText : '长按持续移动' }}</text>
						</view>
						<view class="dpad-wrap">
							<view class="dpad">
								<view class="dpad-row">
									<view class="dpad-btn" :class="{ 'dpad-btn-active': dpadActive && dpadDirection === 'forward', 'dpad-btn-disabled': !robotDetail?.online }"
										@touchstart.stop.prevent="startDpad('forward')"
										@touchend.stop.prevent="stopDpad"
										@touchcancel.stop.prevent="stopDpad">
										<text class="dpad-icon">↑</text>
									</view>
								</view>
								<view class="dpad-row dpad-row-mid">
									<view class="dpad-btn" :class="{ 'dpad-btn-active': dpadActive && dpadDirection === 'left', 'dpad-btn-disabled': !robotDetail?.online }"
										@touchstart.stop.prevent="startDpad('left')"
										@touchend.stop.prevent="stopDpad"
										@touchcancel.stop.prevent="stopDpad">
										<text class="dpad-icon">←</text>
									</view>
									<view class="dpad-btn dpad-stop" :class="{ 'dpad-btn-disabled': !robotDetail?.online }"
										@touchstart.stop.prevent="handleStopTap">
										<text class="dpad-stop-text">停</text>
									</view>
									<view class="dpad-btn" :class="{ 'dpad-btn-active': dpadActive && dpadDirection === 'right', 'dpad-btn-disabled': !robotDetail?.online }"
										@touchstart.stop.prevent="startDpad('right')"
										@touchend.stop.prevent="stopDpad"
										@touchcancel.stop.prevent="stopDpad">
										<text class="dpad-icon">→</text>
									</view>
								</view>
								<view class="dpad-row">
									<view class="dpad-btn" :class="{ 'dpad-btn-active': dpadActive && dpadDirection === 'backward', 'dpad-btn-disabled': !robotDetail?.online }"
										@touchstart.stop.prevent="startDpad('backward')"
										@touchend.stop.prevent="stopDpad"
										@touchcancel.stop.prevent="stopDpad">
										<text class="dpad-icon">↓</text>
									</view>
								</view>
							</view>
						</view>
					</view>

					<!-- Joystick + Rotate -->
					<view class="control-area">
						<view class="control-sub-header">
							<text class="control-sub-label">虚拟摇杆</text>
							<text class="control-sub-hint">{{ isSendingCommand && sendingActionKey === 'joystick' ? sendingStatusText : '按住拖动' }}</text>
						</view>
						<view class="joystick-wrap">
							<view class="joystick-readout">
								<text class="joystick-readout-item">vx: {{ joystickValueY.toFixed(2) }}</text>
								<text class="joystick-readout-item">vy: {{ joystickValueX.toFixed(2) }}</text>
							</view>
							<view class="joystick-row">
								<!-- 逆时针旋转 -->
								<view class="rotate-btn" :class="{ 'rotate-btn-active': dpadActive && dpadDirection === 'rotate_left', 'rotate-btn-disabled': !robotDetail?.online }"
									@touchstart.stop.prevent="startDpad('rotate_left')"
									@touchend.stop.prevent="stopDpad"
									@touchcancel.stop.prevent="stopDpad">
									<text class="rotate-icon">↺</text>
									<text class="rotate-label">逆时针</text>
								</view>

								<view class="joystick-area"
									@touchstart.stop.prevent="handleJoystickStart"
									@touchmove.stop.prevent="handleJoystickMove"
									@touchend.stop.prevent="handleJoystickEnd"
									@touchcancel.stop.prevent="handleJoystickEnd">
									<view class="joystick-ring"></view>
									<view class="joystick-cross joystick-cross-x"></view>
									<view class="joystick-cross joystick-cross-y"></view>
									<view class="joystick-knob" :style="joystickKnobStyle"></view>
								</view>

								<!-- 顺时针旋转 -->
								<view class="rotate-btn" :class="{ 'rotate-btn-active': dpadActive && dpadDirection === 'rotate_right', 'rotate-btn-disabled': !robotDetail?.online }"
									@touchstart.stop.prevent="startDpad('rotate_right')"
									@touchend.stop.prevent="stopDpad"
									@touchcancel.stop.prevent="stopDpad">
									<text class="rotate-icon">↻</text>
									<text class="rotate-label">顺时针</text>
								</view>
							</view>
							<text class="joystick-tip">松手自动发送停止指令</text>
						</view>
					</view>

					<!-- Send Position -->
					<view class="control-area">
						<view class="control-sub-header">
							<text class="control-sub-label">目标点位</text>
							<text class="control-sub-hint" v-if="lastGotoTarget">上次: ({{ lastGotoTarget.x }}, {{ lastGotoTarget.y }})</text>
						</view>
						<view class="goto-group">
							<!-- Last target quick-fill -->
							<view class="goto-last-row" v-if="lastGotoTarget" @tap="applyLastGoto">
								<text class="goto-last-label">快速填入上次目标</text>
								<text class="goto-last-value">({{ lastGotoTarget.x }}, {{ lastGotoTarget.y }})</text>
								<text class="goto-last-arrow">›</text>
							</view>

							<!-- Favorite chips -->
							<view class="goto-fav-row" v-if="gotoFavorites.length > 0">
								<view class="goto-fav-chip" v-for="(fav, idx) in gotoFavorites" :key="idx" @tap="applyFavorite(fav)">
									<text class="goto-fav-chip-text">{{ fav.name || `(${fav.x}, ${fav.y})` }}</text>
									<text class="goto-fav-chip-del" @tap.stop="removeFavorite(idx)">×</text>
								</view>
							</view>

							<view class="goto-input-row">
								<view class="goto-input-item">
									<text class="goto-input-label">X</text>
									<input class="goto-input" type="digit" v-model="positionX" placeholder="X坐标"
										:disabled="!robotDetail?.online || isSendingCommand" />
								</view>
								<view class="goto-input-item">
									<text class="goto-input-label">Y</text>
									<input class="goto-input" type="digit" v-model="positionY" placeholder="Y坐标"
										:disabled="!robotDetail?.online || isSendingCommand" />
								</view>
							</view>
							<view class="goto-btn-row">
								<button class="goto-btn goto-btn-main" :disabled="!robotDetail?.online || isSendingCommand"
									:loading="isSendingCommand && sendingActionKey === 'goto'"
									@click="handleSendPosition">
									发送点位
								</button>
								<view class="goto-btn-fav" :class="{ 'goto-btn-fav-disabled': !positionX || !positionY }" @tap="saveCurrentAsFavorite">
									<uni-icons type="star" size="18" :color="positionX && positionY ? '#5427e6' : '#9ca3af'"></uni-icons>
								</view>
							</view>
						</view>
					</view>
				</view>

				<!-- Detailed Specs -->
				<view class="section-card">
					<view class="section-header">
						<text class="section-title">设备详情</text>
					</view>
					<view class="spec-list">
						<view class="spec-row">
							<text class="spec-label">设备编号</text>
							<text class="spec-value">{{ displayText(robotDetail?.robotCode) }}</text>
						</view>
						<view class="spec-row">
							<text class="spec-label">型号</text>
							<text class="spec-value">{{ displayText(robotDetail?.model) }}</text>
						</view>
						<view class="spec-row">
							<text class="spec-label">联网状态</text>
							<text class="spec-value" :class="robotDetail?.online ? 'spec-online' : 'spec-offline'">
								{{ getOnlineStatusText(robotDetail?.online) }}
							</text>
						</view>
						<view class="spec-row">
							<text class="spec-label">最后在线</text>
							<text class="spec-value">{{ formatDisplayTime(robotDetail?.lastSeen) }}</text>
						</view>
						<view class="spec-row">
							<text class="spec-label">车体电量</text>
							<text class="spec-value">{{ displayBattery(robotDetail?.vehicleBattery) }}</text>
						</view>
						<view class="spec-row">
							<text class="spec-label">电池包电量</text>
							<text class="spec-value">{{ displayBattery(robotDetail?.packBattery) }}</text>
						</view>
						<view class="spec-row spec-row-last">
							<text class="spec-label">当前位置</text>
							<text class="spec-value">{{ formatLocation(robotDetail?.location) }}</text>
						</view>
					</view>
				</view>

				<!-- Fault List -->
				<view class="section-card" v-if="faults.length > 0">
					<view class="section-header">
						<text class="section-title">故障记录</text>
						<text class="section-badge">{{ faults.length }}</text>
					</view>
					<view class="fault-list">
						<view v-for="(fault, index) in faults" :key="index" class="fault-item">
							<view class="fault-item-top">
								<text class="fault-code">{{ displayText(fault.code) }}</text>
								<text class="fault-time">{{ formatDisplayTime(fault.time || fault.ts) }}</text>
							</view>
							<text class="fault-msg">{{ displayText(fault.message) }}</text>
						</view>
					</view>
				</view>

				<!-- Map Placeholder -->
				<view class="section-card section-card-last">
					<view class="section-header">
						<text class="section-title">位置示意</text>
						<text class="section-sub">{{ formatLocation(robotDetail?.location) }}</text>
					</view>
					<view class="map-placeholder">
						<uni-icons type="location" size="32" color="#b2b7c7"></uni-icons>
						<text class="map-placeholder-text">地图功能开发中</text>
					</view>
				</view>

			</view>
		</scroll-view>
	</view>
</template>

<script setup>
import { computed, getCurrentInstance, onBeforeUnmount, ref } from 'vue'
import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import { formatBattery, formatDisplayTime, formatCoordinate, formatLocation } from '@/utils/format.js'
import { ensureLoginForCurrentPage } from '@/utils/auth.js'
import { getCachedDetail, setCachedDetail } from '@/utils/robot-store.js'

const robotCode = ref('')
const robotDetail = ref(null)
const positionX = ref('')
const positionY = ref('')
const faults = ref([])
const isSendingCommand = ref(false)
const sendingActionKey = ref('')
const sendingStatusText = ref('')
const joystickOffsetX = ref(0)
const joystickOffsetY = ref(0)
const joystickValueX = ref(0)
const joystickValueY = ref(0)

const EMPTY_TEXT = '暂无数据'
const JOYSTICK_SEND_INTERVAL_MS = 200
const JOYSTICK_CHANGE_EPSILON = 0.08
const JOYSTICK_DEADZONE = 0.05
const DPAD_SEND_INTERVAL_MS = 200
const GOTO_STORAGE_KEY = 'robot_goto_favorites'
const GOTO_LAST_KEY = 'robot_goto_last'
const pageInstance = getCurrentInstance()
let joystickRect = null
let joystickMoveTimer = null
let joystickActive = false
let joystickMoveInFlight = false
let joystickStopPending = false
let lastSentJoystickPayload = null

// D-pad continuous control state
const dpadActive = ref(false)
const dpadDirection = ref('')
const dpadStatusText = ref('')
let dpadTimer = null
let dpadInFlight = false

// Goto favorites
const gotoFavorites = ref([])
const lastGotoTarget = ref(null)

const userService = uniCloud.importObject('userService', {
	customUI: true,
	errorOptions: { type: 'toast' }
})

const joystickKnobStyle = computed(() => ({
	left: `calc(50% + ${joystickOffsetX.value}px)`,
	top: `calc(50% + ${joystickOffsetY.value}px)`
}))

const controlStatusText = computed(() => {
	if (isSendingCommand.value) return sendingStatusText.value
	return robotDetail.value?.online ? '在线可控制' : '离线不可控制'
})

onShow(() => {
	if (!ensureLoginForCurrentPage()) return
	const pages = getCurrentPages()
	const currentPage = pages[pages.length - 1]
	const options = currentPage.options || {}
	robotCode.value = options.robotCode || ''

	loadGotoData()

	if (robotCode.value) {
		// Stale-while-revalidate: show cached data instantly, then refresh
		const cached = getCachedDetail(robotCode.value)
		if (cached) {
			robotDetail.value = cached.robotDetail
			faults.value = cached.faults || []
		}
		loadRobotDetail()
	}
})

onHide(() => {
	void stopDpad()
	void stopJoystickControl({ sendStop: true, silent: true })
})

onUnload(() => {
	void stopDpad()
	void stopJoystickControl({ sendStop: true, silent: true })
})

onBeforeUnmount(() => {
	void stopDpad()
	void stopJoystickControl({ sendStop: true, silent: true })
})

function goBack() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/robots/index' }) })
}

async function loadRobotDetail() {
	try {
		const data = await userService.getMyRobotDetail(robotCode.value)
		const robot = data.robot || {}
		const telemetry = data.telemetry_latest || {}

		faults.value = data.faults || []
		const detail = {
			...robot,
			robotCode: String(robot.robotCode || robotCode.value || '').trim(),
			online: !!telemetry.isOnline,
			onlineStatusText: telemetry.onlineStatusText || (telemetry.isOnline ? '在线' : '离线'),
			location: telemetry.location || robot.location || null,
			vehicleBattery: telemetry.vehicleBattery,
			packBattery: telemetry.packBattery,
			lastSeen: telemetry.lastSeen,
			lastOnlineTime: telemetry.lastOnlineTime || telemetry.lastSeen,
			taskStatus: telemetry.taskStatus || EMPTY_TEXT,
			rawTelemetry: telemetry.rawTelemetry || null
		}
		robotDetail.value = detail
		setCachedDetail(robotCode.value, { robotDetail: detail, faults: data.faults || [] })
	} catch (e) {
		uni.showToast({ title: e?.errMsg || e?.message || '获取详情失败', icon: 'none' })
		robotDetail.value = null
		faults.value = []
	}
}

function hasDisplayValue(value) {
	if (value === null || value === undefined) return false
	if (typeof value === 'number') return !Number.isNaN(value)
	return String(value).trim() !== ''
}

function displayText(value, fallback = EMPTY_TEXT) {
	if (!hasDisplayValue(value)) return fallback
	return String(value)
}

function displayBattery(value) {
	if (!hasDisplayValue(value)) return EMPTY_TEXT
	return `${formatBattery(value)}%`
}

function getBatteryPercent(value) {
	if (!hasDisplayValue(value)) return 0
	const num = Number(value)
	if (Number.isNaN(num)) return 0
	return Math.max(0, Math.min(100, num > 1 ? num : num * 100))
}

function getBatteryBarClass(value, normalClass) {
	const pct = getBatteryPercent(value)
	return pct <= 20 ? 'bento-bar-danger' : `bento-bar-${normalClass}`
}

function getOnlineStatusText(online) {
	if (robotDetail.value?.onlineStatusText) return robotDetail.value.onlineStatusText
	return online ? '在线' : '离线'
}

function getTaskStatusText() {
	return robotDetail.value?.taskStatus || EMPTY_TEXT
}

function getFaultCountText() {
	return String((faults.value && faults.value.length) || 0)
}

function getCurrentRobotCode() {
	return String(robotDetail.value?.robotCode || robotCode.value || '').trim()
}

function roundTo2(value) {
	return Math.round(value * 100) / 100
}

function clampValue(value, min, max) {
	return Math.min(max, Math.max(min, value))
}

function resetJoystickVisual() {
	joystickOffsetX.value = 0
	joystickOffsetY.value = 0
	joystickValueX.value = 0
	joystickValueY.value = 0
}

function stopJoystickLoop() {
	if (joystickMoveTimer) {
		clearInterval(joystickMoveTimer)
		joystickMoveTimer = null
	}
}

function startJoystickLoop() {
	stopJoystickLoop()
	joystickMoveTimer = setInterval(() => {
		void flushJoystickMove(false)
	}, JOYSTICK_SEND_INTERVAL_MS)
}

function hasMeaningfulJoystickChange(nextPayload, prevPayload) {
	if (!prevPayload) return true
	return (
		Math.abs((nextPayload.vx || 0) - (prevPayload.vx || 0)) >= JOYSTICK_CHANGE_EPSILON ||
		Math.abs((nextPayload.vy || 0) - (prevPayload.vy || 0)) >= JOYSTICK_CHANGE_EPSILON
	)
}

function getJoystickPayload() {
	return {
		vx: joystickValueY.value,
		vy: joystickValueX.value,
		wz: 0,
		enable: true
	}
}

function getTouchPoint(event) {
	const touch = event?.touches?.[0] || event?.changedTouches?.[0]
	if (!touch) return null
	return {
		x: Number(touch.clientX ?? touch.pageX ?? 0),
		y: Number(touch.clientY ?? touch.pageY ?? 0)
	}
}

function getJoystickQuery() {
	if (pageInstance?.proxy) {
		return uni.createSelectorQuery().in(pageInstance.proxy)
	}
	return uni.createSelectorQuery()
}

function measureJoystickRect() {
	return new Promise((resolve, reject) => {
		getJoystickQuery()
			.select('.joystick-area')
			.boundingClientRect((rect) => {
				if (rect && rect.width && rect.height) {
					resolve(rect)
					return
				}
				reject(new Error('摇杆区域初始化失败'))
			})
			.exec()
	})
}

function updateJoystickByPoint(point) {
	if (!joystickRect || !point) return

	const centerX = joystickRect.left + joystickRect.width / 2
	const centerY = joystickRect.top + joystickRect.height / 2
	const maxDistance = Math.min(joystickRect.width, joystickRect.height) * 0.32
	if (!maxDistance) return

	let dx = point.x - centerX
	let dy = point.y - centerY
	const distance = Math.hypot(dx, dy)
	if (distance > maxDistance) {
		const scale = maxDistance / distance
		dx *= scale
		dy *= scale
	}

	let normalizedX = roundTo2(clampValue(dx / maxDistance, -1, 1))
	let normalizedY = roundTo2(clampValue(-dy / maxDistance, -1, 1))
	if (Math.abs(normalizedX) < JOYSTICK_DEADZONE) normalizedX = 0
	if (Math.abs(normalizedY) < JOYSTICK_DEADZONE) normalizedY = 0

	joystickOffsetX.value = dx
	joystickOffsetY.value = dy
	joystickValueX.value = normalizedX
	joystickValueY.value = normalizedY
}

async function sendJoystickStop(silent = true) {
	const currentRobotCode = getCurrentRobotCode()
	const shouldSendStop = !!currentRobotCode && !!lastSentJoystickPayload
	joystickStopPending = false
	joystickActive = false
	stopJoystickLoop()
	resetJoystickVisual()

	if (!shouldSendStop) {
		lastSentJoystickPayload = null
		isSendingCommand.value = false
		sendingActionKey.value = ''
		sendingStatusText.value = ''
		return
	}

	joystickMoveInFlight = true
	isSendingCommand.value = true
	sendingActionKey.value = 'joystick'
	sendingStatusText.value = '停止中...'

	try {
		await userService.sendCommand({
			robotCode: currentRobotCode,
			type: 'stop'
		})

		if (!silent) {
			uni.showToast({
				title: '已发送停止指令',
				icon: 'success',
				duration: 1200
			})
		}
	} catch (e) {
		if (!silent) {
			uni.showToast({
				title: e?.errMsg || e?.message || '停止失败',
				icon: 'none',
				duration: 2200
			})
		}
	} finally {
		joystickMoveInFlight = false
		lastSentJoystickPayload = null
		isSendingCommand.value = false
		sendingActionKey.value = ''
		sendingStatusText.value = ''
	}
}

async function stopJoystickControl(options = {}) {
	const { sendStop = true, silent = true } = options
	const hasMoveToStop =
		!!lastSentJoystickPayload || Math.abs(joystickValueX.value) > 0 || Math.abs(joystickValueY.value) > 0

	joystickActive = false
	stopJoystickLoop()
	resetJoystickVisual()

	if (!sendStop || !hasMoveToStop) {
		joystickStopPending = false
		lastSentJoystickPayload = null
		if (sendingActionKey.value === 'joystick') {
			isSendingCommand.value = false
			sendingActionKey.value = ''
			sendingStatusText.value = ''
		}
		return
	}

	if (joystickMoveInFlight) {
		joystickStopPending = true
		sendingStatusText.value = '停止中...'
		return
	}

	await sendJoystickStop(silent)
}

async function flushJoystickMove(force = false) {
	if (!joystickActive || joystickMoveInFlight) return
	if (!robotDetail.value?.online) return

	const currentRobotCode = getCurrentRobotCode()
	if (!currentRobotCode) return

	const nextPayload = getJoystickPayload()
	if (nextPayload.vx === 0 && nextPayload.vy === 0 && nextPayload.wz === 0) return
	if (!force && !hasMeaningfulJoystickChange(nextPayload, lastSentJoystickPayload)) return

	joystickMoveInFlight = true
	isSendingCommand.value = true
	sendingActionKey.value = 'joystick'
	sendingStatusText.value = '摇杆控制中...'

	try {
		await userService.sendCommand({
			robotCode: currentRobotCode,
			type: 'move',
			params: nextPayload
		})
		lastSentJoystickPayload = { ...nextPayload }
	} catch (e) {
		uni.showToast({
			title: e?.errMsg || e?.message || '摇杆发送失败',
			icon: 'none',
			duration: 2200
		})
		joystickStopPending = !!lastSentJoystickPayload
		joystickActive = false
		stopJoystickLoop()
		resetJoystickVisual()
	} finally {
		joystickMoveInFlight = false
		if (joystickStopPending) {
			await sendJoystickStop(true)
		} else if (!joystickActive && sendingActionKey.value === 'joystick') {
			isSendingCommand.value = false
			sendingActionKey.value = ''
			sendingStatusText.value = ''
		}
	}
}

async function handleJoystickStart(event) {
	if (!robotDetail.value?.online) {
		uni.showToast({
			title: '设备离线不可控制',
			icon: 'none',
			duration: 2000
		})
		return
	}

	if (isSendingCommand.value && sendingActionKey.value && sendingActionKey.value !== 'joystick') {
		uni.showToast({
			title: '指令发送中，请稍候',
			icon: 'none',
			duration: 1600
		})
		return
	}

	try {
		joystickRect = await measureJoystickRect()
	} catch (e) {
		uni.showToast({
			title: e?.message || '摇杆区域初始化失败',
			icon: 'none'
		})
		return
	}

	const point = getTouchPoint(event)
	if (!point) return

	joystickActive = true
	joystickStopPending = false
	isSendingCommand.value = true
	sendingActionKey.value = 'joystick'
	sendingStatusText.value = '摇杆控制中...'
	updateJoystickByPoint(point)
	startJoystickLoop()
	await flushJoystickMove(true)
}

function handleJoystickMove(event) {
	if (!joystickActive) return
	const point = getTouchPoint(event)
	if (!point) return
	updateJoystickByPoint(point)
}

function handleJoystickEnd() {
	void stopJoystickControl({ sendStop: true, silent: true })
}

async function sendRobotCommand(actionKey, pendingText, requestFactory, successText, failFallback) {
	if (isSendingCommand.value) return false

	isSendingCommand.value = true
	sendingActionKey.value = actionKey
	sendingStatusText.value = pendingText

	try {
		await requestFactory()
		uni.showToast({
			title: successText,
			icon: 'success',
			duration: 1500
		})
		return true
	} catch (e) {
		const message = e?.errMsg || e?.message || failFallback
		uni.showToast({
			title: message,
			icon: 'none',
			duration: 2200
		})
		return false
	} finally {
		isSendingCommand.value = false
		sendingActionKey.value = ''
		sendingStatusText.value = ''
	}
}

const DIRECTION_NAMES = { forward: '前进', backward: '后退', left: '左转', right: '右转', rotate_left: '逆时针旋转', rotate_right: '顺时针旋转' }
const DPAD_VELOCITY = {
	forward:      { vx: 1.0,  vy: 0, wz: 0, enable: true },
	backward:     { vx: -1.0, vy: 0, wz: 0, enable: true },
	left:         { vx: 0, vy: 0, wz: 0.45, enable: true },
	right:        { vx: 0, vy: 0, wz: -0.45, enable: true },
	rotate_left:  { vx: 0, vy: 0, wz: 0.45, enable: true },
	rotate_right: { vx: 0, vy: 0, wz: -0.45, enable: true }
}

function startDpad(direction) {
	if (!robotDetail.value?.online) {
		uni.showToast({ title: '设备离线不可控制', icon: 'none', duration: 2000 })
		return
	}
	if (isSendingCommand.value && sendingActionKey.value && sendingActionKey.value !== 'dpad') return

	dpadActive.value = true
	dpadDirection.value = direction
	dpadStatusText.value = `${DIRECTION_NAMES[direction]}中...`
	isSendingCommand.value = true
	sendingActionKey.value = 'dpad'
	sendingStatusText.value = dpadStatusText.value

	flushDpadCommand()
	dpadTimer = setInterval(() => {
		flushDpadCommand()
	}, DPAD_SEND_INTERVAL_MS)
}

async function flushDpadCommand() {
	if (!dpadActive.value || dpadInFlight) return
	const currentRobotCode = getCurrentRobotCode()
	if (!currentRobotCode) return

	const vel = DPAD_VELOCITY[dpadDirection.value]
	if (!vel) return

	dpadInFlight = true
	try {
		await userService.sendCommand({
			robotCode: currentRobotCode,
			type: 'move',
			params: vel
		})
	} catch (e) {
		// silent — continuous mode tolerates individual failures
	} finally {
		dpadInFlight = false
	}
}

async function stopDpad() {
	if (!dpadActive.value) return
	const hadDirection = !!dpadDirection.value
	dpadActive.value = false
	dpadDirection.value = ''
	dpadStatusText.value = ''
	if (dpadTimer) {
		clearInterval(dpadTimer)
		dpadTimer = null
	}

	if (hadDirection) {
		const currentRobotCode = getCurrentRobotCode()
		if (currentRobotCode) {
			try {
				await userService.sendCommand({ robotCode: currentRobotCode, type: 'stop' })
			} catch (e) {
				// silent
			}
		}
	}

	if (sendingActionKey.value === 'dpad') {
		isSendingCommand.value = false
		sendingActionKey.value = ''
		sendingStatusText.value = ''
	}
}

function handleStopTap() {
	if (!robotDetail.value?.online) {
		uni.showToast({ title: '设备离线不可控制', icon: 'none', duration: 2000 })
		return
	}
	const currentRobotCode = getCurrentRobotCode()
	if (!currentRobotCode) return
	sendRobotCommand('direction-stop', '停止中...', () =>
		userService.sendCommand({ robotCode: currentRobotCode, type: 'stop' }),
		'已停止', '停止失败'
	)
}

async function handleSendPosition() {
	if (!robotDetail.value?.online) {
		uni.showToast({
			title: '设备离线不可控制',
			icon: 'none',
			duration: 2000
		})
		return
	}

	if (!positionX.value || !positionY.value) {
		uni.showToast({
			title: '请输入完整的坐标',
			icon: 'none',
			duration: 2000
		})
		return
	}

	const payload = {
		x: Number(positionX.value),
		y: Number(positionY.value)
	}
	const currentRobotCode = getCurrentRobotCode()
	if (!currentRobotCode) {
		uni.showToast({ title: '未获取到机器人编号', icon: 'none' })
		return
	}

	const sent = await sendRobotCommand(
		'goto',
		'点位发送中...',
		() => userService.sendCommand({
			robotCode: currentRobotCode,
			type: 'goto',
			payload
		}),
		`点位指令已发送`,
		'发送点位失败'
	)

	if (sent) {
		saveLastGoto(payload.x, payload.y)
		positionX.value = ''
		positionY.value = ''
	}
}

// ── Goto Favorites & Last Target ──

function loadGotoData() {
	try {
		const raw = uni.getStorageSync(GOTO_STORAGE_KEY)
		if (raw) gotoFavorites.value = JSON.parse(raw)
	} catch (e) { /* ignore */ }
	try {
		const raw = uni.getStorageSync(GOTO_LAST_KEY)
		if (raw) lastGotoTarget.value = JSON.parse(raw)
	} catch (e) { /* ignore */ }
}

function saveLastGoto(x, y) {
	const target = { x, y, ts: Date.now() }
	lastGotoTarget.value = target
	try { uni.setStorageSync(GOTO_LAST_KEY, JSON.stringify(target)) } catch (e) { /* ignore */ }
}

function applyLastGoto() {
	if (!lastGotoTarget.value) return
	positionX.value = String(lastGotoTarget.value.x)
	positionY.value = String(lastGotoTarget.value.y)
}

function applyFavorite(fav) {
	positionX.value = String(fav.x)
	positionY.value = String(fav.y)
}

function saveCurrentAsFavorite() {
	const x = positionX.value?.trim()
	const y = positionY.value?.trim()
	if (!x || !y) return

	const xNum = Number(x)
	const yNum = Number(y)
	if (isNaN(xNum) || isNaN(yNum)) {
		uni.showToast({ title: '请输入有效坐标', icon: 'none' })
		return
	}

	// Check duplicate
	const exists = gotoFavorites.value.some(f => f.x === xNum && f.y === yNum)
	if (exists) {
		uni.showToast({ title: '该点位已收藏', icon: 'none' })
		return
	}

	// Max 8 favorites
	if (gotoFavorites.value.length >= 8) {
		uni.showToast({ title: '最多收藏 8 个点位', icon: 'none' })
		return
	}

	uni.showModal({
		title: '收藏点位',
		content: `保存 (${xNum}, ${yNum}) 为常用点位？`,
		editable: true,
		placeholderText: '可选：输入名称',
		success: (res) => {
			if (!res.confirm) return
			const name = String(res.content || '').trim().slice(0, 10)
			gotoFavorites.value.push({ x: xNum, y: yNum, name: name || '', ts: Date.now() })
			persistFavorites()
			uni.showToast({ title: '已收藏', icon: 'success' })
		}
	})
}

function removeFavorite(idx) {
	uni.showModal({
		title: '删除收藏',
		content: '确定删除该收藏点位？',
		success: (res) => {
			if (!res.confirm) return
			gotoFavorites.value.splice(idx, 1)
			persistFavorites()
		}
	})
}

function persistFavorites() {
	try { uni.setStorageSync(GOTO_STORAGE_KEY, JSON.stringify(gotoFavorites.value)) } catch (e) { /* ignore */ }
}

function showMoreMenu() {
	uni.showActionSheet({
		itemList: ['解绑机器人'],
		success: (res) => {
			if (res.tapIndex === 0) {
				handleUnbind()
			}
		}
	})
}

async function handleUnbind() {
	const currentRobotCode = getCurrentRobotCode()
	if (!currentRobotCode) {
		uni.showToast({ title: '未获取到机器人编号', icon: 'none' })
		return
	}

	const confirmRes = await uni.showModal({
		title: '确认解绑',
		content: `确定要解绑机器人 ${currentRobotCode} 吗？解绑后将无法查看和控制该机器人。`,
		confirmText: '解绑',
		confirmColor: '#e53935'
	})

	if (!confirmRes || !confirmRes.confirm) return

	try {
		await userService.unbindRobot(currentRobotCode)
		uni.showToast({ title: '解绑成功', icon: 'success', duration: 800 })
		uni.$emit('robot:unbound', { robotCode: currentRobotCode })
		setTimeout(() => {
			uni.navigateBack()
		}, 800)
	} catch (e) {
		uni.showToast({
			title: e?.errMsg || e?.message || '解绑失败',
			icon: 'none',
			duration: 2200
		})
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F8F9FA;
}

/* ── Nav Bar ── */
.nav-bar {
	padding-top: var(--status-bar-height);
	background: #ffffff;
	border-bottom: 1rpx solid #eef0f4;
}

.nav-bar-inner {
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 20rpx;
}

.nav-back {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
}

.nav-back:active {
	background: #f3f4f6;
}

.nav-title {
	flex: 1;
	text-align: center;
	font-size: 30rpx;
	font-weight: 600;
	color: #1f2430;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.nav-actions {
	width: 64rpx;
	display: flex;
	justify-content: flex-end;
}

.nav-action-btn {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
}

.nav-action-btn:active {
	background: #f3f4f6;
}

/* ── Scroll ── */
.scroll-content {
	height: calc(100vh - var(--status-bar-height) - 88rpx);
}

.page-content {
	padding: 20rpx 24rpx 40rpx;
}

/* ── Profile Card ── */
.profile-card {
	background: #ffffff;
	border-radius: 24rpx;
	padding: 28rpx;
	box-shadow: 0 4rpx 20rpx rgba(15, 23, 42, 0.04);
}

.profile-label {
	font-size: 22rpx;
	color: #5427e6;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 2rpx;
	margin-bottom: 16rpx;
}

.profile-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 16rpx;
}

.profile-name-row {
	flex: 1;
	min-width: 0;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 12rpx;
}

.profile-name {
	font-size: 40rpx;
	font-weight: 700;
	color: #1f2430;
	line-height: 1.2;
}

.model-chip {
	padding: 6rpx 16rpx;
	border-radius: 8rpx;
	background: #f0eef9;
}

.model-chip-text {
	font-size: 22rpx;
	color: #5427e6;
	font-weight: 500;
}

.status-badge {
	display: flex;
	align-items: center;
	gap: 8rpx;
	padding: 8rpx 18rpx;
	border-radius: 999rpx;
	flex-shrink: 0;
}

.status-badge.is-online {
	background: #ecfdf3;
}

.status-badge.is-offline {
	background: #f3f4f6;
}

.status-dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 50%;
}

.dot-online {
	background: #22c55e;
}

.dot-offline {
	background: #9ca3af;
}

.status-text {
	font-size: 24rpx;
	font-weight: 600;
	color: #374151;
}

.profile-meta {
	margin-top: 18rpx;
	display: flex;
	gap: 24rpx;
	flex-wrap: wrap;
}

.profile-meta-text {
	font-size: 22rpx;
	color: #8c92a4;
}

/* ── Bento Grid ── */
.bento-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 14rpx;
	margin-top: 20rpx;
}

.bento-card {
	background: #ffffff;
	border-radius: 20rpx;
	padding: 22rpx;
	box-shadow: 0 2rpx 12rpx rgba(15, 23, 42, 0.03);
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.bento-icon-wrap {
	width: 48rpx;
	height: 48rpx;
	border-radius: 14rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 4rpx;
}

.bento-icon-battery {
	background: #f0eef9;
}

.battery-icon {
	display: flex;
	align-items: center;
}

.battery-icon-body {
	width: 26rpx;
	height: 16rpx;
	border: 3rpx solid #5427e6;
	border-radius: 4rpx;
	background: #5427e6;
}

.battery-icon-tip {
	width: 5rpx;
	height: 8rpx;
	background: #5427e6;
	border-radius: 0 2rpx 2rpx 0;
	margin-left: -1rpx;
}

.bento-icon-pack {
	background: #fef3ec;
}

.bento-icon-fault {
	background: #fdedf0;
}

.bento-icon-location {
	background: #edf7f0;
}

.bento-label {
	font-size: 22rpx;
	color: #8c92a4;
}

.bento-value {
	font-size: 34rpx;
	font-weight: 700;
	color: #1f2430;
	line-height: 1.2;
}

.bento-value-small {
	font-size: 24rpx;
	font-weight: 600;
	word-break: break-all;
}

.bento-value-warn {
	color: #e25c5c;
}

.bento-bar-track {
	height: 8rpx;
	border-radius: 4rpx;
	background: #eef0f4;
	margin-top: 6rpx;
	overflow: hidden;
}

.bento-bar-fill {
	height: 100%;
	border-radius: 4rpx;
	transition: width 0.4s ease;
}

.bento-bar-primary {
	background: linear-gradient(90deg, #4520c9, #5427e6, #7c6dd8);
}

.bento-bar-orange {
	background: linear-gradient(90deg, #d4733e, #e8845a, #f0a87a);
}

.bento-bar-danger {
	background: linear-gradient(90deg, #c62828, #e53935, #ef5350);
}

/* ── Section Card ── */
.section-card {
	background: #ffffff;
	border-radius: 24rpx;
	padding: 28rpx;
	margin-top: 20rpx;
	box-shadow: 0 4rpx 20rpx rgba(15, 23, 42, 0.04);
}

.section-card-last {
	margin-bottom: 20rpx;
}

.section-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 22rpx;
}

.section-title {
	font-size: 30rpx;
	font-weight: 700;
	color: #1f2430;
}

.section-status {
	font-size: 22rpx;
	color: #8c92a4;
}

.section-sub {
	font-size: 22rpx;
	color: #8c92a4;
}

.section-badge {
	padding: 4rpx 14rpx;
	border-radius: 999rpx;
	background: #fdedf0;
	font-size: 22rpx;
	font-weight: 600;
	color: #e25c5c;
}

/* ── Control Center ── */
button::after {
	border: none;
}

.control-area {
	padding-top: 22rpx;
	border-top: 1rpx solid #f3f4f6;
}

.control-area + .control-area {
	margin-top: 22rpx;
}

.control-sub-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16rpx;
}

.control-sub-label {
	font-size: 26rpx;
	font-weight: 600;
	color: #374151;
	margin-bottom: 16rpx;
}

.control-sub-header .control-sub-label {
	margin-bottom: 0;
}

.control-sub-hint {
	font-size: 22rpx;
	color: #8c92a4;
}

/* ── D-Pad ── */
.dpad-wrap {
	display: flex;
	justify-content: center;
}

.dpad {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 10rpx;
	padding: 16rpx;
	border-radius: 28rpx;
	background: #f8f9fa;
}

.dpad-row {
	display: flex;
	justify-content: center;
	gap: 10rpx;
}

.dpad-row-mid {
	justify-content: center;
}

.dpad-btn {
	width: 88rpx;
	height: 88rpx;
	border-radius: 18rpx;
	background: #ffffff;
	border: 1rpx solid #e5e7eb;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0;
	line-height: 1;
	box-shadow: 0 2rpx 6rpx rgba(15, 23, 42, 0.04);
	transition: background-color 0.15s ease, transform 0.15s ease;
}

.dpad-btn-active {
	background: #EADDFF;
	border-color: #5427e6;
	transform: scale(0.93);
}

.dpad-btn-disabled {
	background: #f3f4f6;
	border-color: #eef0f4;
	opacity: 0.6;
}

.dpad-icon {
	font-size: 28rpx;
	color: #374151;
}

.dpad-stop {
	background: #e53935;
	border-color: #e53935;
}

.dpad-stop:active {
	background: #c62828;
}

.dpad-stop[disabled] {
	background: #f0a8a6;
	border-color: #f0a8a6;
}

.dpad-stop-text {
	font-size: 24rpx;
	font-weight: 600;
	color: #ffffff;
}

/* ── Rotate Buttons ── */
.joystick-row {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 24rpx;
}

.rotate-btn {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	width: 120rpx;
	height: 120rpx;
	border-radius: 50%;
	background: #ffffff;
	border: 2rpx solid #e5e7eb;
	box-shadow: 0 2rpx 8rpx rgba(15, 23, 42, 0.06);
	transition: background-color 0.15s ease, transform 0.15s ease;
}

.rotate-btn-active {
	background: #EADDFF;
	border-color: #5427e6;
	transform: scale(0.92);
}

.rotate-btn-disabled {
	background: #f3f4f6;
	border-color: #eef0f4;
	opacity: 0.5;
}

.rotate-icon {
	font-size: 40rpx;
	color: #374151;
	line-height: 1;
}

.rotate-label {
	font-size: 18rpx;
	color: #8c92a4;
	margin-top: 4rpx;
}

/* ── Joystick ── */
.joystick-wrap {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16rpx;
}

.joystick-readout {
	display: flex;
	gap: 16rpx;
	align-self: stretch;
}

.joystick-readout-item {
	flex: 1;
	padding: 12rpx 18rpx;
	border-radius: 12rpx;
	background: #f8f9fa;
	border: 1rpx solid #eef0f4;
	font-size: 24rpx;
	color: #374151;
	text-align: center;
	font-family: monospace;
}

.joystick-area {
	position: relative;
	width: 280rpx;
	height: 280rpx;
	border-radius: 999rpx;
	background: radial-gradient(circle at center, #ffffff 0%, #f8f9fa 60%, #eef2f7 100%);
	border: 2rpx solid #e5e7eb;
	box-shadow: inset 0 6rpx 16rpx rgba(148, 163, 184, 0.12);
}

.joystick-ring {
	position: absolute;
	inset: 28rpx;
	border-radius: 999rpx;
	border: 2rpx dashed #d8dced;
}

.joystick-cross {
	position: absolute;
	background: rgba(148, 163, 184, 0.25);
}

.joystick-cross-x {
	left: 24rpx;
	right: 24rpx;
	top: 50%;
	height: 2rpx;
	transform: translateY(-50%);
}

.joystick-cross-y {
	top: 24rpx;
	bottom: 24rpx;
	left: 50%;
	width: 2rpx;
	transform: translateX(-50%);
}

.joystick-knob {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 80rpx;
	height: 80rpx;
	border-radius: 999rpx;
	transform: translate(-50%, -50%);
	background: linear-gradient(180deg, #5427e6 0%, #4520c9 100%);
	box-shadow: 0 8rpx 20rpx rgba(84, 39, 230, 0.28);
}

.joystick-tip {
	font-size: 22rpx;
	color: #8c92a4;
}

/* ── Goto Position ── */
.goto-group {
	display: flex;
	flex-direction: column;
	gap: 14rpx;
}

.goto-input-row {
	display: flex;
	gap: 14rpx;
}

.goto-input-item {
	flex: 1;
	display: flex;
	align-items: center;
	gap: 10rpx;
}

.goto-input-label {
	font-size: 26rpx;
	font-weight: 600;
	color: #374151;
	min-width: 40rpx;
}

.goto-input {
	flex: 1;
	height: 76rpx;
	padding: 0 18rpx;
	background: #f8f9fa;
	border: 1rpx solid #e5e7eb;
	border-radius: 14rpx;
	font-size: 28rpx;
	color: #1f2430;
}

.goto-input[disabled] {
	background: #f3f4f6;
	color: #9ca3af;
}

.goto-last-row {
	display: flex;
	align-items: center;
	gap: 10rpx;
	padding: 16rpx 20rpx;
	background: #f0edff;
	border-radius: 14rpx;
	transition: opacity 0.2s ease;
}

.goto-last-row:active {
	opacity: 0.8;
}

.goto-last-label {
	font-size: 24rpx;
	color: #5427e6;
	font-weight: 500;
}

.goto-last-value {
	font-size: 24rpx;
	color: #6b7280;
	font-family: monospace;
}

.goto-last-arrow {
	margin-left: auto;
	font-size: 30rpx;
	color: #5427e6;
}

.goto-fav-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.goto-fav-chip {
	display: flex;
	align-items: center;
	gap: 8rpx;
	padding: 8rpx 18rpx;
	background: #ffffff;
	border: 1rpx solid #e5e7eb;
	border-radius: 999rpx;
	transition: transform 0.15s ease, border-color 0.15s ease;
}

.goto-fav-chip:active {
	transform: scale(0.95);
	border-color: #5427e6;
}

.goto-fav-chip-text {
	font-size: 24rpx;
	color: #374151;
	font-weight: 500;
}

.goto-fav-chip-del {
	font-size: 28rpx;
	color: #9ca3af;
	line-height: 1;
	padding: 0 2rpx;
}

.goto-btn-row {
	display: flex;
	gap: 12rpx;
	align-items: stretch;
}

.goto-btn-main {
	flex: 1;
}

.goto-btn {
	height: 80rpx;
	line-height: 80rpx;
	background: linear-gradient(135deg, #4e3fb0 0%, #3e32a0 100%);
	color: #ffffff;
	border: none;
	border-radius: 16rpx;
	font-size: 28rpx;
	font-weight: 600;
}

.goto-btn:not([disabled]):active {
	opacity: 0.9;
	transform: scale(0.98);
}

.goto-btn[disabled] {
	background: #d8dced;
	color: #8c92a4;
	opacity: 1;
}

.goto-btn-fav {
	width: 80rpx;
	height: 80rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f0edff;
	border-radius: 16rpx;
	flex-shrink: 0;
	transition: transform 0.15s ease, background 0.15s ease;
}

.goto-btn-fav:active {
	transform: scale(0.93);
	background: #EADDFF;
}

.goto-btn-fav-disabled {
	background: #f3f4f6;
}

/* ── Spec List ── */
.spec-list {
	display: flex;
	flex-direction: column;
}

.spec-row {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 20rpx;
	padding: 18rpx 0;
	border-bottom: 1rpx solid #f3f4f6;
}

.spec-row-last {
	border-bottom: none;
}

.spec-label {
	font-size: 26rpx;
	color: #8c92a4;
	min-width: 140rpx;
}

.spec-value {
	font-size: 26rpx;
	color: #1f2430;
	text-align: right;
	flex: 1;
	word-break: break-all;
}

.spec-online {
	color: #22c55e;
	font-weight: 600;
}

.spec-offline {
	color: #9ca3af;
}

/* ── Fault List ── */
.fault-list {
	display: flex;
	flex-direction: column;
	gap: 12rpx;
}

.fault-item {
	padding: 18rpx;
	background: #fffbeb;
	border: 1rpx solid #fde68a;
	border-radius: 16rpx;
}

.fault-item-top {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 16rpx;
	margin-bottom: 8rpx;
}

.fault-code {
	font-size: 24rpx;
	font-weight: 600;
	color: #92400e;
}

.fault-time {
	font-size: 22rpx;
	color: #78716c;
}

.fault-msg {
	font-size: 26rpx;
	color: #1f2937;
	line-height: 1.5;
}

/* ── Map Placeholder ── */
.map-placeholder {
	height: 320rpx;
	border-radius: 18rpx;
	border: 2rpx dashed #d8dced;
	background: #f8f9fa;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 12rpx;
}

.map-placeholder-text {
	font-size: 24rpx;
	color: #8c92a4;
}

/* Detail Skeleton */
.detail-skeleton {
	padding: 0;
}

.detail-sk-card {
	background: #FFFFFF;
	border-radius: 28rpx;
	padding: 32rpx;
	margin-bottom: 20rpx;
}

.detail-sk-line {
	border-radius: 8rpx;
	background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
	background-size: 400% 100%;
	animation: detail-sk-shimmer 1.4s ease infinite;
	margin-bottom: 16rpx;
}

.detail-sk-line-lg {
	width: 60%;
	height: 36rpx;
}

.detail-sk-line-md {
	width: 40%;
	height: 28rpx;
}

.detail-sk-line-sm {
	width: 80%;
	height: 24rpx;
}

.detail-sk-grid {
	display: flex;
	gap: 16rpx;
}

.detail-sk-box {
	flex: 1;
	height: 200rpx;
	border-radius: 24rpx;
	background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
	background-size: 400% 100%;
	animation: detail-sk-shimmer 1.4s ease infinite;
}

@keyframes detail-sk-shimmer {
	0% { background-position: 100% 0; }
	100% { background-position: -100% 0; }
}
</style>
