import { NOT_CONNECTED, PROXY_SORT_TYPE } from '@/constant'
import { getDirectProxyGroupMode, hasProxyGroupMode, isProxyGroup } from '@/helper'
import { getLatencyByName, isProxyEnabled, proxiesFilter } from '@/store/proxies'
import {
  hideUnavailableProxies,
  proxyGroupFilterMap,
  proxySortType,
  useSmartGroupSort,
} from '@/store/settings'
import { smartOrderMap } from '@/store/smart'
import { computed, type ComputedRef } from 'vue'
import { isProxyNodeSearchMode, matchProxySearchKeyword, proxySearchKeyword } from './proxySearch'

export function useRenderProxies(
  proxies: ComputedRef<string[]>,
  proxyGroup?: string,
  modeFilter?: 'auto' | 'manual',
) {
  const renderProxies = computed(() => {
    return getRenderProxies(proxies.value, proxyGroup, modeFilter)
  })
  const proxiesCount = computed(() => {
    const available = renderProxies.value.filter(
      (proxy) => getLatencyByName(proxy, proxyGroup) !== NOT_CONNECTED,
    ).length
    return `${available}/${proxies.value.length}`
  })
  return { renderProxies, proxiesCount }
}

export function useRenderProxyList(proxies: ComputedRef<string[]>, groupName?: string) {
  const renderProxies = computed(() => getRenderProxies(proxies.value, groupName))

  const proxiesCount = computed(() => {
    const available = renderProxies.value.filter(
      (proxy) => getLatencyByName(proxy, groupName) !== NOT_CONNECTED,
    ).length
    return `${available}/${proxies.value.length}`
  })

  return { renderProxies, proxiesCount }
}

export const getRenderProxies = (
  proxies: string[],
  groupName?: string,
  modeFilter?: 'auto' | 'manual',
) => {
  const latencyMap = new Map<string, number>()
  for (const name of proxies) {
    latencyMap.set(name, getLatencyByName(name, groupName))
  }
  const filtered = filterProxies(proxies, groupName, latencyMap, modeFilter)
  return sortProxies(filtered, groupName, latencyMap)
}

const filterProxies = (
  proxies: string[],
  groupName: string | undefined,
  latencyMap: Map<string, number>,
  modeFilter?: 'auto' | 'manual',
) => {
  let result = proxies

  proxies = proxies.filter((name) => isProxyGroup(name) || isProxyEnabled(name))

  if (modeFilter) {
    proxies = proxies.filter((name) => {
      if (isProxyGroup(name)) {
        return hasProxyGroupMode(name, modeFilter)
      }

      return groupName ? getDirectProxyGroupMode(groupName) === modeFilter : true
    })
  }

  if (hideUnavailableProxies.value) {
    result = result.filter((name) => isProxyGroup(name) || latencyMap.get(name)! > NOT_CONNECTED)
  }

  if (proxiesFilter.value) {
    const filters = proxiesFilter.value.split(' ').map((f) => f.toLowerCase().trim())
    proxies = proxies.filter((name) => {
      name = name.toLowerCase()
      return filters.every((f) => name.includes(f))
    })
  }
  if (isProxyNodeSearchMode.value && proxySearchKeyword.value) {
    const keyword = proxySearchKeyword.value
    result = result.filter((name) => matchProxySearchKeyword(name, keyword))
  }

  const groupKeyword = groupName ? proxyGroupFilterMap.value[groupName] : ''
  if (groupKeyword) {
    result = result.filter((name) => matchProxySearchKeyword(name, groupKeyword))
  }

  return result
}

const sortProxies = (
  proxies: string[],
  groupName: string | undefined,
  latencyMap: Map<string, number>,
) => {
  if (groupName && useSmartGroupSort.value && smartOrderMap.value[groupName]) {
    return sortBySmartOrder(proxies, smartOrderMap.value[groupName])
  }

  if (proxySortType.value === PROXY_SORT_TYPE.DEFAULT) {
    return proxies
  }

  const groups: string[] = []
  const nodes: string[] = []
  proxies.forEach((proxy) => {
    ;(isProxyGroup(proxy) ? groups : nodes).push(proxy)
  })

  const sortFunc = getSortFunc(proxySortType.value, latencyMap)
  return groups.concat(nodes.sort(sortFunc))
}

const sortBySmartOrder = (proxies: string[], orderMap: Record<string, number>) => {
  return [...proxies].sort((a, b) => {
    const ia = orderMap[a] ?? Number.MAX_SAFE_INTEGER
    const ib = orderMap[b] ?? Number.MAX_SAFE_INTEGER
    return ia - ib
  })
}

const getSortFunc = (sortType: PROXY_SORT_TYPE, latencyMap: Map<string, number>) => {
  const latencyFor = (name: string) => {
    const latency = latencyMap.get(name)!
    return latency === 0 ? Infinity : latency
  }
  switch (sortType) {
    case PROXY_SORT_TYPE.NAME_ASC:
      return (a: string, b: string) => a.localeCompare(b)
    case PROXY_SORT_TYPE.NAME_DESC:
      return (a: string, b: string) => b.localeCompare(a)
    case PROXY_SORT_TYPE.LATENCY_ASC:
      return (a: string, b: string) => latencyFor(a) - latencyFor(b)
    case PROXY_SORT_TYPE.LATENCY_DESC:
      return (a: string, b: string) => latencyFor(b) - latencyFor(a)
  }
}
