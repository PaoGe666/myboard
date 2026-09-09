/*
 * parseShareLink —— 把常见代理分享链接解析成 mihomo 节点对象。
 *
 * 支持(单条 / 换行 / 多条文本混合):
 *   ss://         SIP002  ss://base64(method:password)@host:port#name
 *                旧版   ss://base64(method:password) [无 host 时从 base64 解出]
 *   vmess://      vmess://base64(json)   json 内含 v/ps/add/port/id/...
 *   vless://      vless://uuid@host:port?security=...&type=...&sni=...#name
 *   trojan://     trojan://password@host:port?sni=...&allowInsecure=...#name
 *   hysteria2://   hysteria2://password@host:port?sni=...&skip-cert-verify=...#name
 *   hy2://        hysteria2 别名
 *   tuic://       tuic://uuid:password@host:port?congestion_control=...#name
 *
 * 返回 { name, type, server, port, ...剩余字段 } | null(无法解析)
 * 多条文本返回数组(过滤 null);单条返回单对象或 null。
 */

const decodeBase64 = (s: string): string => {
  // 容忍 URL-safe base64
  let t = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = t.length % 4
  if (pad) t += '='.repeat(4 - pad)
  try {
    if (typeof atob === 'function') {
      const bin = atob(t)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return new TextDecoder().decode(bytes)
    }
  } catch {
    /* fallthrough */
  }
  return ''
}

const urlDecode = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

// 共有辅助: 把 # 前后切成 (base, name),与把 userinfo@host:port?query 切成 (credential, server, port, query)
const splitHash = (raw: string): { base: string; name: string } => {
  const i = raw.indexOf('#')
  return i < 0
    ? { base: raw, name: '' }
    : { base: raw.slice(0, i), name: urlDecode(raw.slice(i + 1)) }
}

const splitAuthority = (
  authority: string,
): { credential: string; server: string; port: number } | null => {
  const at = authority.indexOf('@')
  if (at < 0) return null
  const credential = urlDecode(authority.slice(0, at))
  const hp = authority.slice(at + 1)
  const m = hp.match(/^(.+):(\d+)$/)
  if (!m) return null
  return { credential, server: m[1], port: Number(m[2]) }
}

const parseQuery = (q: string): Record<string, string> => {
  const out: Record<string, string> = {}
  if (!q) return out
  const stripped = q.startsWith('?') ? q.slice(1) : q
  for (const pair of stripped.split('&')) {
    if (!pair) continue
    const idx = pair.indexOf('=')
    const k = idx === -1 ? pair : pair.slice(0, idx)
    const v = idx === -1 ? '' : pair.slice(idx + 1)
    out[decodeURIComponent(k)] = urlDecode(v)
  }
  return out
}

const parseName = (frag: string, fallback: string): string => {
  if (!frag) return fallback
  try {
    return decodeURIComponent(frag)
  } catch {
    return frag
  }
}

const parseSs = (raw: string): Record<string, unknown> | null => {
  // ss://<base64-or-tag>#name  OR  ss://base64(method:password)@host:port#name
  const hashIdx = raw.indexOf('#')
  const name = parseName(hashIdx >= 0 ? raw.slice(hashIdx + 1) : '', 'ss-node')
  const body = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw
  const main = body.slice('ss://'.length).replace(/\/$/, '')
  // SIP002: userinfo@host:port
  const atIdx = main.indexOf('@')
  let userinfo = ''
  let hostport = ''
  if (atIdx >= 0) {
    userinfo = main.slice(0, atIdx)
    hostport = main.slice(atIdx + 1)
  } else {
    // 旧版: 整段 base64
    userinfo = decodeBase64(main)
    const hp = userinfo.split('@')
    if (hp.length === 2) {
      userinfo = hp[0]
      hostport = hp[1]
    } else {
      return null
    }
  }
  // userinfo 可能是 base64(method:password) 或 url-encoded SIP002
  let decoded = userinfo
  try {
    decoded = urlDecode(userinfo)
  } catch {
    /* keep */
  }
  if (!decoded.includes(':')) {
    decoded = decodeBase64(userinfo)
  }
  const colonIdx = decoded.indexOf(':')
  if (colonIdx < 0) return null
  const method = decoded.slice(0, colonIdx)
  const password = decoded.slice(colonIdx + 1)
  const [server, portStr] = hostport.split(':')
  const port = Number(portStr)
  if (!server || !port) return null
  const node: Record<string, unknown> = {
    name,
    type: 'ss',
    server,
    port,
    cipher: method,
    password,
  }
  return node
}

