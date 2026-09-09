import { configs } from '@/assembly/config'
import {
  getProxyGroupChains,
  getProxyProviderName,
  proxiesTabShow,
  proxyGroupList,
  proxyMap,
  proxyProviederList,
} from '@/assembly/proxies'
import { GLOBAL, PROXY_TAB_TYPE, PROXY_TYPE } from '@/constant'
import {
  getNodeGroupBucketName,
  isExcludedProxyGroup,
  isHiddenGroup,
  isNodeGroup,
  NODE_GROUP_BUCKET_ORDER,
} from '@/helper'
import { displayGlobalByMode, manageHiddenGroup } from '@/store/settings'
import { isEmpty } from 'lodash'
import { computed, ref } from 'vue'
import {
  isProxyNodeSearchMode,
  matchProxySearchKeyword,
  proxyGroupContainsMatchingNode,
  proxyProviderContainsMatchingNode,
  proxySearchKeyword,
} from './proxySearch'

const filterProxyGroups = (groups: string[], respectHiddenGroups = true) => {
  if (!proxySearchKeyword.value) {
    if (!respectHiddenGroups || manageHiddenGroup.value) {
      return groups
    }

    return groups.filter((name) => !isHiddenGroup(name))
  }

  const matchesGroup = isProxyNodeSearchMode.value
    ? proxyGroupContainsMatchingNode
    : (name: string) => matchProxySearchKeyword(name)

  return groups.filter(matchesGroup)
}

const getAllGroups = () => {
  if (isEmpty(proxyMap.value)) {
    return []
  }

  const allGroups = displayGlobalByMode.value
    ? configs.value?.mode.toUpperCase() === GLOBAL
      ? [GLOBAL]
      : proxyGroupList.value
    : [...proxyGroupList.value, GLOBAL]

  return allGroups.filter((name) => !isExcludedProxyGroup(name))
}

const getRenderProxyGroups = () => {
  if (isEmpty(proxyMap.value)) {
    return []
  }

  if (displayGlobalByMode.value) {
    if (configs.value?.mode.toUpperCase() === GLOBAL) {
      return filterProxyGroups(getProxyGroupChains(GLOBAL), false)
    }

    return filterProxyGroups(proxyGroupList.value)
  }

  const globalGroups = proxyMap.value[GLOBAL] ? [GLOBAL] : []
  return filterProxyGroups([...proxyGroupList.value, ...globalGroups])
}

const getRenderProxyProviders = () => {
  const names = proxyProviederList.value.map((provider) => provider.name)

  if (!proxySearchKeyword.value) {
    return names
  }

  const matches = isProxyNodeSearchMode.value
    ? proxyProviderContainsMatchingNode
    : (name: string) => matchProxySearchKeyword(name)

  return names.filter(matches)
}

const getRenderGroups = () => {
  if (isEmpty(proxyMap.value)) {
    return []
  }

  const allGroups = getAllGroups()

  if (proxiesTabShow.value === PROXY_TAB_TYPE.NODE_GROUPS) {
    return filterProxyGroups(allGroups.filter((name) => isNodeGroup(name)))
  }

  if (proxiesTabShow.value === PROXY_TAB_TYPE.PROXIES) {
    return filterProxyGroups(allGroups.filter((name) => !isNodeGroup(name)))
  }

  return filterProxyGroups(allGroups)
}

// 代理提供商页签下的二级子菜单: 订阅 / 自定义节点
export type ProviderSubTab = 'subscription' | 'custom'
export const providerSubTab = ref<ProviderSubTab>('subscription')

// 系统/虚拟/分组类型的集合(用于识别"真正的自定义节点")
const GROUP_OR_SYSTEM_TYPES = new Set<string>(Object.values(PROXY_TYPE))

/*
 * 自定义节点 = 配置里顶层 proxies: 手写的节点。
 * 特征: 不是分组(无 all 或 type 非分组)、不属于任何订阅(无 provider-name)、
 * type 是真实节点类型(ss/vmess/trojan...),且不是系统节点(DIRECT/REJECT 等)。
 */
export const customNodeNames = computed(() => {
  return Object.keys(proxyMap.value)
    .filter((name) => {
      const node = proxyMap.value[name]
      if (!node) return false
      if (node.all?.length) return false
      const type = node.type?.toLowerCase()
      if (type && GROUP_OR_SYSTEM_TYPES.has(type)) return false
      if (getProxyProviderName(name)) return false
      return true
    })
    .sort((a, b) => a.localeCompare(b))
})

// 自定义节点编辑器对话框状态(null = 新增模式)
export const customNodeEditorOpen = ref(false)
export const customNodeEditorTarget = ref<Record<string, unknown> | null>(null)

export const openCustomNodeEditor = (node?: Record<string, unknown> | null) => {
  customNodeEditorTarget.value = node ?? null
  customNodeEditorOpen.value = true
}

export const closeCustomNodeEditor = () => {
  customNodeEditorOpen.value = false
  customNodeEditorTarget.value = null
}

// 批量测速中「正在测」的自定义节点集合
const _testingNodeNames = ref(new Set<string>())
export const testingNodeNames = computed(() => _testingNodeNames.value)
export const markNodeTesting = (name: string, on: boolean) => {
  const next = new Set(_testingNodeNames.value)
  if (on) next.add(name)
  else next.delete(name)
  _testingNodeNames.value = next
}

export const nodeGroupBuckets = computed(() => {
  const buckets = new Map<string, string[]>()

  for (const name of getAllGroups().filter((groupName) => isNodeGroup(groupName))) {
    const bucketName = getNodeGroupBucketName(name)
    const current = buckets.get(bucketName) || []
    current.push(name)
    buckets.set(bucketName, current)
  }

  return Array.from(buckets.entries())
    .map(([name, groups]) => ({
      name,
      groups,
    }))
    .sort((prev, next) => {
      const prevIndex = NODE_GROUP_BUCKET_ORDER.indexOf(prev.name)
      const nextIndex = NODE_GROUP_BUCKET_ORDER.indexOf(next.name)

      if (prevIndex === -1 && nextIndex === -1) {
        return prev.name.localeCompare(next.name, 'zh-CN')
      }

      if (prevIndex === -1) {
        return 1
      }

      if (nextIndex === -1) {
        return -1
      }

      return prevIndex - nextIndex
    })
})

export const disableProxiesPageScroll = ref(false)
export const isProxiesPageMounted = ref(false)

export const renderGroups = computed(() => {
  if (proxiesTabShow.value === PROXY_TAB_TYPE.NODE_GROUPS) {
    return nodeGroupBuckets.value.map((bucket) => bucket.name)
  }

  return getRenderGroups()
})

export const renderProxyGroups = computed(() =>
  getRenderProxyGroups().filter((name) => !isNodeGroup(name)),
)

export const renderProxyProviders = computed(getRenderProxyProviders)

export const renderProxiesPageItems = computed(() => {
  if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER) {
    return renderProxyProviders.value
  }

  if (proxiesTabShow.value === PROXY_TAB_TYPE.NODE_GROUPS) {
    return renderGroups.value
  }

  return renderProxyGroups.value
})
