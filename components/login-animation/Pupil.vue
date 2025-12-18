<template>
	<view class="pupil" :style="pupilStyle" />
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
	size: {
		type: Number,
		default: 12
	},
	maxDistance: {
		type: Number,
		default: 5
	},
	pupilColor: {
		type: String,
		default: '#2d2d2d'
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

const pupilStyle = computed(() => {
	const x = clamp(props.lookX, -props.maxDistance, props.maxDistance)
	const y = clamp(props.lookY, -props.maxDistance, props.maxDistance)
	return {
		width: `${props.size}rpx`,
		height: `${props.size}rpx`,
		backgroundColor: props.pupilColor,
		transform: `translate(${x}rpx, ${y}rpx)`
	}
})

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value))
}
</script>

<style scoped>
.pupil {
	border-radius: 999rpx;
	transition: transform 0.12s ease-out;
}
</style>
