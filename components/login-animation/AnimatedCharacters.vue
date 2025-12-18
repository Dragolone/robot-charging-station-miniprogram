<template>
	<view class="characters-container">
		<view class="char beta" :style="betaStyle">
			<view class="beta-bump" />
			<view class="eyes" :style="betaEyesStyle">
				<EyeBall
					v-for="i in 2"
					:key="`b-${i}`"
					:size="16"
					:pupil-size="6"
					:max-distance="4"
					:is-blinking="isBetaBlinking"
					:look-x="betaLookX"
					:look-y="betaLookY"
				/>
			</view>
		</view>

		<view class="char alpha" :style="alphaStyle">
			<view class="alpha-ear alpha-ear-l" />
			<view class="alpha-ear alpha-ear-r" />
			<view class="eyes" :style="alphaEyesStyle">
				<EyeBall
					v-for="i in 2"
					:key="`a-${i}`"
					:size="20"
					:pupil-size="8"
					:max-distance="5"
					:is-blinking="isAlphaBlinking"
					:look-x="alphaLookX"
					:look-y="alphaLookY"
				/>
			</view>
		</view>

		<view class="char gamma" :style="gammaStyle">
			<view class="eyes" :style="gammaEyesStyle">
				<Pupil
					v-for="i in 2"
					:key="`g-${i}`"
					:size="11"
					:max-distance="5"
					:look-x="gammaLookX"
					:look-y="gammaLookY"
				/>
			</view>
			<view class="mouth" :style="gammaMouthStyle" />
		</view>

		<view class="char delta" :style="deltaStyle">
			<view class="eyes" :style="deltaEyesStyle">
				<Pupil
					v-for="i in 2"
					:key="`d-${i}`"
					:size="10"
					:max-distance="5"
					:look-x="deltaLookX"
					:look-y="deltaLookY"
				/>
			</view>
		</view>
	</view>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import EyeBall from './EyeBall.vue'
import Pupil from './Pupil.vue'

const props = defineProps({
	isTyping: {
		type: Boolean,
		default: false
	},
	hasSecret: {
		type: Boolean,
		default: false
	},
	secretVisible: {
		type: Boolean,
		default: false
	},
	gazeX: {
		type: Number,
		default: 0
	},
	gazeY: {
		type: Number,
		default: 0
	}
})

const isAlphaBlinking = ref(false)
const isBetaBlinking = ref(false)
const isLookingAtEachOther = ref(false)
const isAlphaPeeking = ref(false)

const hiding = computed(() => props.hasSecret && props.secretVisible)
const leaning = computed(() => props.isTyping || (props.hasSecret && !props.secretVisible))

let alphaBlinkTimer = 0
let alphaBlinkHoldTimer = 0
let betaBlinkTimer = 0
let betaBlinkHoldTimer = 0
let typingTimer = 0
let peekTimer = 0
let peekHoldTimer = 0

const gazeFaceX = computed(() => clamp(props.gazeX, -1, 1) * 14)
const gazeFaceY = computed(() => clamp(props.gazeY, -1, 1) * 12)
const bodySkew = computed(() => clamp(-props.gazeX * 7, -7, 7))

watch(
	() => props.isTyping,
	(value) => {
		clearTimeout(typingTimer)
		if (value) {
			isLookingAtEachOther.value = true
			typingTimer = setTimeout(() => {
				isLookingAtEachOther.value = false
			}, 800)
		} else {
			isLookingAtEachOther.value = false
		}
	}
)

watch(
	() => [props.hasSecret, props.secretVisible],
	() => {
		syncPeekTimer()
	},
	{ immediate: true }
)

onMounted(() => {
	scheduleBlink('alpha')
	scheduleBlink('beta')
})

onUnmounted(() => {
	clearTimeout(alphaBlinkTimer)
	clearTimeout(alphaBlinkHoldTimer)
	clearTimeout(betaBlinkTimer)
	clearTimeout(betaBlinkHoldTimer)
	clearTimeout(typingTimer)
	clearTimeout(peekTimer)
	clearTimeout(peekHoldTimer)
})

const alphaStyle = computed(() => ({
	height: leaning.value ? '400rpx' : '350rpx',
	transform: hiding.value
		? 'skewX(0deg)'
		: leaning.value
			? `skewX(${bodySkew.value - 12}deg) translateX(34rpx)`
			: `skewX(${bodySkew.value}deg)`
}))

const alphaEyesStyle = computed(() => ({
	left: hiding.value ? '28rpx' : isLookingAtEachOther.value ? '66rpx' : `${46 + gazeFaceX.value}rpx`,
	top: hiding.value ? '44rpx' : isLookingAtEachOther.value ? '80rpx' : `${76 + gazeFaceY.value}rpx`,
	gap: '30rpx'
}))

const betaStyle = computed(() => ({
	transform: hiding.value
		? 'skewX(0deg)'
		: isLookingAtEachOther.value
			? `skewX(${bodySkew.value * 1.4 + 10}deg) translateX(22rpx)`
			: leaning.value
				? `skewX(${bodySkew.value * 1.4}deg)`
				: `skewX(${bodySkew.value}deg)`
}))

const betaEyesStyle = computed(() => ({
	left: hiding.value ? '16rpx' : isLookingAtEachOther.value ? '48rpx' : `${36 + gazeFaceX.value}rpx`,
	top: hiding.value ? '34rpx' : isLookingAtEachOther.value ? '56rpx' : `${68 + gazeFaceY.value}rpx`,
	gap: '26rpx'
}))

const gammaStyle = computed(() => ({
	transform: hiding.value ? 'skewX(0deg)' : `skewX(${bodySkew.value}deg)`
}))

