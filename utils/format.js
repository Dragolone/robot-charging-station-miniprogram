/**
 * 格式化工具函数
 */

const DEFAULT_EMPTY = '暂无数据'

/**
 * 格式化电量，保留1位小数
 */
export function formatBattery(value) {
	if (value === null || value === undefined) return '0.0'
	return Number(value).toFixed(1)
}

/**
 * 格式化日期时间：timestamp / Date / 字符串 → YYYY-MM-DD HH:mm:ss
 */
export function formatDisplayTime(value, emptyText = DEFAULT_EMPTY) {
	if (value === null || value === undefined || value === '') return emptyText

	let date = null

	if (value instanceof Date) {
		date = value
	} else if (typeof value === 'number' && Number.isFinite(value)) {
		const ts = String(value).length === 10 ? value * 1000 : value
		date = new Date(ts)
	} else {
		const raw = String(value).trim()
		if (!raw) return emptyText

		if (/^\d{10,13}$/.test(raw)) {
			const ts = raw.length === 10 ? Number(raw) * 1000 : Number(raw)
			date = new Date(ts)
		} else {
			const matched = raw.match(
				/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
			)
			if (matched) {
				const [, year, month, day, hour = '0', minute = '0', second = '0'] = matched
				date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
			} else {
				date = new Date(raw.replace(/-/g, '/').replace('T', ' '))
			}
		}
	}

	if (!(date instanceof Date) || Number.isNaN(date.getTime())) return emptyText

	const year = date.getFullYear()
	const month = `${date.getMonth() + 1}`.padStart(2, '0')
	const day = `${date.getDate()}`.padStart(2, '0')
	const hour = `${date.getHours()}`.padStart(2, '0')
	const minute = `${date.getMinutes()}`.padStart(2, '0')
	const second = `${date.getSeconds()}`.padStart(2, '0')
	return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

/**
 * 格式化坐标值：保留有效小数位
 */
export function formatCoordinate(value, emptyText = DEFAULT_EMPTY) {
	if (value === null || value === undefined || value === '') return emptyText
	const num = Number(value)
	if (Number.isNaN(num)) return String(value)
	const fixed = num.toFixed(2).replace(/\.?0+$/, '')
	return fixed || '0'
}

/**
 * 格式化坐标位置：{ x, y } → "X: 1.2 / Y: 3.4"
 */
export function formatLocation(location, emptyText = DEFAULT_EMPTY) {
	const x = formatCoordinate(location?.x, emptyText)
	const y = formatCoordinate(location?.y, emptyText)
	if (x === emptyText && y === emptyText) return emptyText
	return `X: ${x} / Y: ${y}`
}
