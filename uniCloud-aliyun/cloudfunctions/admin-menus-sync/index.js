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
	return ok({ uid: checkTokenRes.uid, role: roles })
}

exports.main = async (event, context) => {
	const { uniIdToken = '', menus = [] } = event || {}
	const auth = await assertAdmin(context, uniIdToken)
	if (auth.errCode !== 0) return auth

	if (!Array.isArray(menus) || menus.length === 0) {
		return fail('menus 不能为空', 400)
	}

	// 只允许写入白名单字段，且不允许传 create_date（该字段在 schema 中 forceDefaultValue=now）
	const normalize = (m) => {
		const sort = Number(m.sort || 0)
		return {
			menu_id: String(m.menu_id || '').trim(),
			name: String(m.name || '').trim(),
			icon: String(m.icon || ''),
			url: String(m.url || ''),
			parent_id: String(m.parent_id || ''),
			sort: Number.isFinite(sort) ? sort : 0,
			enable: true,
			permission: Array.isArray(m.permission) ? m.permission : []
		}
	}

	const db = uniCloud.database()
	const col = db.collection('opendb-admin-menus')

	const normalizedMenus = menus.map(normalize).filter(m => m.menu_id && m.name)
	if (!normalizedMenus.length) return fail('menus 无有效数据', 400)

	const menuIds = normalizedMenus.map(m => m.menu_id)
	const existedRes = await col.where({ menu_id: db.command.in(menuIds) }).limit(5000).get()
	const existed = (existedRes.data || existedRes.result?.data || [])
	const existedByMenuId = Object.create(null)
	existed.forEach(m => { existedByMenuId[m.menu_id] = m })

	let inserted = 0
	let updated = 0
	for (const m of normalizedMenus) {
		const old = existedByMenuId[m.menu_id]
		if (old && old._id) {
			await col.doc(old._id).update(m)
			updated++
		} else {
			// 固定 _id 为 menu_id，便于幂等写入
			await col.add({ ...m, _id: m.menu_id })
			inserted++
		}
	}

	return ok({ inserted, updated, menuIds })
}

