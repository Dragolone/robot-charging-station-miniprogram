<!-- 账号注册页 -->
<template>
	<view class="uni-content">
		<match-media :min-width="690">
			<view class="login-logo">
				<image :src="logo"></image>
			</view>
			<!-- 顶部文字 -->
			<text class="title title-box">用户名密码注册</text>
		</match-media>
		<uni-forms ref="form" :value="formData" :rules="rules" validate-trigger="submit" err-show-type="toast">
			<uni-forms-item name="username" required>
				<uni-easyinput :inputBorder="false" :focus="focusUsername" @blur="focusUsername = false"
					class="input-box" placeholder="请输入用户名" v-model="formData.username" trim="both" />
			</uni-forms-item>
			<uni-forms-item name="nickname">
				<uni-easyinput :inputBorder="false" :focus="focusNickname" @blur="focusNickname = false"
					class="input-box" placeholder="请输入用户昵称" v-model="formData.nickname" trim="both" />
			</uni-forms-item>
			<uni-forms-item name="email" required>
				<uni-easyinput :inputBorder="false" :focus="focusEmail" @blur="focusEmail = false"
					class="input-box" placeholder="请输入邮箱（用于找回密码）" v-model="formData.email" trim="both" />
			</uni-forms-item>
			<uni-forms-item name="password" v-model="formData.password" required>
				<uni-easyinput :inputBorder="false" :focus="focusPassword" @blur="focusPassword = false"
					class="input-box" maxlength="20"
					:placeholder="'请输入' + (config.passwordStrength == 'weak'?'6':'8') + '-16位密码'" type="password"
					v-model="formData.password" trim="both" />
			</uni-forms-item>
			<uni-forms-item name="password2" v-model="formData.password2" required>
				<uni-easyinput :inputBorder="false" :focus="focusPassword2" @blur="focusPassword2 =false"
					class="input-box" placeholder="再次输入密码" maxlength="20" type="password" v-model="formData.password2"
					trim="both" />
			</uni-forms-item>
			<uni-forms-item>
				<uni-captcha ref="captcha" scene="register" v-model="formData.captcha" />
			</uni-forms-item>
			<uni-id-pages-agreements scope="register" ref="agreements"></uni-id-pages-agreements>
			<button class="uni-btn" type="primary" @click="submit">注册</button>
			<button @click="navigateBack" class="register-back">返回</button>
			<match-media :min-width="690">
				<view class="link-box">
					<text class="link" @click="registerByEmail">邮箱验证码注册</text>
					<text class="link" @click="toLogin">已有账号？点此登录</text>
				</view>
			</match-media>
		</uni-forms>
	</view>
</template>

<script>
	import rules from './validator.js';
	import mixin from '@/uni_modules/uni-id-pages/common/login-page.mixin.js';
	import config from '@/uni_modules/uni-id-pages/config.js'
	import {
		store,
		mutations
	} from '@/uni_modules/uni-id-pages/common/store.js'

	const uniIdCo = uniCloud.importObject("uni-id-co")
	const userService = uniCloud.importObject("userService", { customUI: true })
	export default {
		mixins: [mixin],
		data() {
			return {
				formData: {
					username: "",
					nickname: "",
					email: "",
					password: "",
					password2: "",
					captcha: ""
				},
				rules,
				focusUsername: false,
				focusNickname: false,
				focusEmail: false,
				focusPassword: false,
				focusPassword2: false,
				logo: "/static/logo.png"
			}
		},
		onReady() {
			this.$refs.form.setRules(this.rules)
		},
		onShow() {
			// #ifdef H5
			document.onkeydown = event => {
				var e = event || window.event;
				if (e && e.keyCode == 13) { //回车键的键值为13
					this.submit()
				}
			};
			// #endif
		},
		methods: {
			/**
			 * 触发表单提交
			 */
			submit() {
				this.$refs.form.validate().then((res) => {
					if (this.formData.captcha.length != 4) {
						this.$refs.captcha.focusCaptchaInput = true
						return uni.showToast({
							title: '请输入验证码',
							icon: 'none',
							duration: 3000
						});
					}
					if (this.needAgreements && !this.agree) {
						return this.$refs.agreements.popup(() => {
							this.submitForm(res)
						})
					}
					this.submitForm(res)
				}).catch((errors) => {
					let key = errors[0].key
					key = key.replace(key[0], key[0].toUpperCase())
					this['focus' + key] = true
				})
			},
			async submitForm(params) {
				try {
					const e = await uniIdCo.registerUser(this.formData)
					// 注册成功后 token 在响应中，手动存入以便后续 userService 鉴权通过
					const token = e?.token || e?.newToken?.token
					const tokenExpired = e?.tokenExpired || e?.newToken?.tokenExpired
					if (token && tokenExpired) {
						uni.setStorageSync('uni_id_token', token)
						uni.setStorageSync('uni_id_token_expired', tokenExpired)
					}
					// 通过 userService 写入 email（用于找回密码）
					if (this.formData.email && this.formData.email.trim()) {
						try {
							await userService.saveEmail(this.formData.email.trim())
						} catch (err) {
							console.warn('[register] save email failed:', err)
						}
					}
					this.loginSuccess(e)
				} catch (e) {
					console.log(e.message)
					this.$refs.captcha.getImageCaptcha()
				}
			},
			navigateBack() {
				uni.navigateBack()
			},
			toLogin() {
				uni.navigateTo({
					url: '/uni_modules/uni-id-pages/pages/login/login-withpwd'
				})
			},
			registerByEmail() {
				uni.navigateTo({
					url: '/uni_modules/uni-id-pages/pages/register/register-by-email'
				})
			}
		}
	}
</script>

<style lang="scss">
	@import "@/uni_modules/uni-id-pages/common/login-page.scss";

	@media screen and (max-width: 690px) {
		.uni-content {
			background: #F8F9FA;
		}
	}

	@media screen and (min-width: 690px) {
		.uni-content {
			padding: 30px 40px 60px;
			max-height: 530px;
		}

		.link-box {
			/* #ifndef APP-NVUE */
			display: flex;
			/* #endif */
			flex-direction: row;
			justify-content: space-between;
			margin-top: 20rpx;
		}

		.link {
			font-size: 24rpx;
		}
	}

	.uni-content ::v-deep .uni-forms-item__label {
		position: absolute;
		left: -15px;
	}

	button {
		margin-top: 20rpx;
	}
</style>
