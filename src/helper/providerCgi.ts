import { providerCgiBase } from '@/store/settings'

export type ProviderCgiResult = {
  ok: boolean
  result?: string
  error?: string
}

const buildCgiUrl = (action: string, name: string, url: string) => {
  const base =
    providerCgiBase.value ||
    `${window.location.protocol}//${window.location.hostname}/cgi-bin/myboard_provider`
  const params = new URLSearchParams({ action, name })
  if (url) params.set('url', url)

  return `${base}?${params.toString()}`
}

/*
 * 在 OpenClash 上通过路由器 CGI 写配置文件来新增/删除订阅(不会在服务重启后旧配置复活)。
 * 非 OpenClash(无 CGI)时抛错,调用方回退到其余处理。
 */
export const callProviderCgi = async (
  action: 'add' | 'delete',
  name: string,
  url = '',
): Promise<ProviderCgiResult> => {
  const res = await fetch(buildCgiUrl(action, name, url))
  const json = (await res.json()) as ProviderCgiResult
  return json
}
