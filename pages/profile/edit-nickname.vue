<template>
	<view class="page">
		<view class="card">
			<text class="card-label">昵称</text>
			<view class="input-wrap">
				<input
					class="input"
					:value="nicknameDraft"
					:focus="true"
					maxlength="20"
					confirm-type="done"
					placeholder="请输入昵称（1~20）"
					placeholder-class="input-placeholder"
					@input="onNicknameInput"
					@confirm="save"
				/>
			</view>
			<view class="helper">
				<text class="helper-text">{{ helperText }}</text>
			</view>
		</view>

		<button
			class="save-btn"
			:class="{ 'save-btn-disabled': !canSave }"
			:disabled="saving"
			@tap="save"
		>
			{{ saving ? '保存中…' : '保存' }}
		</button>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { isLoggedIn } from '@/utils/auth.js'
import { profileState, fetchProfile, patchProfile, clearProfileState } from '@/utils/profile-store.js'

const userService = uniCloud.importObject('userService', {
	customUI: true,
	errorOptions: { type: 'none' }
})

const nicknameDraft = ref('')
const saving = ref(false)

const helperText = computed(() => {
	const len = String(nicknameDraft.value || '').trim().length
	return `${len}/20`
})

const canSave = computed(() => {
	const val = String(nicknameDraft.value || '').trim()
	return val.length >= 1 && val.length <= 20
})

onLoad(async (options) => {
	if (!isLoggedIn()) {
		clearProfileState()
		uni.showToast({ title: '请先登录', icon: 'none' })
		uni.navigateTo({ url: '/pages/login/index' })
		return
	}

	const fromParam = options?.nickname ? decodeURIComponent(String(options.nickname)) : ''
	if (fromParam) {
		nicknameDraft.value = String(fromParam).trim()
		return
	}

	try {
		if (profileState.profile) {
			nicknameDraft.value = String(profileState.profile?.nickname || '').trim()
			return
		}
		const data = await fetchProfile()
		nicknameDraft.value = String(data?.nickname || '').trim()
	} catch (e) {
		console.error('[edit-nickname] getMyProfile failed:', e)
		uni.showToast({ title: '获取昵称失败', icon: 'none' })
	}
})

function onNicknameInput(e) {
	nicknameDraft.value = String(e?.detail?.value ?? '')
}

async function save() {
	if (saving.value) return
	if (!isLoggedIn()) {
		uni.showToast({ title: '请先登录', icon: 'none' })
		uni.navigateTo({ url: '/pages/login/index' })
		return
	}

	const nickname = String(nicknameDraft.value || '').trim()
	if (!nickname) {
		uni.showToast({ title: '昵称不能为空', icon: 'none' })
		return
	}
	if (nickname.length < 1 || nickname.length > 20) {
		uni.showToast({ title: '昵称长度需为 1~20', icon: 'none' })
		return
	}

	saving.value = true
	try {
		await userService.updateMyProfile({ nickname })
		patchProfile({ nickname })
		uni.showToast({ title: '保存成功', icon: 'success' })
		setTimeout(() => {
			uni.navigateBack()
		}, 350)
	} catch (e) {
		console.error('[edit-nickname] updateMyProfile failed:', e)
		uni.showToast({ title: e?.errMsg || e?.message || '保存失败', icon: 'none' })
	} finally {
		saving.value = false
	}
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F8F9FA;
	padding: 20rpx 32rpx 48rpx;
	box-sizing: border-box;
}

.card {
	border-radius: 24rpx;
	background: #FFFFFF;
	padding: 28rpx;
}

.card-label {
	font-size: 22rpx;
	font-weight: 600;
	color: #6b7280;
	letter-spacing: 2rpx;
	display: block;
	margin-bottom: 16rpx;
}

.input-wrap {
	border-radius: 16rpx;
	background: #F3F4F6;
	padding: 0 20rpx;
}

.input {
	height: 88rpx;
	font-size: 28rpx;
	color: #191C1D;
}

.input-placeholder {
	color: #9ca3af;
}

.helper {
	margin-top: 12rpx;
	display: flex;
	justify-content: flex-end;
}

.helper-text {
	font-size: 22rpx;
	color: #9ca3af;
}

.save-btn {
	margin-top: 32rpx;
	width: 100%;
	height: 88rpx;
	line-height: 88rpx;
	border-radius: 24rpx;
	background: linear-gradient(135deg, #5427e6 0%, #4520c9 100%);
	color: #FFFFFF;
	font-size: 30rpx;
	font-weight: 600;
	text-align: center;
	border: none;
	transition: opacity 0.2s ease;
}

.save-btn::after {
	border: none;
}

.save-btn:active {
	opacity: 0.85;
}

.save-btn-disabled {
	opacity: 0.45;
}

.save-btn[disabled] {
	opacity: 0.45;
}
</style>
