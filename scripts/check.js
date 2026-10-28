#!/usr/bin/env node
/**
 * 仓库自检（CI 与本地通用）：node scripts/check.js
 * - 业务集合的 schema / index / init_data 与配置模板是合法 JSON
 * - 业务集合的 schema 与 index 齐全
 * - 自有云函数、模拟器、脚本的 JS 语法正确
 */

'use strict'

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const DB_DIR = 'uniCloud-aliyun/database'
const CONFIG_CENTER = 'uni_modules/uni-config-center/uniCloud/cloudfunctions/common/uni-config-center'
const BUSINESS_COLLECTIONS = ['robots', 'robot_bindings', 'telemetry_latest', 'telemetry_history', 'commands', 'faults']
const JS_DIRS = [
	'uniCloud-aliyun/cloudfunctions/userService',
	'uniCloud-aliyun/cloudfunctions/telemetryIngest',
	'uniCloud-aliyun/cloudfunctions/admin-robot',
	'simulator',
	'scripts'
]

const errors = []
const list = (dir, test) => fs.readdirSync(path.join(ROOT, dir)).filter(test).map(f => path.join(dir, f))

// DCloud 模板自带的 schema 允许注释（JSONC），只严格校验本项目自有的文件
const jsonFiles = [
	...list(DB_DIR, f => BUSINESS_COLLECTIONS.includes(f.split('.')[0]) && f.endsWith('.json')),
	`${CONFIG_CENTER}/uni-id/config.example.json`,
	`${CONFIG_CENTER}/telemetry/config.example.json`,
	'simulator/config.example.json',
	'simulator/package.json'
]
for (const file of jsonFiles) {
	try {
		JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'))
	} catch (e) {
		errors.push(`${file}: 非法 JSON（${e.message}）`)
	}
}

for (const name of BUSINESS_COLLECTIONS) {
	for (const suffix of ['schema', 'index']) {
		const file = `${DB_DIR}/${name}.${suffix}.json`
		if (!fs.existsSync(path.join(ROOT, file))) errors.push(`${file}: 缺失`)
	}
}

const jsFiles = JS_DIRS.flatMap(dir => list(dir, f => f.endsWith('.js')))
for (const file of jsFiles) {
	try {
		execFileSync(process.execPath, ['--check', path.join(ROOT, file)], { stdio: 'pipe' })
	} catch (e) {
		errors.push(`${file}: 语法错误\n${String(e.stderr || e.message).trim()}`)
	}
}

if (errors.length) {
	console.error(`✘ ${errors.length} 个问题：\n\n${errors.join('\n\n')}`)
	process.exit(1)
}
console.log(`✔ ${jsonFiles.length} 个 JSON、${jsFiles.length} 个 JS 文件检查通过`)
