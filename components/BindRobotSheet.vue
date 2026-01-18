<template>
	<view v-if="visible" class="sheet-layer">
		<view class="sheet-mask" @tap="closeSheet"></view>
		<view class="sheet-panel" @tap.stop>
			<view class="sheet-handle"></view>
			<view class="sheet-header">
				<text class="sheet-title">绑定机器人</text>
				<view class="sheet-header-icon" @tap="closeSheet">
					<uni-icons type="staff" size="24" color="#5427e6"></uni-icons>
				</view>
			</view>

			<view class="sheet-option" hover-class="sheet-option-hover" @tap="handleManualBindTap">
				<view class="sheet-option-icon-wrap sheet-option-icon-manual">
					<uni-icons type="compose" size="24" color="#5427e6"></uni-icons>
				</view>
				<view class="sheet-option-content">
					<text class="sheet-option-title">手动输入设备编号</text>
					<text class="sheet-option-desc">输入产品序列号或激活码进行手动绑定</text>
				</view>
				<text class="sheet-option-arrow">›</text>
			</view>

			<view class="sheet-option" hover-class="sheet-option-hover" @tap="handleScanBindTap">
				<view class="sheet-option-icon-wrap sheet-option-icon-scan">
					<uni-icons type="scan" size="24" color="#5427e6"></uni-icons>
				</view>
				<view class="sheet-option-content">
					<text class="sheet-option-title">扫码绑定机器人</text>
					<text class="sheet-option-desc">扫描机身或包装上的二维码快速同步</text>
				</view>
				<text class="sheet-option-arrow">›</text>
			</view>

			<view class="sheet-cancel" hover-class="sheet-cancel-hover" @tap="closeSheet">
				<text class="sheet-cancel-text">取消</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { defineEmits, defineProps } from 'vue'
import { parseRobotBindPayload } from '@/utils/robotBind.js'
import { isLoggedIn } from '@/utils/auth.js'

defineProps({
	visible: {
		type: Boolean,
		default: false
	}
})

const emit = defineEmits(['close', 'success'])

const userService = uniCloud.importObject('userService', {
	customUI: true,
	errorOptions: { type: 'none' }
})

function closeSheet() {
	emit('close')
}

function handleManualBindTap() {
	closeSheet()
	openManualBindDialog()
}

async function handleScanBindTap() {
	closeSheet()
	if (!isLoggedIn()) {
		uni.navigateTo({ url: '/pages/login/index' })
		return
	}

	try {
		const scanResult = await scanRobotCode()
		if (!scanResult) return

		const parsed = parseRobotBindPayload(scanResult)
		if (!parsed.ok) {
			uni.showToast({ title: '无效的机器人二维码', icon: 'none' })
			return
		}

		await bindRobotByCode(parsed.robotCode, 'qrcode', '扫码绑定成功')
	} catch (e) {
		const errMsg = String(e?.errMsg || e?.message || '')
		if (isScanCanceled(errMsg)) return
		if (isScanDecodeFailed(errMsg)) {
			console.error('[bind-sheet] scan decode failed:', e)
			uni.showToast({ title: '二维码识别失败，请重试', icon: 'none' })
			return
		}
		console.error('[bind-sheet] scan bind failed:', e)
		uni.showToast({ title: '扫码失败，请重试', icon: 'none' })
	}
}

async function openManualBindDialog() {
	if (!isLoggedIn()) {
		uni.navigateTo({ url: '/pages/login/index' })
		return
	}

	uni.showModal({
		title: '手动输入设备编号',
		content: '请输入 robotCode',
		editable: true,
		placeholderText: '例如 12315',
		success: async (res) => {
			if (!res.confirm) return
			const robotCode = String(res.content || '').trim()
			if (!robotCode) {
				uni.showToast({ title: '请输入有效的 robotCode', icon: 'none' })
				return
			}
			try {
				await bindRobotByCode(robotCode, 'manual', '绑定成功')
			} catch (e) {
				uni.showToast({ title: e?.errMsg || e?.message || '绑定失败', icon: 'none' })
			}
		}
	})
}

