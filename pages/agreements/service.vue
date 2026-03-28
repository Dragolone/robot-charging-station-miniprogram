<template>
	<view class="page">
		<view class="page-hero">
			<view class="hero-icon-wrap">
				<uni-icons type="auth" size="32" color="#5427e6"></uni-icons>
			</view>
			<text class="hero-title">用户服务协议</text>
			<text class="hero-desc">更新日期：2026年4月1日</text>
		</view>

		<view class="section">
			<view class="card">
				<view class="card-body">
					<text class="policy-title">一、服务概述</text>
					<text class="policy-text">欢迎使用机器人充电站管理平台（以下简称"本平台"）。本平台由零一唯创（Zeroone Weichuang）开发并运营，为用户提供机器人远程监控、状态查看、故障管理及指令下发等服务。</text>
					<text class="policy-text">请您在使用本平台前仔细阅读并充分理解本协议的各项条款。您注册、登录或使用本平台即视为您已阅读并同意本协议。</text>

					<text class="policy-title">二、账号注册与管理</text>
					<text class="policy-text">1. 您应提供真实、准确的注册信息，并及时更新。</text>
					<text class="policy-text">2. 您应妥善保管账号和密码，因账号密码泄露造成的损失由您自行承担。</text>
					<text class="policy-text">3. 每个账号仅限本人使用，不得转让、借用或共享。</text>
					<text class="policy-text">4. 您可随时申请注销账号，注销后相关数据将按隐私政策处理。</text>

					<text class="policy-title">三、服务内容</text>
					<text class="policy-text">本平台提供以下服务：</text>
					<text class="policy-text">1. 机器人设备绑定与管理</text>
					<text class="policy-text">2. 机器人实时状态监控与遥测数据查看</text>
					<text class="policy-text">3. 远程控制指令下发（移动、停止、导航等）</text>
					<text class="policy-text">4. 故障记录查看与告警通知</text>
					<text class="policy-text">5. 用户个人资料管理</text>

					<text class="policy-title">四、用户行为规范</text>
					<text class="policy-text">1. 您不得利用本平台从事违法违规活动。</text>
					<text class="policy-text">2. 您不得干扰或破坏本平台的正常运行。</text>
					<text class="policy-text">3. 您不得未经授权访问或操作他人绑定的机器人设备。</text>
					<text class="policy-text">4. 您应确保下发的控制指令安全合理，因不当操作导致的设备损坏由您自行承担。</text>

					<text class="policy-title">五、知识产权</text>
					<text class="policy-text">本平台的所有内容（包括但不限于界面设计、程序代码、图标、文字等）均受知识产权法保护，归零一唯创所有。未经许可，不得复制、修改、传播或用于商业用途。</text>

					<text class="policy-title">六、免责声明</text>
					<text class="policy-text">1. 因网络状况、设备故障等不可控因素导致的服务中断或数据延迟，本平台不承担责任。</text>
					<text class="policy-text">2. 本平台不对机器人设备本身的硬件故障承担责任。</text>
					<text class="policy-text">3. 因用户自身操作不当造成的损失，本平台不承担责任。</text>

					<text class="policy-title">七、协议修改</text>
					<text class="policy-text">本平台有权根据需要修改本协议内容，修改后的协议将在平台内公布。若您继续使用本平台，即视为您同意修改后的协议。</text>

					<text class="policy-title">八、联系我们</text>
					<text class="policy-text">如您对本协议有任何疑问，请联系：810170966qq@gmail.com</text>
				</view>
			</view>
		</view>

		<view class="footer">
			<text class="footer-text">© 2024-2026 零一唯创 All Rights Reserved</text>
		</view>
	</view>
</template>

<script setup>
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

.card {
	border-radius: 24rpx;
	background: #FFFFFF;
	overflow: hidden;
}

.card-body {
	padding: 28rpx;
}

.policy-title {
	font-size: 28rpx;
	font-weight: 600;
	color: #191C1D;
	display: block;
	margin-top: 32rpx;
	margin-bottom: 12rpx;
}

.policy-title:first-child {
	margin-top: 0;
}

.policy-text {
	font-size: 26rpx;
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
