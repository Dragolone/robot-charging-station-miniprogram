'use strict'

const uniID = require('uni-id-common')

function ok(data = {}) {
	return { errCode: 0, ...data }
}

function fail(errMsg, errCode = 1, data = {}) {
	return { errCode, errMsg, ...data }
}

async function assertAdmin(context, uniIdToken) {
	const uniIDIns = uniID.createInstance({ context })
	const checkTokenRes = await uniIDIns.checkToken(uniIdToken)
	if (!checkTokenRes || checkTokenRes.errCode !== 0) {
		return fail(checkTokenRes?.message || '登录状态失效', checkTokenRes?.errCode || 30202)
	}
	const roles = Array.isArray(checkTokenRes.role) ? checkTokenRes.role : []
	if (!roles.includes('admin')) {
		return fail('权限不足（需要 admin 角色）', 403)
	}
	return ok({ uid: checkTokenRes.uid, role: roles, permission: checkTokenRes.permission || [] })
}

exports.main = async (event, context) => {
	const db = uniCloud.database()

	const action = event.action
	const uniIdToken = event.uniIdToken || ''
	const params = event.params || event.data || {}

	const auth = await assertAdmin(context, uniIdToken)
	if (auth.errCode !== 0) return auth

	try {
		if (action === 'create') {
			const robotCode = String(params.robotCode || '').trim()
			const model = String(params.model || '').trim()
			const enable = !!params.enable

			if (!robotCode) return fail('robotCode 不能为空', 400)

			// 防重复：同 robotCode 存在则拒绝
			const existRes = await db.collection('robots').where({ robotCode }).limit(1).get()
			if (existRes.data && existRes.data.length) return fail('robotCode 已存在', 409)

			const doc = {
				robotCode,
				model,
				enable,
				create_date: Date.now()
			}
			const addRes = await db.collection('robots').add(doc)
			return ok({ id: addRes.id })
		}

		if (action === 'update') {
			const id = String(params.id || '').trim()
			if (!id) return fail('缺少参数：id', 400)

			const model = params.model === undefined ? undefined : String(params.model || '').trim()
			const enable = params.enable === undefined ? undefined : !!params.enable

			const updateDoc = { update_date: Date.now() }
			if (model !== undefined) updateDoc.model = model
			if (enable !== undefined) updateDoc.enable = enable

			await db.collection('robots').doc(id).update(updateDoc)
			return ok()
		}

		if (action === 'setEnable') {
			const id = String(params.id || '').trim()
			if (!id) return fail('缺少参数：id', 400)
			await db.collection('robots').doc(id).update({
				enable: !!params.enable,
				update_date: Date.now()
			})
			return ok()
		}

		return fail('未知 action', 400, { action })
	} catch (e) {
		return fail(e.message || '服务异常', 500)
	}
}