const gammaEyesStyle = computed(() => ({
	left: hiding.value ? '18rpx' : `${36 + gazeFaceX.value}rpx`,
	top: hiding.value ? '32rpx' : `${58 + gazeFaceY.value}rpx`,
	gap: '24rpx'
}))

const gammaMouthStyle = computed(() => ({
	left: hiding.value ? '14rpx' : `${30 + gazeFaceX.value}rpx`,
	top: hiding.value ? '82rpx' : `${106 + gazeFaceY.value}rpx`
}))

const deltaStyle = computed(() => ({
	transform: hiding.value ? 'skewX(0deg)' : `skewX(${bodySkew.value}deg)`
}))

const deltaEyesStyle = computed(() => ({
	left: hiding.value ? '14rpx' : `${28 + gazeFaceX.value}rpx`,
	top: hiding.value ? '26rpx' : `${48 + gazeFaceY.value}rpx`,
	gap: '20rpx'
}))

const alphaLookX = computed(() => {
	if (hiding.value) return isAlphaPeeking.value ? 4 : -4
	if (isLookingAtEachOther.value) return 3
	return clamp(props.gazeX * 5, -5, 5)
})

const alphaLookY = computed(() => {
	if (hiding.value) return isAlphaPeeking.value ? 5 : -4
	if (isLookingAtEachOther.value) return 4
	return clamp(props.gazeY * 5, -5, 5)
})

const betaLookX = computed(() => {
	if (hiding.value) return -4
	if (isLookingAtEachOther.value) return 0
	return clamp(props.gazeX * 4, -4, 4)
})

const betaLookY = computed(() => {
	if (hiding.value) return -4
	if (isLookingAtEachOther.value) return -4
	return clamp(props.gazeY * 4, -4, 4)
})

const gammaLookX = computed(() => (hiding.value ? -5 : clamp(props.gazeX * 5, -5, 5)))
const gammaLookY = computed(() => (hiding.value ? -4 : clamp(props.gazeY * 5, -5, 5)))

const deltaLookX = computed(() => (hiding.value ? -5 : clamp(props.gazeX * 5, -5, 5)))
const deltaLookY = computed(() => (hiding.value ? -4 : clamp(props.gazeY * 5, -5, 5)))

function scheduleBlink(type) {
	const wait = Math.floor(Math.random() * 2200) + 2600
	if (type === 'alpha') {
		alphaBlinkTimer = setTimeout(() => {
			isAlphaBlinking.value = true
			alphaBlinkHoldTimer = setTimeout(() => {
				isAlphaBlinking.value = false
				scheduleBlink('alpha')
			}, 150)
		}, wait)
		return
	}

	betaBlinkTimer = setTimeout(() => {
		isBetaBlinking.value = true
		betaBlinkHoldTimer = setTimeout(() => {
			isBetaBlinking.value = false
			scheduleBlink('beta')
		}, 150)
	}, wait)
}

function syncPeekTimer() {
	clearTimeout(peekTimer)
	clearTimeout(peekHoldTimer)

	if (!(props.hasSecret && props.secretVisible)) {
		isAlphaPeeking.value = false
		return
	}

	const wait = Math.floor(Math.random() * 1800) + 1800
	peekTimer = setTimeout(() => {
		isAlphaPeeking.value = true
		peekHoldTimer = setTimeout(() => {
			isAlphaPeeking.value = false
			syncPeekTimer()
		}, 650)
	}, wait)
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value))
}
</script>

<style scoped>
.characters-container {
	position: relative;
	width: 600rpx;
	height: 440rpx;
	margin: 0 auto;
}

.char {
	position: absolute;
	bottom: 0;
	transform-origin: bottom center;
	transition: transform 0.45s ease-in-out, height 0.45s ease-in-out;
	will-change: transform, height;
}

.alpha {
	left: 175rpx;
	width: 160rpx;
	background: linear-gradient(180deg, #8577EA 0%, #6C5CE7 100%);
	border-radius: 54rpx 54rpx 16rpx 16rpx;
	z-index: 1;
}

.alpha-ear {
	position: absolute;
	width: 18rpx;
	height: 18rpx;
	border-radius: 999rpx;
	background: #9B8FEF;
	top: 6rpx;
}

.alpha-ear-l {
	left: 26rpx;
}

.alpha-ear-r {
	right: 26rpx;
}

.beta {
	left: 50rpx;
	width: 140rpx;
	height: 240rpx;
	background: linear-gradient(180deg, #62D8CE 0%, #4ECDC4 100%);
	border-radius: 48rpx 48rpx 12rpx 12rpx;
	z-index: 2;
}

.beta-bump {
	position: absolute;
	width: 14rpx;
	height: 14rpx;
	border-radius: 999rpx;
	background: #7DE8E0;
	top: 4rpx;
	left: 50%;
	transform: translateX(-50%);
}

.gamma {
	left: 320rpx;
	width: 130rpx;
	height: 210rpx;
	background: linear-gradient(180deg, #FFC078 0%, #FFB067 100%);
	border-radius: 44rpx 44rpx 10rpx 10rpx;
	z-index: 3;
}

.delta {
	left: 432rpx;
	width: 108rpx;
	height: 170rpx;
	background: linear-gradient(180deg, #B9A4FC 0%, #A78BFA 100%);
	border-radius: 38rpx 38rpx 8rpx 8rpx;
	z-index: 4;
}

.eyes {
	position: absolute;
	display: flex;
	z-index: 1;
	transition: left 0.45s ease-in-out, top 0.45s ease-in-out, gap 0.45s ease-in-out;
}

.mouth {
	position: absolute;
	width: 56rpx;
	height: 4rpx;
	background: rgba(0, 0, 0, 0.25);
	border-radius: 999rpx;
	transition: left 0.2s ease-out, top 0.2s ease-out;
}
</style>
