<template>
	<view class="page">
		<!-- Header -->
		<view class="page-hero">
			<view class="hero-icon-wrap">
				<uni-icons type="locked" size="32" color="#5427e6"></uni-icons>
			</view>
			<text class="hero-title">安全与隐私</text>
			<text class="hero-desc">我们重视您的数据安全和隐私保护</text>
		</view>

		<!-- Account Security -->
		<view class="section">
			<text class="section-label">账号安全</text>
			<view class="card">
				<view class="card-item" hover-class="card-item-hover" @tap="goChangePwd">
					<view class="item-icon-wrap item-icon-purple">
						<uni-icons type="locked" size="20" color="#5427e6"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title">修改密码</text>
						<text class="item-desc">定期更换密码，保障账号安全</text>
					</view>
					<text class="item-arrow">›</text>
				</view>
				<view class="card-item" hover-class="card-item-hover" @tap="goDeactivate">
					<view class="item-icon-wrap item-icon-red">
						<uni-icons type="closeempty" size="20" color="#e53935"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title">注销账号</text>
						<text class="item-desc">永久删除账号及所有关联数据</text>
					</view>
					<text class="item-arrow">›</text>
				</view>
			</view>
		</view>

		<!-- Data & Privacy -->
		<view class="section">
			<text class="section-label">数据与隐私</text>
			<view class="card">
				<view class="card-item">
					<view class="item-icon-wrap item-icon-blue">
						<uni-icons type="cloud-upload" size="20" color="#2563eb"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title">数据存储</text>
						<text class="item-desc">您的数据加密存储在阿里云服务器</text>
					</view>
				</view>
				<view class="card-item">
					<view class="item-icon-wrap item-icon-green">
						<uni-icons type="shield" size="20" color="#16a34a"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title">通信加密</text>
						<text class="item-desc">所有数据传输均使用 HTTPS 加密</text>
					</view>
				</view>
				<view class="card-item">
					<view class="item-icon-wrap item-icon-purple">
						<uni-icons type="person" size="20" color="#5427e6"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title">数据隔离</text>
						<text class="item-desc">您只能查看和操作自己绑定的机器人</text>
					</view>
				</view>
			</view>
		</view>

		<!-- Privacy Policy -->
		<view class="section">
			<text class="section-label">隐私声明</text>
			<view class="card">
				<view class="card-body">
					<text class="policy-title">我们收集的信息</text>
					<text class="policy-text">• 账号信息：用户名、昵称、头像</text>
					<text class="policy-text">• 设备信息：机器人编号、遥测数据</text>
					<text class="policy-text">• 操作记录：控制指令、绑定记录</text>

					<text class="policy-title" style="margin-top: 24rpx;">信息使用目的</text>
					<text class="policy-text">• 提供机器人远程监控与管理服务</text>
					<text class="policy-text">• 故障诊断与运维支持</text>
					<text class="policy-text">• 提升产品体验与服务质量</text>

					<text class="policy-title" style="margin-top: 24rpx;">信息保护承诺</text>
					<text class="policy-text">• 不会向第三方出售您的个人信息</text>
					<text class="policy-text">• 仅在您授权范围内使用数据</text>
					<text class="policy-text">• 您可随时申请导出或删除个人数据</text>
				</view>
			</view>
		</view>

		<view class="footer">
			<text class="footer-text">如有疑问请联系 810170966qq@gmail.com</text>
		</view>
	</view>
</template>

<script setup>
function goChangePwd() {
	uni.navigateTo({
		url: '/uni_modules/uni-id-pages/pages/userinfo/change_pwd/change_pwd'
	})
}

function goDeactivate() {
	uni.navigateTo({
		url: '/uni_modules/uni-id-pages/pages/userinfo/deactivate/deactivate'
	})
}
</script>

<style scoped>
.page {
	min-height: 100vh;
	background: #F8F9FA;
	padding: 0 32rpx 48rpx;
	box-sizing: border-box;
}

.page-hero {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 40rpx 0 32rpx;
}

.hero-icon-wrap {
	width: 96rpx;
	height: 96rpx;
	border-radius: 28rpx;
	background: #EADDFF;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 20rpx;
}

.hero-title {
	font-size: 36rpx;
	font-weight: 700;
	color: #191C1D;
}

.hero-desc {
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

.item-icon-red {
	background: #FFDAD6;
}

.item-icon-blue {
	background: #DBEAFE;
}

.item-icon-green {
	background: #DCFCE7;
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

.policy-title {
	font-size: 26rpx;
	font-weight: 600;
	color: #191C1D;
	display: block;
	margin-bottom: 12rpx;
}

.policy-text {
	font-size: 24rpx;
	color: #6b7280;
	line-height: 1.8;
	display: block;
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
