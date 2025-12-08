<script>
	import { connectWS, disconnectWS, clearWSConfig } from '@/utils/ws-client.js'
	import { clearRobotListState } from '@/utils/robot-store.js'

	export default {
		onLaunch: function() {
			console.log('App Launch')
			uni.$on('user:logout', () => {
				disconnectWS()
				clearWSConfig()
				clearRobotListState()
			})
		},
		onShow: function() {
			console.log('App Show')
			connectWS()
		},
		onHide: function() {
			console.log('App Hide')
			disconnectWS()
		}
	}
</script>

<style>
	/*每个页面公共css */
</style>
