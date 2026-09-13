import { providerCgiBase } from '@/store/settings'

export type NodeCgiResult = {
  ok: boolean
  result?: string
  error?: string
  node?: Record<string, unknown>
  group?: string
}

const buildNodeCgiUrl = () =>
  providerCgiBase.value ||
  `${window.location.protocol}//${window.location.hostname}/cgi-bin/myboard_node`

/*
 * 通过路由器 CGI(OpenClash)对自定义节点做 改/增/删(写 mihomo 配置)。
 * node 传 null 表示 delete。
 */
export const callNodeCgi = async (
  action: 'add' | 'update' | 'delete',
  name: string,
  node?: Record<string, unknown> | null,
): Promise<NodeCgiResult> => {
  const res = await fetch(buildNodeCgiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, name, node }),
  })

  return (await res.json()) as NodeCgiResult
}

export const getNodeConfig = async (name: string): Promise<Record<string, unknown>> => {
  const res = await fetch(buildNodeCgiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get', name }),
  })
  const result = (await res.json()) as NodeCgiResult

  if (!res.ok || !result.ok || !result.node) {
    throw new Error(result.error || '读取节点配置失败')
  }

  return result.group ? { ...result.node, __myboardGroupName: result.group } : result.node
}
