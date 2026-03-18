<template>
	<view class="page">
		<view class="card">
			<view class="section-title">资料信息</view>

			<view
				class="item clickable pressable-row"
				:class="{ 'item-disabled': avatarUploading }"
				:hover-class="avatarUploading ? '' : 'pressable-row-hover'"
				hover-start-time="20"
				hover-stay-time="80"
				@tap="handleAvatarClick"
			>
				<text class="label">头像</text>
				<view class="right">
					<image class="avatar-thumb" :src="displayAvatar" mode="aspectFill"></image>
					<text class="arrow">›</text>
				</view>
			</view>

			<view
				class="item clickable pressable-row"
				hover-class="pressable-row-hover"
				hover-start-time="20"
				hover-stay-time="80"
				@tap="copyProfileField(profile?.uid, 'uid')"
			>
				<text class="label">uid</text>
				<text class="value">{{ profile?.uid || '-' }}</text>
			</view>

			<view
				class="item clickable pressable-row"
				hover-class="pressable-row-hover"
				hover-start-time="20"
				hover-stay-time="80"
				@tap="copyProfileField(profile?.username, '用户名')"
			>
				<text class="label">用户名</text>
				<text class="value">{{ profile?.username || '-' }}</text>
			</view>

			<view
				class="item clickable pressable-row"
				hover-class="pressable-row-hover"
				hover-start-time="20"
				hover-stay-time="80"
				@tap="goEditNickname"
			>
				<text class="label">昵称</text>
				<view class="right">
					<text class="value">{{ displayNickname }}</text>
					<text class="arrow">›</text>
				</view>
			</view>
		</view>

		<view v-if="loadFailed" class="tip">
			<text class="tip-text">资料加载失败，请稍后重试</text>
		</view>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { isLoggedIn } from '@/utils/auth.js'
import {
	profileState,
	patchProfile,
	fetchProfile,
	ensureProfileLoaded,
	clearProfileState
} from '@/utils/profile-store.js'

const DEFAULT_AVATAR = '/static/default-avatar.png'

const userService = uniCloud.importObject('userService', {
	customUI: true,
	errorOptions: { type: 'none' }
})

const profile = computed(() => profileState.profile)
const loading = computed(() => profileState.loading)
const loadFailed = ref(false)
const avatarPreview = ref('')
const avatarUploading = ref(false)

const displayUsername = computed(() => profile.value?.username || '-')
const displayNickname = computed(() => {
	const nickname = String(profile.value?.nickname || '').trim()
	if (nickname) return nickname
	const username = String(profile.value?.username || '').trim()
	return username || '未登录'
})
const displayAvatar = computed(() => {
	const preview = String(avatarPreview.value || '').trim()
	if (preview) return preview
	const avatar = String(profile.value?.avatar || '').trim()
	return avatar || DEFAULT_AVATAR
})

onLoad(() => {
	loadMyProfile().catch((e) => {
		console.error('[profile] loadMyProfile failed:', e)
	})
})

async function loadMyProfile(options = {}) {
	const { silent = false, force = false } = options
	loadFailed.value = false

	if (!isLoggedIn()) {
		clearProfileState()
		if (!silent) {
			uni.showToast({ title: '请先登录', icon: 'none' })
			uni.navigateTo({ url: '/pages/login/index' })
		}
		return
	}

	try {
		if (force) {
			await fetchProfile({ force: true })
		} else {
			await ensureProfileLoaded()
		}
	} catch (e) {
		console.error('[profile] getMyProfile failed:', e)
		loadFailed.value = true
		// 保留旧数据显示，避免空白/闪烁；首次失败则保持占位
		if (!profile.value) {
			clearProfileState()
		}
		uni.showToast({ title: '资料加载失败', icon: 'none' })
	}
}

function goEditNickname() {
	if (!isLoggedIn()) {
		uni.showToast({ title: '请先登录', icon: 'none' })
		uni.navigateTo({ url: '/pages/login/index' })
		return
	}
	const nickname = encodeURIComponent(String(profile.value?.nickname || '').trim())
	uni.navigateTo({ url: `/pages/profile/edit-nickname?nickname=${nickname}` })
}

function copyProfileField(value, label) {
	const text = String(value || '').trim()
	if (!text) {
		uni.showToast({ title: `暂无可复制的${label}`, icon: 'none' })
		return
	}

	uni.setClipboardData({
		data: text,
		success: () => {
			uni.showToast({ title: '已复制', icon: 'success' })
		}
	})
}

