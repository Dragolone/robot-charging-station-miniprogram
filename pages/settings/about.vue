<template>
	<view class="page">
		<!-- Logo & Brand -->
		<view class="brand-hero">
			<view class="brand-logo-wrap">
				<image class="brand-logo" src="/static/logo.png" mode="aspectFit"></image>
			</view>
			<text class="brand-name">机器人充电站</text>
			<text class="brand-version">V2.4.0</text>
		</view>

		<!-- Company Intro -->
		<view class="section">
			<text class="section-label">关于零一唯创</text>
			<view class="card">
				<view class="card-body">
					<text class="intro-text">零一唯创（Zeroone Weichuang）是一家专注于智能机器人与物联网技术的创新型科技企业。我们致力于为机器人提供高效、智能的充电管理解决方案，通过自主研发的远程监控平台，帮助用户实时掌握设备运行状态，提升运维效率。</text>
					<text class="intro-text" style="margin-top: 20rpx;">我们的愿景是让每一台机器人都能获得可靠的能源保障，推动智能制造与自动化产业的发展。</text>
				</view>
			</view>
		</view>

		<!-- Product Info -->
		<view class="section">
			<text class="section-label">产品信息</text>
			<view class="card">
				<view class="info-row">
					<text class="info-label">产品名称</text>
					<text class="info-value">机器人充电站管理平台</text>
				</view>
				<view class="info-row">
					<text class="info-label">当前版本</text>
					<text class="info-value">V2.4.0</text>
				</view>
				<view class="info-row">
					<text class="info-label">开发团队</text>
					<text class="info-value">零一唯创技术团队</text>
				</view>
				<view class="info-row">
					<text class="info-label">技术支持</text>
					<text class="info-value">810170966qq@gmail.com</text>
				</view>
			</view>
		</view>

		<!-- Legal -->
		<view class="section">
			<text class="section-label">法律信息</text>
			<view class="card">
				<view class="card-item" hover-class="card-item-hover" @tap="goPrivacy">
					<text class="card-item-title">隐私政策</text>
					<text class="card-item-arrow">›</text>
				</view>
				<view class="card-item" hover-class="card-item-hover" @tap="showUserAgreement">
					<text class="card-item-title">用户协议</text>
					<text class="card-item-arrow">›</text>
				</view>
			</view>
		</view>

		<view class="footer">
			<text class="footer-text">© 2024-2026 零一唯创 All Rights Reserved</text>
		</view>
	</view>
</template>

<script setup>
function goPrivacy() {
	uni.navigateTo({ url: '/pages/settings/privacy' })
}

function showUserAgreement() {
	uni.navigateTo({ url: '/pages/agreements/service' })
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F8F9FA;
	padding: 0 32rpx 48rpx;
	box-sizing: border-box;
}

.brand-hero {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 48rpx 0 40rpx;
}

.brand-logo-wrap {
	width: 120rpx;
	height: 120rpx;
	border-radius: 28rpx;
	background: #FFFFFF;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 20rpx;
}

.brand-logo {
	width: 88rpx;
	height: 88rpx;
}

.brand-name {
	font-size: 36rpx;
	font-weight: 700;
	color: #191C1D;
	letter-spacing: 1rpx;
}

.brand-version {
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #6b7280;
}

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

.card {
	border-radius: 24rpx;
	background: #FFFFFF;
	overflow: hidden;
}

.card-body {
	padding: 28rpx;
}

.intro-text {
	font-size: 26rpx;
	color: #191C1D;
	line-height: 1.8;
}

.info-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 24rpx 28rpx;
}

.info-label {
	font-size: 26rpx;
	color: #6b7280;
}

.info-value {
	font-size: 26rpx;
	color: #191C1D;
	font-weight: 500;
}

.card-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 26rpx 28rpx;
	transition: background-color 0.2s ease;
}

.card-item-hover {
	background: #F8F9FA;
}

.card-item-title {
	font-size: 28rpx;
	font-weight: 500;
	color: #191C1D;
}

.card-item-arrow {
	font-size: 34rpx;
	color: #d1d5db;
	line-height: 1;
}

.footer {
	padding: 48rpx 0 32rpx;
	text-align: center;
}

.footer-text {
	font-size: 22rpx;
	color: #9ca3af;
}
</style>
