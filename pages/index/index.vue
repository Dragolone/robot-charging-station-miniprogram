<template>
	<view class="splash-bg"></view>
</template>

<script>
export default {
  onReady() {
		const TOKEN_KEY = 'uni_id_token'
		const EXPIRED_KEY = 'uni_id_token_expired'

		const token = String(uni.getStorageSync(TOKEN_KEY) || '').trim()
		const expired = Number(uni.getStorageSync(EXPIRED_KEY) || 0)
		const isLoggedIn = !!token && !!expired && expired > Date.now()

		console.log('[splash] onReady, isLoggedIn:', isLoggedIn, 'now:', Date.now())

		if (isLoggedIn) {
			uni.switchTab({
				url: '/pages/robots/index',
				fail: (err) => { console.error('[splash] switchTab fail:', err) }
			})
		} else {
			uni.reLaunch({
				url: '/pages/login/index',
				fail: (err) => { console.error('[splash] reLaunch fail:', err) }
			})
		}
  }
}
</script>

<style>
	.splash-bg {
		position: fixed;
		inset: 0;
		background: #F8F9FA;
	}
</style>
