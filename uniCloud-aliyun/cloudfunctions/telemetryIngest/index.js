'use strict'

const db = uniCloud.database()
const createConfig = require('uni-config-center')
const config = createConfig({ pluginId: 'telemetry' }).config()
const DEFAULT_MIN_REPORT_INTERVAL_MS = 3 * 1000
const DEFAULT_DUPLICATE_WINDOW_MS = 10 * 1000

function resolveIngestToken() {
  const envToken =
    typeof process !== 'undefined' && process.env ? process.env.TELEMETRY_INGEST_TOKEN : ''
  const configToken = config?.telemetry?.ingestToken
  return String(envToken || configToken || '').trim()
}

const INGEST_TOKEN = resolveIngestToken()

function ok() {
  return { code: 0, data: { ok: true } }
}

function fail(code, message) {
  return { code, message }
}

function getHeader(headers, name) {
  if (!headers) return ''
  const lower = String(name || '').toLowerCase()
  for (const k of Object.keys(headers)) {
    if (String(k).toLowerCase() === lower) return String(headers[k] ?? '')
  }
  return ''
}

function asNumberOrUndefined(v, fieldName) {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  if (!Number.isFinite(n)) {
    throw new Error(`${fieldName} 必须为数字`)
  }
  return n
}

function asTsOrUndefined(v, fieldName) {
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return undefined
    // 允许传数字字符串或 ISO 时间字符串
    const asNum = Number(s)
    if (Number.isFinite(asNum)) return asNum
    const parsed = Date.parse(s)
    if (Number.isFinite(parsed)) return parsed
  }
  throw new Error(`${fieldName} 必须为时间戳(ms)或可解析的时间字符串`)
}

function asPositiveNumberOrUndefined(v) {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return n
}

function toRawJson(raw) {
  if (raw === undefined || raw === null) return ''
  if (typeof raw === 'string') return raw
  try {
    return JSON.stringify(raw)
  } catch (e) {
    // 极端情况（循环引用等）兜底
    return String(raw)
  }
}

function getMinReportIntervalMs() {
  return asPositiveNumberOrUndefined(config?.telemetry?.minReportIntervalMs) || DEFAULT_MIN_REPORT_INTERVAL_MS
}

function getDuplicateWindowMs() {
  return asPositiveNumberOrUndefined(config?.telemetry?.duplicateWindowMs) || DEFAULT_DUPLICATE_WINDOW_MS
}

function getDocTimestamp(doc, fields) {
  if (!doc || !fields || !fields.length) return 0
  for (const field of fields) {
    const n = Number(doc[field] || 0)
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}

function parseBody(event) {
  // 兼容：
  // 1) 云函数 URL 化（event.body 为 JSON 字符串）
  // 2) uniCloud.callFunction（event 直接是对象参数）
  if (event && typeof event.body === 'string') {
    const s = event.body.trim()
    if (!s) return {}
    try {
      return JSON.parse(s)
    } catch (e) {
      throw new Error('body 不是合法 JSON')
    }
  }
  // 有些网关会把 JSON 直接解析为对象
  if (event && typeof event.body === 'object' && event.body) return event.body
  return event || {}
}

async function getLatestByRobotCode(robotCode) {
  const latestCol = db.collection('telemetry_latest')
  const existRes = await latestCol.where({ robotCode }).limit(1).get()
  if (existRes.data && existRes.data.length > 0) {
    return existRes.data[0]
  }
  return null
}

function isRateLimited(latestDoc, incomingDoc) {
  if (!latestDoc) return false
  const prevReceivedAt = getDocTimestamp(latestDoc, ['receivedAt', 'updatedAt', 'createdAt', 'ts'])
  const nextReceivedAt = getDocTimestamp(incomingDoc, ['receivedAt', 'createdAt', 'ts'])
  if (!prevReceivedAt || !nextReceivedAt) return false
  return nextReceivedAt - prevReceivedAt < getMinReportIntervalMs()
}

function isDuplicateTelemetry(latestDoc, incomingDoc) {
  if (!latestDoc) return false

  const prevTs = getDocTimestamp(latestDoc, ['ts', 'receivedAt', 'updatedAt', 'createdAt'])
  const nextTs = getDocTimestamp(incomingDoc, ['ts', 'receivedAt', 'createdAt'])
  if (!prevTs || !nextTs) return false
  if (Math.abs(nextTs - prevTs) > getDuplicateWindowMs()) return false

  return (
    Number(latestDoc.speed) === Number(incomingDoc.speed) &&
    Number(latestDoc.vehicleBattery) === Number(incomingDoc.vehicleBattery) &&
    Number(latestDoc.packBattery) === Number(incomingDoc.packBattery) &&
    String(latestDoc.rawJson || '') === String(incomingDoc.rawJson || '')
  )
}

async function upsertLatestByRobotCode(robotCode, doc, existDoc) {
  const latestCol = db.collection('telemetry_latest')
  if (existDoc && existDoc._id) {
    const id = existDoc._id
    await latestCol.doc(id).update(doc)
    return
  }
  await latestCol.add(doc)
}

exports.main = async (event, context) => {
  try {
    if (!INGEST_TOKEN) {
      return fail(5001, '服务端未配置 telemetry.ingestToken')
    }

    const headers = (event && event.headers) || (context && context.headers) || {}
    const token = getHeader(headers, 'X-INGEST-TOKEN')
    if (!token || token !== INGEST_TOKEN) {
      return fail(401, 'Unauthorized')
    }

    // 若走 URL 化，限制必须 POST（非 URL 化调试/调用则跳过）
    const httpMethod = (event && event.httpMethod) || ''
    if (httpMethod && String(httpMethod).toUpperCase() !== 'POST') {
      return fail(405, 'Method Not Allowed')
    }

    const body = parseBody(event)

    const robotCode = String(body.robotCode || '').trim()
    if (!robotCode) return fail(1001, 'robotCode 不能为空')

    const speed = asNumberOrUndefined(body.speed, 'speed')
    const vehicleBattery = asNumberOrUndefined(body.vehicleBattery, 'vehicleBattery')
    const packBattery = asNumberOrUndefined(body.packBattery, 'packBattery')
    const ts = asTsOrUndefined(body.ts, 'ts') ?? Date.now()
    const receivedAt = asTsOrUndefined(body.receivedAt, 'receivedAt') ?? Date.now()
    const rawJson = toRawJson(body.raw)

    const now = Date.now()

    const baseDoc = {
      robotCode,
      speed,
      vehicleBattery,
      packBattery,
      ts,
      receivedAt,
      rawJson,
      createdAt: now
    }

    const latestDoc = await getLatestByRobotCode(robotCode)
    if (isRateLimited(latestDoc, baseDoc)) {
      console.info('[telemetryIngest] skip rate-limited', { robotCode, ts, receivedAt })
      return ok()
    }

    if (isDuplicateTelemetry(latestDoc, baseDoc)) {
      console.info('[telemetryIngest] skip duplicate', { robotCode, ts })
      return ok()
    }

    // history：每次插入一条
    await db.collection('telemetry_history').add(baseDoc)

    // latest：robotCode 唯一键 upsert 最新一条（更新时不覆盖 createdAt）
    const latestUpdateDoc = { ...baseDoc, updatedAt: now }
    if (latestDoc && latestDoc._id) {
      delete latestUpdateDoc.createdAt
    }
    await upsertLatestByRobotCode(robotCode, latestUpdateDoc, latestDoc)

    return ok()
  } catch (e) {
    console.error('telemetryIngest error:', e)
    return fail(5000, e.message || '服务器内部错误')
  }
}

