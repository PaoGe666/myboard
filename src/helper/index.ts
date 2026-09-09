import { connectionAccessor } from '@/assembly/connections'
import { hiddenGroupMap, proxyMap } from '@/assembly/proxies'
import { NOT_CONNECTED, PROXY_CHAIN_DIRECTION, PROXY_TYPE, ROUTE_NAME } from '@/constant'
import { showNotification } from '@/helper/notification'
import {
  customCSS,
  customThemes,
  lowLatency,
  mediumLatency,
  proxyChainDirection,
  splitOverviewPage,
} from '@/store/settings'
import type { Connection } from '@/types'
import * as ipaddr from 'ipaddr.js'
import { computed } from 'vue'

const PROXY_GROUP_TYPES = new Set<string>(Object.values(PROXY_TYPE))

export const isProxyGroup = (name: string) => {
  const proxyNode = proxyMap.value[name]

  if (!proxyNode) {
    return false
  }

  if (proxyNode.all?.length) {
    return true
  }

  return PROXY_GROUP_TYPES.has(proxyNode.type.toLowerCase())
}

// 以下 getConnectionXxx 均委托给 assembly 层「按当前后端动态选用」的访问器,
// view / store 直接读取这些 view 友好的派生值,无需感知后端差异。
export const getConnectionChains = (connection: Connection) =>
  connectionAccessor().chains(connection)

export const getConnectionDownload = (connection: Connection) =>
  connectionAccessor().download(connection)

export const getConnectionUpload = (connection: Connection) =>
  connectionAccessor().upload(connection)

export const getConnectionStart = (connection: Connection) => connectionAccessor().start(connection)

export const getConnectionRule = (connection: Connection) => connectionAccessor().rule(connection)

export const getConnectionRulePayload = (connection: Connection) =>
  connectionAccessor().rulePayload(connection)

export const getConnectionSourceIP = (connection: Connection) =>
  connectionAccessor().sourceIP(connection)

export const getConnectionSourcePort = (connection: Connection) =>
  connectionAccessor().sourcePort(connection)

export const getConnectionNetwork = (connection: Connection) =>
  connectionAccessor().network(connection)

export const getConnectionSmartBlock = (connection: Connection) =>
  connectionAccessor().smartBlock(connection)

export const getConnectionHostname = (connection: Connection) =>
  connectionAccessor().hostname(connection)

export const getHostFromConnection = (connection: Connection) =>
  connectionAccessor().host(connection)

export const getProcessFromConnection = (connection: Connection) =>
  connectionAccessor().process(connection)

export const getDestinationFromConnection = (connection: Connection) =>
  connectionAccessor().destination(connection)

export const getNetworkTypeFromConnection = (connection: Connection) =>
  connectionAccessor().networkType(connection)

export const getInboundUserFromConnection = (connection: Connection) =>
  connectionAccessor().inboundUser(connection)

export const getDestinationTypeFromConnection = (connection: Connection) => {
  const destination = getDestinationFromConnection(connection)

  if (ipaddr.IPv4.isIPv4(destination)) {
    return 'IPv4'
  } else if (ipaddr.IPv6.isIPv6(destination)) {
    return 'IPv6'
  } else {
    return 'FQDN'
  }
}

export const getChainsStringFromConnection = (connection: Connection) => {
  const chains = [...getConnectionChains(connection)]

  if (proxyChainDirection.value === PROXY_CHAIN_DIRECTION.NORMAL) {
    chains.reverse()
  }

  return chains.join('')
}

export const getColorForLatency = (latency: number) => {
  if (latency === NOT_CONNECTED) {
    return ''
  } else if (latency < lowLatency.value) {
    return 'text-low-latency'
  } else if (latency < mediumLatency.value) {
    return 'text-medium-latency'
  } else {
    return 'text-high-latency'
  }
}

export const renderRoutes = computed(() =>
  Object.values(ROUTE_NAME).filter((r) => {
    if (r === ROUTE_NAME.setup) return false
    if (!splitOverviewPage.value && r === ROUTE_NAME.overview) return false
    return true
  }),
)

export const applyCustomThemes = () => {
  document.querySelectorAll('.custom-theme').forEach((style) => {
    style.remove()
  })
  customThemes.value.forEach((theme) => {
    const style = document.createElement('style')
    const styleString = Object.entries(theme)
      .filter(([key]) => !['prefersdark', 'default', 'name', 'type', 'id'].includes(key))
      .map(([key, value]) => `${key}:${value}`)
      .join(';')

    style.innerHTML = `[data-theme="${theme.name}"] {
      ${styleString} 
    }`

    style.className = `custom-theme ${theme.name}`
    document.head.appendChild(style)
  })
}

export const applyCustomCSS = () => {
  const styleId = 'custom-css'
  const css = customCSS.value.trim()
  let style = document.getElementById(styleId)

  if (!css) {
    style?.remove()
    return
  }

  if (!style) {
    style = document.createElement('style')
    style.id = styleId
    document.head.appendChild(style)
  }

  style.textContent = css
}

export const applyKsuTheme = () => {
  if (window.ksu) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://mui.kernelsu.org/internal/colors.css'
    document.head.appendChild(link)
  }
}

export const isHiddenGroup = (group: string) => {
  if (Reflect.has(hiddenGroupMap.value, group)) {
    return hiddenGroupMap.value[group]
  }

  return proxyMap.value[group]?.hidden
}

export const handlerUpgradeSuccess = (key?: string) => {
  showNotification({
    key,
    content: 'upgradeSuccess',
    type: 'alert-success',
  })
}

// ---- myboard 定制: 节点组 / 地区分桶 / 策略组模式 ----

