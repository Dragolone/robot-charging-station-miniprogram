#!/usr/bin/env node
/**
 * 一键生成本地配置（零依赖，可重复运行：已有的密钥不会被覆盖）
 *
 * 从各目录的 config.example.json 生成 config.json（均已加入 .gitignore），
 * 云端与模拟器共用同一份 telemetry 密钥。用法见 --help。
 */

'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const CONFIG_CENTER = 'uni_modules/uni-config-center/uniCloud/cloudfunctions/common/uni-config-center'

const TARGETS = [
	{
		dir: `${CONFIG_CENTER}/uni-id`,
		cloud: true,
		secrets: ['tokenSecret', 'requestAuthSecret']
	},
	{
		dir: `${CONFIG_CENTER}/telemetry`,
		cloud: true,
		secrets: ['telemetry.ingestToken', 'telemetry.commandBridge.token', 'telemetry.ws.secret'],
		options: { '--bridge-url': 'telemetry.commandBridge.url', '--ws-url': 'telemetry.ws.url' }
	},
	{
		dir: 'simulator',
		secrets: [],
		options: { '--ingest-url': 'ingestUrl' }
	}
]

const VALUE_OPTIONS = ['--root', ...TARGETS.flatMap(t => Object.keys(t.options || {}))]

const HELP = `用法：node scripts/setup.js [选项]

  （无参数）           生成缺失的密钥，已有的不会被覆盖
  --bridge-url <url>   指令桥地址（L3 遥控：内网穿透地址 + /sendCommand）
  --ws-url <url>       实时推送地址（默认 ws://127.0.0.1:8787/ws）
  --ingest-url <url>   模拟器使用的 telemetryIngest 地址
  --force              重新生成全部密钥
`

function parseArgs(argv) {
	const args = { force: false, values: {} }
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		if (arg === '--force') args.force = true
		else if (arg === '-h' || arg === '--help') args.help = true
		else if (VALUE_OPTIONS.includes(arg) && argv[i + 1] !== undefined) args.values[arg] = argv[++i]
		else throw new Error(`未知参数或缺少取值：${arg}`)
	}
	return args
}

function getPath(obj, keyPath) {
	return keyPath.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)
}

function setPath(obj, keyPath, value) {
	const keys = keyPath.split('.')
	let cur = obj
	for (const k of keys.slice(0, -1)) {
		if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {}
		cur = cur[k]
	}
	cur[keys[keys.length - 1]] = value
}

function needsSecret(value) {
	return !value || /^REPLACE_WITH/.test(String(value))
}

function randomSecret() {
	return crypto.randomBytes(32).toString('base64url')
}

function run(argv) {
	const args = parseArgs(argv)
	if (args.help) {
		console.log(HELP)
		return
	}
	const root = path.resolve(args.values['--root'] || path.join(__dirname, '..'))
	let cloudChanged = false
	let secretsRegenerated = false

	console.log('')
	for (const target of TARGETS) {
		const examplePath = path.join(root, target.dir, 'config.example.json')
		const configPath = path.join(root, target.dir, 'config.json')
		const existed = fs.existsSync(configPath)
		const config = JSON.parse(fs.readFileSync(existed ? configPath : examplePath, 'utf8'))
		const notes = []

		for (const keyPath of target.secrets) {
			if (args.force || needsSecret(getPath(config, keyPath))) {
				setPath(config, keyPath, randomSecret())
				notes.push(`生成 ${keyPath.replace(/^telemetry\./, '')}`)
				if (existed) secretsRegenerated = true
			}
		}
		for (const [flag, keyPath] of Object.entries(target.options || {})) {
			if (args.values[flag] === undefined) continue
			setPath(config, keyPath, args.values[flag].trim())
			notes.push(`${keyPath.replace(/^telemetry\./, '')} = ${args.values[flag].trim()}`)
		}

		const rel = path.relative(root, configPath)
		if (!existed || notes.length) {
			fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')
			if (target.cloud) cloudChanged = true
			console.log(`  ✔ ${rel}${existed ? '' : '（新建）'}`)
			notes.forEach(n => console.log(`      ${n}`))
		} else {
			console.log(`  · ${rel} 无需修改`)
		}
	}

	const telemetry = JSON.parse(fs.readFileSync(path.join(root, CONFIG_CENTER, 'telemetry/config.json'), 'utf8')).telemetry
	const simulator = JSON.parse(fs.readFileSync(path.join(root, 'simulator/config.json'), 'utf8'))
	console.log('')
	console.log('  当前地址')
	console.log(`    commandBridge.url  ${telemetry.commandBridge.url || '（未设置，L3 遥控时再配置）'}`)
	console.log(`    ws.url             ${telemetry.ws.url || '（未设置）'}`)
	console.log(`    simulator.ingestUrl ${simulator.ingestUrl || '（未设置，L2 实时遥测时再配置）'}`)
	console.log('')
	if (cloudChanged) {
		console.log('  ⚠ 云端配置已变化，需重新部署才生效：')
		console.log('    HBuilderX 右键 uniCloud-aliyun/cloudfunctions →「上传所有云函数、公共模块及 Actions」')
	}
	if (secretsRegenerated) {
		console.log('  ⚠ 已重新生成密钥：上传后已登录用户需重新登录，模拟器需重启')
	}
	console.log('  以上 config.json 已在 .gitignore 中，请勿提交。')
	console.log('')
}

try {
	run(process.argv.slice(2))
} catch (e) {
	console.error(`\nsetup 失败：${e.message}\n`)
	process.exit(1)
}