const parseVmess = (raw: string): Record<string, unknown> | null => {
  const b64 = raw.slice('vmess://'.length)
  const json = decodeBase64(b64)
  if (!json) return null
  let data: Record<string, unknown>
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }
  const v = String(data['v'] ?? '2')
  const ps = String(data['ps'] ?? 'vmess-node')
  const add = String(data['add'] ?? '')
  const port = Number(data['port'] ?? 0)
  const id = String(data['id'] ?? '')
  const aid = Number(data['aid'] ?? 0)
  const scy = String(data['scy'] ?? 'auto')
  const sni = data['sni'] ? String(data['sni']) : undefined
  const net = String(data['net'] ?? 'tcp')
  const host = data['host'] ? String(data['host']) : undefined
  const path = data['path'] ? String(data['path']) : undefined
  const tlsStr = String(data['tls'] ?? '')
  if (!add || !port || !id) return null
  const node: Record<string, unknown> = {
    name: ps,
    type: 'vmess',
    server: add,
    port,
    uuid: id,
    alterId: aid,
    cipher: scy,
  }
  if (tlsStr === 'tls' || tlsStr === 'reality') node['tls'] = true
  if (sni) node['sni'] = sni
  if (net && net !== 'tcp') {
    const opts: Record<string, string> = {}
    if (host) opts['headers'] = `Host: ${host}`
    if (path) opts['path'] = path
    if (net === 'ws') node['ws-opts'] = opts
    else if (net === 'h2') node['h2-opts'] = { path: path ?? '/' }
  }
  if (v) node['_v'] = v
  return node
}

const parseVlessTrojan = (
  raw: string,
  scheme: 'vless' | 'trojan',
): Record<string, unknown> | null => {
  const body = raw.slice(`${scheme}://`.length)
  const { base, name } = splitHash(body)
  const queryIdx = base.indexOf('?')
  const authority = queryIdx >= 0 ? base.slice(0, queryIdx) : base
  const query = queryIdx >= 0 ? base.slice(queryIdx) : ''
  const auth = splitAuthority(authority)
  if (!auth) return null
  const { credential, server, port } = auth
  const params = parseQuery(query)
  const node: Record<string, unknown> = { name, type: scheme, server, port }
  if (scheme === 'vless') node['uuid'] = credential
  else node['password'] = credential
  if (params['flow']) node['flow'] = params['flow']
  const sni = params['sni'] || params['peer']
  const security = params['security']
  if (security === 'reality' || security === 'tls' || sni) {
    node['tls'] = true
    if (sni) node['sni'] = sni
  }
  if (params['alpn']) node['alpn'] = params['alpn'].split(',').map((s) => s.trim())
  if (params['fp']) node['client-fingerprint'] = params['fp']
  const insecure = params['allowInsecure'] || params['skip-cert-verify']
  if (insecure === '1' || insecure === 'true') node['skip-cert-verify'] = true
  const net = params['type']
  if (net && net !== 'tcp') {
    const opts: Record<string, unknown> = {}
    if (params['host']) opts['headers'] = { Host: params['host'] }
    if (params['path']) opts['path'] = params['path']
    if (params['serviceName']) opts['serviceName'] = params['serviceName']
    if (net === 'ws') node['ws-opts'] = opts
    else if (net === 'grpc') {
      if (params['serviceName'])
        (opts as Record<string, string>)['grpc-service-name'] = params['serviceName']
      node['grpc-opts'] = opts
    }
  }
  return node
}