export const NODE_GROUP_BUCKET_ORDER = [
  '香港',
  '台湾',
  '日本',
  '新加坡',
  '马来西亚',
  '美国',
  '韩国',
  '德国',
  '英国',
  '荷兰',
  '芬兰',
  '自建',
  '冷门',
  '兜底策略',
]

const NODE_GROUP_BUCKET_RULES = [
  { label: '香港', patterns: [/香港/, /\bhk\b/, /hong\s*kong/] },
  { label: '台湾', patterns: [/台湾/, /\btw\b/, /taiwan/] },
  { label: '日本', patterns: [/日本/, /\bjp\b/, /\bjpn\b/, /japan/] },
  { label: '新加坡', patterns: [/新加坡/, /\bsg\b/, /\bsgp\b/, /singapore/] },
  { label: '马来西亚', patterns: [/马来西亚/, /malaysia/, /\bmy\b/, /\bmys\b/] },
  { label: '美国', patterns: [/美国/, /\bus\b/, /\busa\b/, /united\s*states/, /america/] },
  { label: '韩国', patterns: [/韩国/, /\bkr\b/, /\bkor\b/, /korea/] },
  { label: '德国', patterns: [/德国/, /\bde\b/, /germany/] },
  { label: '英国', patterns: [/英国/, /\buk\b/, /\bgb\b/, /britain/, /united\s*kingdom/] },
  { label: '荷兰', patterns: [/荷兰/, /\bnl\b/, /netherlands/] },
  { label: '芬兰', patterns: [/芬兰/, /\bfi\b/, /finland/] },
  {
    label: '自建',
    patterns: [
      /自建/,
      /\bgcp\b/,
      /google\s*cloud/,
      /\baws\b/,
      /amazon\s*web\s*services/,
      /oracle/,
      /\bazure\b/,
    ],
  },
  { label: '冷门', patterns: [/冷门/] },
  { label: '兜底策略', patterns: [/^全球加速$/, /^globe$/, /^global$/] },
]

export const getNodeGroupBucketName = (name: string) => {
  const normalizedName = name.trim().toLowerCase()

  const matchedRule = NODE_GROUP_BUCKET_RULES.find(({ patterns }) =>
    patterns.some((pattern) => pattern.test(normalizedName)),
  )

  return matchedRule?.label || name
}

export const hasNodeGroupBucketName = (name: string) => {
  return getNodeGroupBucketName(name) !== name || NODE_GROUP_BUCKET_ORDER.includes(name.trim())
}

export const isExcludedProxyGroup = (name: string) => {
  const normalizedName = name.trim().toLowerCase()

  return (
    ((/\bgcp\b/.test(normalizedName) || /google\s*cloud/.test(normalizedName)) &&
      /兜底/.test(normalizedName)) ||
    ((/\bgcp\b/.test(normalizedName) || /google\s*cloud/.test(normalizedName)) &&
      /fallback/.test(normalizedName))
  )
}

export const getDirectProxyGroupMode = (name: string): 'auto' | 'manual' => {
  const normalizedName = name.trim().toLowerCase()

  if (/自动|auto/.test(normalizedName)) {
    return 'auto'
  }

  if (/手动|manual/.test(normalizedName)) {
    return 'manual'
  }

  const groupType = proxyMap.value[name]?.type?.toLowerCase()

  return [
    PROXY_TYPE.Fallback,
    PROXY_TYPE.URLTest,
    PROXY_TYPE.LoadBalance,
    PROXY_TYPE.Smart,
  ].includes(groupType as PROXY_TYPE)
    ? 'auto'
    : 'manual'
}

export const hasProxyGroupMode = (
  groupName: string,
  mode: 'auto' | 'manual',
  visited = new Set<string>(),
): boolean => {
  if (!groupName || visited.has(groupName)) {
    return false
  }

  visited.add(groupName)

  if (getDirectProxyGroupMode(groupName) === mode) {
    return true
  }

  const children = proxyMap.value[groupName]?.all ?? []

  return children.some((childName) => {
    if (!isProxyGroup(childName) || childName === groupName) {
      return false
    }

    return hasProxyGroupMode(childName, mode, new Set(visited))
  })
}

export const collectProxyGroupsByMode = (
  groupName: string,
  mode: 'auto' | 'manual',
  visited = new Set<string>(),
): string[] => {
  if (!groupName || visited.has(groupName)) {
    return []
  }

  visited.add(groupName)

  const currentMode = getDirectProxyGroupMode(groupName)
  if (currentMode === mode) {
    return [groupName]
  }

  const children = proxyMap.value[groupName]?.all ?? []

  return children.flatMap((childName) => {
    if (!isProxyGroup(childName) || childName === groupName) {
      return []
    }

    return collectProxyGroupsByMode(childName, mode, new Set(visited))
  })
}

export const isNodeGroup = (name: string) => {
  const proxyNode = proxyMap.value[name]

  if (!proxyNode?.all?.length) {
    return false
  }

  if (isExcludedProxyGroup(name)) {
    return false
  }

  const normalizedName = name.trim().toLowerCase()
  const nonNodeGroupOverridePatterns = [/optimi[sz]e/, /优化/]

  if (nonNodeGroupOverridePatterns.some((pattern) => pattern.test(normalizedName))) {
    return false
  }

  if (hasNodeGroupBucketName(name)) {
    return true
  }

  const children = proxyNode.all.filter((child) => child !== name)
  const childGroups = children.filter((child) => isProxyGroup(child))
  const childNodes = children.filter((child) => proxyMap.value[child] && !isProxyGroup(child))

  return childNodes.length > 0 && childNodes.length >= childGroups.length
}
