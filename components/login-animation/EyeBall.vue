<template>
	<view class="eyeball" :style="eyeStyle">
		<view v-if="!isBlinking" class="pupil-wrap">
			<view class="pupil-inner" :style="pupilStyle" />
		</view>
	</view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
	size: {
		type: Number,
		default: 18
	},
	pupilSize: {
		type: Number,
		default: 7
	},
	maxDistance: {
		type: Number,
		default: 5
	},
	eyeColor: {
		type: String,
		default: '#ffffff'
	},
	pupilColor: {
		type: String,
		default: '#2d2d2d'
	},
	isBlinking: {
		type: Boolean,
		default: false
	},
	lookX: {
		type: Number,
		default: 0
	},
	lookY: {
		type: Number,
		default: 0
	}
})

const eyeStyle = computed(() => ({
	width: `${props.size}rpx`,
	height: props.isBlinking ? '4rpx' : `${props.size}rpx`,
	backgroundColor: props.eyeColor
}))

const pupilStyle = computed(() => {
	const x = clamp(props.lookX, -props.maxDistance, props.maxDistance)
	const y = clamp(props.lookY, -props.maxDistance, props.maxDistance)
	return {
		width: `${props.pupilSize}rpx`,
		height: `${props.pupilSize}rpx`,
		backgroundColor: props.pupilColor,
		transform: `translate(${x}rpx, ${y}rpx)`
	}
})

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value))
}
</script>

<style scoped>
.eyeball {
	border-radius: 999rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	transition: height 0.15s ease, transform 0.12s ease-out;
}

.pupil-wrap {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;
}

.pupil-inner {
	border-radius: 999rpx;
	transition: transform 0.12s ease-out;
}
</style>
