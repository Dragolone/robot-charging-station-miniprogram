const ROBOT_BIND_PREFIX = 'robot-bind:'

export function parseRobotBindPayload(scanResult) {
	const raw = String(scanResult || '').trim()
	if (!raw) {
		return buildFail('empty_payload', raw)
	}

	const plainTextParsed = parsePlainTextPayload(raw)
	if (plainTextParsed.ok) return plainTextParsed

	const jsonParsed = parseJsonPayload(raw)
	if (jsonParsed.ok) return jsonParsed

	const urlParsed = parseUrlPayload(raw)
	if (urlParsed.ok) return urlParsed

	return buildFail('invalid_format', raw)
}

function parsePlainTextPayload(raw) {
	if (!raw.startsWith(ROBOT_BIND_PREFIX)) {
		return buildFail('invalid_format', raw)
	}

	const robotCode = String(raw.slice(ROBOT_BIND_PREFIX.length) || '').trim()
	if (!robotCode) {
		return buildFail('missing_robot_code', raw)
	}

	return buildSuccess({
		robotCode,
		raw,
		format: 'plain-text'
	})
}

function parseJsonPayload(raw) {
	if (!raw.startsWith('{') || !raw.endsWith('}')) {
		return buildFail('invalid_format', raw)
	}

	try {
		const payload = JSON.parse(raw)
		if (!payload || typeof payload !== 'object') {
			return buildFail('invalid_format', raw)
		}

		const type = String(payload.type || '').trim()
		const robotCode = String(payload.robotCode || '').trim()
		if (type !== 'robot_bind' || !robotCode) {
			return buildFail('invalid_format', raw)
		}

		return buildSuccess({
			robotCode,
			raw,
			format: 'json',
			payload
		})
	} catch (e) {
		return buildFail('invalid_format', raw)
	}
}

function parseUrlPayload(raw) {
	if (!/^https?:\/\//i.test(raw)) {
		return buildFail('invalid_format', raw)
	}

	const queryIndex = raw.indexOf('?')
	if (queryIndex === -1) {
		return buildFail('invalid_format', raw)
	}

	const query = raw.slice(queryIndex + 1)
	const robotCode = getQueryParam(query, 'robotCode')
	if (!robotCode) {
		return buildFail('invalid_format', raw)
	}

	return buildSuccess({
		robotCode,
		raw,
		format: 'url'
	})
}

function getQueryParam(query, key) {
	const pairs = String(query || '').split('&')
	for (const pair of pairs) {
		const [k, v = ''] = pair.split('=')
		if (decodeURIComponent(String(k || '')) !== key) continue
		return decodeURIComponent(String(v || '')).trim()
	}
	return ''
}

function buildSuccess(data) {
	return {
		ok: true,
		...data
	}
}

function buildFail(reason, raw) {
	return {
		ok: false,
		reason,
		raw
	}
}