async function bindRobotByCode(robotCode, bindSource = 'manual', successTitle = '绑定成功') {
	const result = await userService.bindRobotForTest(String(robotCode || '').trim())

	const payload = {
		robotCode: result.robotCode || String(robotCode || '').trim(),
		bindSource,
		ts: Date.now()
	}
	uni.$emit('robot:bound', payload)
	emit('success', payload)
	uni.showToast({ title: successTitle, icon: 'success' })
	return result
}

async function scanRobotCode() {
	return new Promise((resolve, reject) => {
		uni.scanCode({
			onlyFromCamera: true,
			scanType: ['qrCode'],
			success: (res) => {
				resolve(String(res?.result || '').trim())
			},
			fail: reject
		})
	})
}

function isScanCanceled(errMsg) {
	return String(errMsg || '').includes('cancel')
}

function isScanDecodeFailed(errMsg) {
	const text = String(errMsg || '').toLowerCase()
	return text.includes('failed to decode qr code') || text.includes('decode qr code')
}
</script>

<style scoped>
.sheet-layer {
	position: fixed;
	inset: 0;
	z-index: 99;
}

.sheet-mask {
	position: absolute;
	inset: 0;
	background: rgba(25, 28, 29, 0.55);
	animation: fade-in 0.2s ease;
}

.sheet-panel {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 12rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
	border-radius: 32rpx 32rpx 0 0;
	background: #F8F9FA;
	animation: slide-up 0.25s ease;
}

.sheet-handle {
	width: 64rpx;
	height: 8rpx;
	margin: 8rpx auto 24rpx;
	border-radius: 999rpx;
	background: rgba(107, 114, 128, 0.2);
}

.sheet-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 4rpx 24rpx;
}

.sheet-title {
	font-size: 36rpx;
	font-weight: 800;
	color: #191C1D;
	letter-spacing: 0.5rpx;
}

.sheet-header-icon {
	width: 64rpx;
	height: 64rpx;
	border-radius: 18rpx;
	background: #EADDFF;
	display: flex;
	align-items: center;
	justify-content: center;
}

.sheet-header-icon-text {
	font-size: 30rpx;
}

.sheet-option {
	display: flex;
	align-items: center;
	gap: 20rpx;
	padding: 28rpx 24rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	margin-bottom: 16rpx;
	transition: transform 0.2s ease, opacity 0.2s ease;
}

.sheet-option-hover {
	transform: scale(0.98);
	opacity: 0.92;
}

.sheet-option-icon-wrap {
	width: 72rpx;
	height: 72rpx;
	border-radius: 20rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.sheet-option-icon-manual {
	background: #EADDFF;
}

.sheet-option-icon-scan {
	background: #EADDFF;
}

.sheet-option-icon {
	font-size: 32rpx;
	color: #5427e6;
}

.sheet-option-content {
	flex: 1;
	min-width: 0;
}

.sheet-option-title {
	display: block;
	font-size: 28rpx;
	font-weight: 600;
	color: #191C1D;
}

.sheet-option-desc {
	display: block;
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #6b7280;
}

.sheet-option-arrow {
	font-size: 36rpx;
	color: #9ca3af;
	flex-shrink: 0;
}

.sheet-cancel {
	margin-top: 8rpx;
	padding: 26rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	text-align: center;
	transition: transform 0.2s ease, opacity 0.2s ease;
}

.sheet-cancel-hover {
	transform: scale(0.98);
	opacity: 0.9;
}

.sheet-cancel-text {
	font-size: 28rpx;
	font-weight: 500;
	color: #6b7280;
}

@keyframes fade-in {
	from { opacity: 0; }
	to { opacity: 1; }
}

@keyframes slide-up {
	from { transform: translateY(100%); }
	to { transform: translateY(0); }
}
</style>
