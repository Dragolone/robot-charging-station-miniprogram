<template>
	<view class="page">
		<!-- Header -->
		<view class="page-hero">
			<view class="hero-icon-wrap">
				<uni-icons type="help-filled" size="32" color="#5427e6"></uni-icons>
			</view>
			<text class="hero-title">使用帮助</text>
			<text class="hero-desc">快速上手机器人充电站管理平台</text>
		</view>

		<!-- Quick Start -->
		<view class="section">
			<text class="section-label">快速入门</text>
			<view class="card">
				<view class="step-item">
					<view class="step-number-wrap">
						<text class="step-number">1</text>
					</view>
					<view class="step-content">
						<text class="step-title">注册并登录账号</text>
						<text class="step-desc">使用用户名和密码完成注册，登录后即可使用平台功能。</text>
					</view>
				</view>
				<view class="step-item">
					<view class="step-number-wrap">
						<text class="step-number">2</text>
					</view>
					<view class="step-content">
						<text class="step-title">绑定机器人</text>
						<text class="step-desc">在机器人页面点击「添加机器人」，输入设备编号或扫描二维码完成绑定。</text>
					</view>
				</view>
				<view class="step-item">
					<view class="step-number-wrap">
						<text class="step-number">3</text>
					</view>
					<view class="step-content">
						<text class="step-title">查看机器人状态</text>
						<text class="step-desc">绑定后可在列表中查看机器人在线状态、电量、位置等实时信息。</text>
					</view>
				</view>
				<view class="step-item">
					<view class="step-number-wrap">
						<text class="step-number">4</text>
					</view>
					<view class="step-content">
						<text class="step-title">远程控制机器人</text>
						<text class="step-desc">进入机器人详情页，使用方向键、摇杆或坐标导航控制机器人移动。</text>
					</view>
				</view>
			</view>
		</view>

		<!-- FAQ -->
		<view class="section">
			<text class="section-label">常见问题</text>
			<view class="card">
				<view class="faq-item" v-for="(item, index) in faqList" :key="index" @tap="toggleFaq(index)">
					<view class="faq-header">
						<text class="faq-question">{{ item.q }}</text>
						<text class="faq-toggle">{{ expandedFaq === index ? '−' : '+' }}</text>
					</view>
					<view class="faq-answer" v-if="expandedFaq === index">
						<text class="faq-answer-text">{{ item.a }}</text>
					</view>
				</view>
			</view>
		</view>

		<!-- Contact -->
		<view class="section">
			<text class="section-label">联系我们</text>
			<view class="card">
				<view class="card-item" hover-class="card-item-hover" @tap="copyEmail">
					<view class="item-icon-wrap item-icon-purple">
						<uni-icons type="email" size="20" color="#5427e6"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title">技术支持邮箱</text>
						<text class="item-desc">810170966qq@gmail.com</text>
					</view>
					<text class="item-action">复制</text>
				</view>
				<view class="card-item" hover-class="card-item-hover" @tap="goFeedback">
					<view class="item-icon-wrap item-icon-orange">
						<uni-icons type="compose" size="20" color="#8E3D00"></uni-icons>
					</view>
					<view class="item-content">
						<text class="item-title">意见反馈</text>
						<text class="item-desc">提交问题描述与建议</text>
					</view>
					<text class="item-arrow">›</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'

const expandedFaq = ref(-1)

const faqList = [
	{
		q: '为什么机器人显示离线？',
		a: '机器人在 15 秒内没有上传遥测数据即判定为离线。请检查机器人是否通电、网络连接是否正常。'
	},
	{
		q: '如何解绑机器人？',
		a: '进入机器人详情页，点击右上角菜单按钮，选择「解绑机器人」即可。解绑不会删除机器人的历史数据。'
	},
	{
		q: '遥控指令发送失败怎么办？',
		a: '请确认机器人处于在线状态。离线机器人无法接收控制指令。若在线仍失败，请检查网络连接并稍后重试。'
	},
	{
		q: '电量显示不准确？',
		a: '电量数据来自机器人的实时遥测。若数据未更新，可能是机器人传感器上报延迟或网络波动导致。'
	},
	{
		q: '如何修改登录密码？',
		a: '前往「我的」→「通用设置」→「安全与隐私」→「修改密码」，按提示完成密码修改。'
	},
	{
		q: '支持绑定多台机器人吗？',
		a: '支持。您可以绑定多台机器人并在列表中统一管理，每台机器人需使用唯一的设备编号绑定。'
	}
]

function toggleFaq(index) {
	expandedFaq.value = expandedFaq.value === index ? -1 : index
}

function copyEmail() {
	uni.setClipboardData({
		data: '810170966qq@gmail.com',
		success: () => {
			uni.showToast({ title: '已复制', icon: 'success' })
		}
	})
}

function goFeedback() {
	uni.showModal({
		title: '意见反馈',
		content: '如需反馈问题或提出建议，请发送邮件至 810170966qq@gmail.com，我们会尽快回复。',
		showCancel: false
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

/* Steps */
.step-item {
	display: flex;
	gap: 20rpx;
	padding: 24rpx 28rpx;
}

.step-number-wrap {
	width: 48rpx;
	height: 48rpx;
	border-radius: 14rpx;
	background: #EADDFF;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.step-number {
	font-size: 24rpx;
	font-weight: 700;
	color: #5427e6;
}

.step-content {
	flex: 1;
	min-width: 0;
}

.step-title {
	font-size: 28rpx;
	font-weight: 600;
	color: #191C1D;
	display: block;
}

.step-desc {
	font-size: 24rpx;
	color: #6b7280;
	margin-top: 6rpx;
	line-height: 1.6;
	display: block;
}

/* FAQ */
.faq-item {
	padding: 24rpx 28rpx;
}

.faq-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.faq-question {
	font-size: 28rpx;
	font-weight: 500;
	color: #191C1D;
	flex: 1;
}

.faq-toggle {
	font-size: 36rpx;
	font-weight: 300;
	color: #5427e6;
	width: 48rpx;
	text-align: center;
	flex-shrink: 0;
}

.faq-answer {
	margin-top: 12rpx;
	padding-top: 12rpx;
}

.faq-answer-text {
	font-size: 24rpx;
	color: #6b7280;
	line-height: 1.8;
}

/* Contact Cards */
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

.item-icon-orange {
	background: #FFDAD6;
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

.item-action {
	font-size: 24rpx;
	font-weight: 500;
	color: #5427e6;
	flex-shrink: 0;
}

.item-arrow {
	font-size: 34rpx;
	color: #d1d5db;
	flex-shrink: 0;
	line-height: 1;
}
</style>