const parseHysteria2 = (raw: string): Record<string, unknown> | null => {
  const body = raw.slice(raw.indexOf('://') + 3)
  const hashIdx = body.indexOf('#')
  const name = parseName(hashIdx >= 0 ? body.slice(hashIdx + 1) : '', 'hy2-node')
  const main = hashIdx >= 0 ? body.slice(0, hashIdx) : body
  const queryIdx = main.indexOf('?')
  const authority = queryIdx >= 0 ? main.slice(0, queryIdx) : main
  const query = queryIdx >= 0 ? main.slice(queryIdx) : ''
  const atIdx = authority.indexOf('@')
  if (atIdx < 0) return null
  const credential = decodeURIComponent(authority.slice(0, atIdx))
  const hostport = authority.slice(atIdx + 1)
  const portMatch = hostport.match(/^(.+):(\d+)$/)
  if (!portMatch) return null
  const server = portMatch[1]
  const port = Number(portMatch[2])
  const params = parseQuery(query)
  const node: Record<string, unknown> = {
    name,
    type: 'hysteria2',
    server,
    port,
    password: credential,
  }
  if (params['sni']) node['sni'] = params['sni']
  const insecure = params['insecure'] || params['skip-cert-verify']
  if (insecure === '1' || insecure === 'true') node['skip-cert-verify'] = true
  if (params['obfs']) {
    node['obfs'] = {
      type: params['obfs'],
      [params['obfs-password'] ? 'password' : '_']: params['obfs-password'] || undefined,
    }
  }
  return node
}

const parseTuic = (raw: string): Record<string, unknown> | null => {
  const { base, name } = splitHash(raw.slice('tuic://'.length))
  const queryIdx = base.indexOf('?')
  const authority = queryIdx >= 0 ? base.slice(0, queryIdx) : base
  const query = queryIdx >= 0 ? base.slice(queryIdx) : ''
  const auth = splitAuthority(authority)
  if (!auth) return null
  const { credential, server, port } = auth
  const colonIdx = credential.indexOf(':')
  if (colonIdx < 0) return null
  const uuid = credential.slice(0, colonIdx)
  const password = credential.slice(colonIdx + 1)
  const params = parseQuery(query)
  const node: Record<string, unknown> = {
    name,
    type: 'tuic',
    server,
    port,
    uuid,
    password,
  }
  if (params['sni']) node['sni'] = String(params['sni'])
  const cc = params['congestion_control']
  if (cc) node['congestion-control'] = String(cc)
  const insecure = params['insecure'] || params['skip-cert-verify']
  if (insecure === '1' || insecure === 'true') node['skip-cert-verify'] = true
  if (params['alpn'])
    node['alpn'] = String(params['alpn'])
      .split(',')
      .map((s) => s.trim())
  return node
}

export const parseShareLink = (
  input: string,
): Record<string, unknown> | Record<string, unknown>[] | null => {
  const text = (input ?? '').trim()
  if (!text) return null
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const results: Record<string, unknown>[] = []
  for (const line of lines) {
    const lower = line.toLowerCase()
    let parsed: Record<string, unknown> | null = null
    if (lower.startsWith('ss://')) parsed = parseSs(line)
    else if (lower.startsWith('vmess://')) parsed = parseVmess(line)
    else if (lower.startsWith('vless://')) parsed = parseVlessTrojan(line, 'vless')
    else if (lower.startsWith('trojan://')) parsed = parseVlessTrojan(line, 'trojan')
    else if (lower.startsWith('hysteria2://') || lower.startsWith('hy2://'))
      parsed = parseHysteria2(line)
    else if (lower.startsWith('tuic://')) parsed = parseTuic(line)
    if (parsed) results.push(parsed)
  }
  if (!results.length) return null
  if (results.length === 1 && lines.length === 1) return results[0]
  return results
}
