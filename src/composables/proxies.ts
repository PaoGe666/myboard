import { configs } from '@/assembly/config'
import {
  getProxyGroupChains,
  proxiesTabShow,
  proxyGroupList,
  proxyMap,
  proxyProviederList,
} from '@/assembly/proxies'
import { GLOBAL, PROXY_TAB_TYPE } from '@/constant'
import {
  getNodeGroupBucketName,
  isExcludedProxyGroup,
  isHiddenGroup,
  isNodeGroup,
  NODE_GROUP_BUCKET_ORDER,
} from '@/helper'
import { groupsInActiveFolder, isProxyFolderModeActive } from '@/store/proxyFolders'
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

  const groups = renderProxyGroups.value
  if (!isProxyFolderModeActive.value) return groups
  const filter = groupsInActiveFolder.value
  if (!filter) return groups
  return groups.filter((name) => filter.has(name))
})