async function handleAvatarClick() {
	if (avatarUploading.value) return
	if (!isLoggedIn()) {
		uni.showToast({ title: '请先登录', icon: 'none' })
		uni.navigateTo({ url: '/pages/login/index' })
		return
	}

	const uid = String(profile.value?.uid || '').trim()
	if (!uid) {
		uni.showToast({ title: '资料加载中，请稍后', icon: 'none' })
		return
	}

	const sourceType = await chooseAvatarSourceType()
	if (!sourceType) return

	try {
		const tempFilePath = await chooseAvatarImage(sourceType)
		if (!tempFilePath) return

		// 文件大小校验 (最大 5MB)
		try {
			const fileInfo = await new Promise((resolve, reject) => {
				uni.getFileSystemManager().getFileInfo({ filePath: tempFilePath, success: resolve, fail: reject })
			})
			if (fileInfo.size > 5 * 1024 * 1024) {
				uni.showToast({ title: '图片不能超过 5MB', icon: 'none' })
				return
			}
		} catch (e) { /* 获取文件信息失败时继续尝试上传 */ }

		const previousAvatar = String(profile.value?.avatar || '').trim()
		avatarPreview.value = tempFilePath
		avatarUploading.value = true
			uni.showLoading({ title: '头像上传中...', mask: true })

		try {
			const uploadFilePath = await compressImageIfNeeded(tempFilePath)
			const avatar = await uploadAvatarToCloud(uid, uploadFilePath)
			await userService.updateMyProfile({ avatar })
			patchProfile({ avatar })
			avatarPreview.value = ''
			uni.showToast({ title: '头像更新成功', icon: 'success' })
		} catch (e) {
			console.error('[profile] update avatar failed:', e)
			avatarPreview.value = ''
			if (profile.value) profile.value.avatar = previousAvatar
			uni.showToast({
				title: e?.errMsg || e?.message || '头像更新失败',
				icon: 'none'
			})
		} finally {
			avatarUploading.value = false
			uni.hideLoading()
		}
	} catch (err) {
		const errMsg = String(err?.errMsg || err?.message || '')
		if (isChooseCanceled(errMsg)) return
		console.error('[profile] chooseImage failed:', err)
		uni.showToast({ title: '选择图片失败，请重试', icon: 'none' })
	}
}

async function uploadAvatarToCloud(uid, filePath) {
	const ext = getFileExt(filePath)
	const cloudPath = `user-avatar/${uid}/${Date.now()}.${ext}`
	const uploadRes = await uniCloud.uploadFile({
		filePath,
		cloudPath,
		fileType: 'image'
	})
	const avatar = String(
		uploadRes?.fileID || uploadRes?.tempFileURL || uploadRes?.download_url || ''
	).trim()
	if (!avatar) throw new Error('头像上传失败')
	return avatar
}

async function chooseAvatarSourceType() {
	return new Promise((resolve) => {
		uni.showActionSheet({
			itemList: ['拍照', '从相册选择'],
			success: (res) => {
				resolve(res.tapIndex === 0 ? ['camera'] : ['album'])
			},
			fail: (err) => {
				const errMsg = String(err?.errMsg || '')
				if (isChooseCanceled(errMsg)) {
					resolve(null)
					return
				}
				console.error('[profile] showActionSheet failed:', err)
				uni.showToast({ title: '无法打开选择菜单', icon: 'none' })
				resolve(null)
			}
		})
	})
}

async function chooseAvatarImage(sourceType) {
	return new Promise((resolve, reject) => {
		uni.chooseImage({
			count: 1,
			sizeType: ['original', 'compressed'],
			sourceType,
			success: (res) => {
				const tempFilePath = String(res?.tempFilePaths?.[0] || '').trim()
				resolve(tempFilePath)
			},
			fail: (err) => {
				reject(err)
			}
		})
	})
}

async function compressImageIfNeeded(filePath) {
	try {
		const res = await new Promise((resolve, reject) => {
			uni.compressImage({
				src: filePath,
				quality: 80,
				success: resolve,
				fail: reject
			})
		})
		return String(res?.tempFilePath || filePath).trim() || filePath
	} catch (e) {
		console.log('[profile] compressImage skipped:', e)
		return filePath
	}
}

function getFileExt(filePath) {
	const cleanPath = String(filePath || '').split('?')[0]
	const matched = cleanPath.match(/\.([a-zA-Z0-9]+)$/)
	return matched?.[1]?.toLowerCase() || 'jpg'
}

function isChooseCanceled(errMsg) {
	return errMsg.includes('cancel')
}
</script>

<style scoped>
@import '@/styles/pressable.css';
.page {
	padding: 24rpx;
	background: #f6f7fb;
	min-height: 100vh;
	box-sizing: border-box;
}

.card {
	margin-top: 18rpx;
	padding: 8rpx 0;
	border-radius: 20rpx;
	background: #ffffff;
	box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
	overflow: hidden;
}

.section-title {
	padding: 20rpx 24rpx 10rpx;
	font-size: 26rpx;
	font-weight: 600;
	color: #111827;
}

.item {
	padding: 22rpx 24rpx;
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	border-top: 1rpx solid rgba(0, 0, 0, 0.06);
}

.label {
	font-size: 30rpx;
	color: #111827;
}

.value {
	margin-left: 18rpx;
	font-size: 24rpx;
	color: #6b7280;
	text-align: right;
	max-width: 420rpx;
}

.clickable {
	cursor: pointer;
}

.item-disabled {
	opacity: 0.88;
}

.right {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	flex: 1;
	margin-left: 18rpx;
}

.arrow {
	margin-left: 10rpx;
	font-size: 34rpx;
	line-height: 1;
	color: #c7c7cc; /* iOS 右箭头灰 */
}

.avatar-thumb {
	width: 72rpx;
	height: 72rpx;
	border-radius: 36rpx;
	background: #f0f0f0;
}

.tip {
	margin-top: 18rpx;
	padding: 18rpx 24rpx;
	border-radius: 16rpx;
	background: rgba(239, 68, 68, 0.08);
}

.tip-text {
	font-size: 24rpx;
	color: #b91c1c;
}
</style>

