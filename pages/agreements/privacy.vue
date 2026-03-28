<template>
	<view class="page">
		<view class="page-hero">
			<view class="hero-icon-wrap">
				<uni-icons type="locked" size="32" color="#5427e6"></uni-icons>
			</view>
			<text class="hero-title">隐私政策条款</text>
			<text class="hero-desc">更新日期：2026年4月1日</text>
		</view>

		<view class="section">
			<view class="card">
				<view class="card-body">
					<text class="policy-title">一、引言</text>
					<text class="policy-text">零一唯创（以下简称"我们"）深知个人信息对您的重要性，我们将按照法律法规要求，采取相应安全保护措施，尽力保护您的个人信息安全可控。本隐私政策适用于机器人充电站管理平台（以下简称"本平台"）提供的所有服务。</text>

					<text class="policy-title">二、我们收集的信息</text>
					<text class="policy-text">为向您提供服务，我们可能收集以下信息：</text>
					<text class="policy-text">1. 账号信息：用户名、昵称、头像</text>
					<text class="policy-text">2. 设备信息：您绑定的机器人编号及相关遥测数据（电量、位置、运行状态等）</text>
					<text class="policy-text">3. 操作记录：控制指令记录、设备绑定/解绑记录</text>
					<text class="policy-text">4. 日志信息：访问时间、操作日志等必要的服务运行数据</text>

					<text class="policy-title">三、信息使用目的</text>
					<text class="policy-text">我们收集的信息仅用于以下目的：</text>
					<text class="policy-text">1. 提供机器人远程监控与管理服务</text>
					<text class="policy-text">2. 验证用户身份，保障账号安全</text>
					<text class="policy-text">3. 故障诊断与运维技术支持</text>
					<text class="policy-text">4. 改善和优化产品体验与服务质量</text>
					<text class="policy-text">5. 履行法律法规规定的义务</text>

					<text class="policy-title">四、信息存储与保护</text>
					<text class="policy-text">1. 您的数据加密存储在阿里云服务器，采用业界标准的安全防护措施。</text>
					<text class="policy-text">2. 所有数据传输均使用 HTTPS 加密协议。</text>
					<text class="policy-text">3. 我们实行严格的数据隔离机制，您只能访问自己绑定的机器人数据。</text>
					<text class="policy-text">4. 我们会定期审查安全措施，持续提升数据保护能力。</text>

					<text class="policy-title">五、信息共享与披露</text>
					<text class="policy-text">我们承诺：</text>
					<text class="policy-text">1. 不会向第三方出售您的个人信息。</text>
					<text class="policy-text">2. 不会在未经您同意的情况下与第三方共享您的个人信息，法律法规要求除外。</text>
					<text class="policy-text">3. 仅在您授权范围内使用数据。</text>

					<text class="policy-title">六、您的权利</text>
					<text class="policy-text">您对个人信息享有以下权利：</text>
					<text class="policy-text">1. 查看和修改个人资料（昵称、头像等）。</text>
					<text class="policy-text">2. 随时解绑已绑定的机器人设备。</text>
					<text class="policy-text">3. 申请导出个人数据。</text>
					<text class="policy-text">4. 注销账号并删除所有关联数据。</text>

					<text class="policy-title">七、未成年人保护</text>
					<text class="policy-text">本平台主要面向具有完全民事行为能力的成年人。若您为未成年人，请在监护人指导下使用本平台并阅读本政策。</text>

					<text class="policy-title">八、政策更新</text>
					<text class="policy-text">我们可能适时修订本隐私政策。更新后的政策将在平台内发布，请您定期查阅。若您继续使用本平台，即视为您同意更新后的隐私政策。</text>

					<text class="policy-title">九、联系我们</text>
					<text class="policy-text">如您对本隐私政策有任何疑问或建议，请联系：810170966qq@gmail.com</text>
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
