import { NOT_CONNECTED, PROXY_CHAIN_DIRECTION, PROXY_TYPE, ROUTE_NAME } from '@/constant'
import { showNotification } from '@/helper/notification'
import { timeSaved } from '@/store/overview'
import { hiddenGroupMap, proxyMap } from '@/store/proxies'
import {
  customThemes,
  lowLatency,
  mediumLatency,
  proxyChainDirection,
  splitOverviewPage,
} from '@/store/settings'
import type { Connection } from '@/types'
import dayjs from 'dayjs'
import * as ipaddr from 'ipaddr.js'
import { head } from 'lodash'
import { computed } from 'vue'
import { prettyBytesHelper } from './utils'

export const isProxyGroup = (name: string) => {
  const proxyNode = proxyMap.value[name]

  if (!proxyNode) {
    return false
  }

  if (proxyNode.all?.length) {
    return true
  }

  return [
    PROXY_TYPE.Dns,
    PROXY_TYPE.Compatible,
    PROXY_TYPE.Direct,
    PROXY_TYPE.Reject,
    PROXY_TYPE.RejectDrop,
    PROXY_TYPE.Pass,
    PROXY_TYPE.Fallback,
    PROXY_TYPE.URLTest,
    PROXY_TYPE.LoadBalance,
    PROXY_TYPE.Selector,
    PROXY_TYPE.Smart,
  ].includes(proxyNode.type.toLowerCase() as PROXY_TYPE)
}

export const NODE_GROUP_BUCKET_ORDER = [
  '香港',
  '台湾',
  '日本',
  '新加坡',
  '美国',
  '韩国',
  '德国',
  '英国',
  '荷兰',
  '芬兰',
  '冷门',
  '兜底策略',
]

const NODE_GROUP_BUCKET_RULES = [
  { label: '香港', patterns: [/香港/, /\bhk\b/, /hong\s*kong/] },
  { label: '台湾', patterns: [/台湾/, /\btw\b/, /taiwan/] },
  { label: '日本', patterns: [/日本/, /\bjp\b/, /\bjpn\b/, /japan/] },
  { label: '新加坡', patterns: [/新加坡/, /\bsg\b/, /\bsgp\b/, /singapore/] },
  { label: '美国', patterns: [/美国/, /\bus\b/, /\busa\b/, /united\s*states/, /america/] },
  { label: '韩国', patterns: [/韩国/, /\bkr\b/, /\bkor\b/, /korea/] },
  { label: '德国', patterns: [/德国/, /\bde\b/, /germany/] },
  { label: '英国', patterns: [/英国/, /\buk\b/, /\bgb\b/, /britain/, /united\s*kingdom/] },
  { label: '荷兰', patterns: [/荷兰/, /\bnl\b/, /netherlands/] },
  { label: '芬兰', patterns: [/芬兰/, /\bfi\b/, /finland/] },
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

export const isNodeGroup = (name: string) => {
  const proxyNode = proxyMap.value[name]

  if (!proxyNode?.all?.length) {
    return false
  }

  const normalizedName = name.trim().toLowerCase()
  const strategyGroupPatterns = [
    /global/,
    /proxy/,
    /ai/,
    /direct/,
    /telegram/,
    /youtube/,
    /netflix/,
    /tiktok/,
    /instagram/,
    /^x$/,
    /github/,
    /steam/,
    /apple/,
    /全球/,
    /加速/,
    /专线/,
    /直连/,
    /代理/,
    /兜底/,
  ]

  if (hasNodeGroupBucketName(name)) {
    return true
  }

  if (strategyGroupPatterns.some((pattern) => pattern.test(normalizedName))) {
    return false
  }

  const children = proxyNode.all.filter((child) => child !== name)
  const childGroups = children.filter((child) => isProxyGroup(child))
  const childNodes = children.filter((child) => proxyMap.value[child] && !isProxyGroup(child))

  // Region/pool groups usually contain mostly nodes, sometimes with one auto-test subgroup.
  return childNodes.length > 0 && childNodes.length >= childGroups.length
}

export const getHostFromConnection = (connection: Connection) => {
  const port = connection.metadata.destinationPort
  const host =
    connection.metadata.host || connection.metadata.sniffHost || connection.metadata.destinationIP

  if (host.includes(':')) {
    return `[${host}]:${port}`
  }
  return `${host}:${port}`
}

export const getProcessFromConnection = (connection: Connection) => {
  return (
    connection.metadata.process ||
    connection.metadata.processPath.replace(/^.*[/\\](.*)$/, '$1') ||
    '-'
  )
}

export const getDestinationFromConnection = (connection: Connection) => {
  const finalProxyType = proxyMap.value[head(connection.chains) || '']?.type.toLowerCase()

  if (finalProxyType === PROXY_TYPE.Direct && connection.metadata.remoteDestination) {
    return connection.metadata.remoteDestination
  }

  return connection.metadata.destinationIP || connection.metadata.host
}

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
  const chains = [...connection.chains]

  if (proxyChainDirection.value === PROXY_CHAIN_DIRECTION.NORMAL) {
    chains.reverse()
  }

  return chains.join('')
}

export const getNetworkTypeFromConnection = (connection: Connection) => {
  return `${connection.metadata.type} | ${connection.metadata.network}`
}

export const getInboundUserFromConnection = (connection: Connection) => {
  return (
    connection.metadata.inboundUser ||
    connection.metadata.inboundName ||
    connection.metadata.inboundPort ||
    '-'
  )
}

export const getToolTipForParams = (
  params: ToolTipParams,
  config: {
    suffix: string
    binary: boolean
  },
) => {
  const { suffix = '', binary = false } = config

  // fake data
  if (params.data.name < timeSaved + 1) {
    return ``
  }
  return `
    <div class="flex items-center my-2 gap-1">
      <div class="w-4 h-4 rounded-full" style="background-color: ${params.color}"></div>
      ${params.seriesName}
      (${dayjs(params.data.name).format('HH:mm:ss')}): ${prettyBytesHelper(params.data.value, {
        binary: binary,
      })}${suffix}
    </div>`
}

export const getColorForLatency = (latency: number) => {
  if (latency === NOT_CONNECTED) {
    return ''
  } else if (latency < lowLatency.value) {
    return 'text-green-500'
  } else if (latency < mediumLatency.value) {
    return 'text-yellow-500'
  } else {
    return 'text-red-500'
  }
}

export const renderRoutes = computed(() => {
  return Object.values(ROUTE_NAME).filter((r) => {
    return ![ROUTE_NAME.setup, !splitOverviewPage.value && ROUTE_NAME.overview].includes(r)
  })
})

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

export const handlerUpgradeSuccess = () => {
  showNotification({
    content: 'upgradeSuccess',
    type: 'alert-success',
  })
}
