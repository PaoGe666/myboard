import { isSingBox } from '@/api'
import { GLOBAL, PROXY_TAB_TYPE } from '@/constant'
import {
  getNodeGroupBucketName,
  isExcludedProxyGroup,
  isHiddenGroup,
  isNodeGroup,
  NODE_GROUP_BUCKET_ORDER,
} from '@/helper'
import { configs } from '@/store/config'
import {
  getProxyGroupChains,
  proxiesTabShow,
  proxyGroupList,
  proxyMap,
  proxyProviederList,
} from '@/store/proxies'
import { groupsInActiveFolder, isProxyFolderModeActive } from '@/store/proxyFolders'
import { customGlobalNode, displayGlobalByMode, manageHiddenGroup } from '@/store/settings'
import { isEmpty } from 'lodash'
import { computed, ref } from 'vue'
import {
  isProxyNodeSearchMode,
  matchProxySearchKeyword,
  proxyGroupContainsMatchingNode,
  proxyProviderContainsMatchingNode,
  proxySearchKeyword,
} from './proxySearch'

const filterGroups = (all: string[]) => {
  if (manageHiddenGroup.value) {
    return all
  }

  if (isEmpty(proxyMap.value)) {
    return []
  }

  if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER) {
    return proxyProviederList.value.map((group) => group.name)
  }

  const allGroups = getAllGroups()

  if (proxiesTabShow.value === PROXY_TAB_TYPE.NODE_GROUPS) {
    return filterGroups(allGroups.filter((name) => isNodeGroup(name)))
  }

  if (proxiesTabShow.value === PROXY_TAB_TYPE.PROXIES) {
    return filterGroups(allGroups.filter((name) => !isNodeGroup(name)))
  }

  return filterGroups(allGroups)
}

const getAllGroups = () => {
  if (isEmpty(proxyMap.value)) {
    return []
  }

  const allGroups = displayGlobalByMode.value
    ? configs.value?.mode.toUpperCase() === GLOBAL
      ? [
          isSingBox.value && proxyMap.value[customGlobalNode.value]
            ? customGlobalNode.value
            : GLOBAL,
        ]
      : proxyGroupList.value
    : [...proxyGroupList.value, GLOBAL]

  return allGroups.filter((name) => !isExcludedProxyGroup(name))
}

const getRenderGroups = () => {
  if (isEmpty(proxyMap.value)) {
    return []
  }

  if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER) {
    return proxyProviederList.value.map((group) => group.name)
  }

  const allGroups = getAllGroups()

  if (proxiesTabShow.value === PROXY_TAB_TYPE.NODE_GROUPS) {
    return filterGroups(allGroups.filter((name) => isNodeGroup(name)))
  }

  if (proxiesTabShow.value === PROXY_TAB_TYPE.PROXIES) {
    return filterGroups(allGroups.filter((name) => !isNodeGroup(name)))
  }

  return filterGroups(allGroups)
}

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

const getRenderProxyProviders = () => {
  const names = proxyProviederList.value.map((provider) => provider.name)
  if (!proxySearchKeyword.value) return names
  const matches = isProxyNodeSearchMode.value
    ? proxyProviderContainsMatchingNode
    : (name: string) => matchProxySearchKeyword(name)
  return names.filter(matches)
}

const limitInitialRender = (names: string[]) => {
  if (isProxiesPageMounted.value) return names
  return names.slice(0, 16)
}

const getRenderProxyGroups = () => {
  if (displayGlobalByMode.value) {
    if (configs.value?.mode.toUpperCase() === GLOBAL) {
      const globalName =
        isSingBox.value && proxyMap.value[customGlobalNode.value] ? customGlobalNode.value : GLOBAL
      return filterProxyGroups(getProxyGroupChains(globalName), false)
    }
    return filterProxyGroups(proxyGroupList.value)
  }
  return filterProxyGroups([...proxyGroupList.value, GLOBAL])
}

export const nodeGroupBuckets = computed(() => {
  const buckets = new Map<string, string[]>()

  for (const name of filterGroups(getAllGroups().filter((groupName) => isNodeGroup(groupName)))) {
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
  const groups =
    proxiesTabShow.value === PROXY_TAB_TYPE.NODE_GROUPS
      ? nodeGroupBuckets.value.map((bucket) => bucket.name)
      : getRenderGroups()
  return groups
})

export const renderProxyGroups = computed(() => {
  return limitInitialRender(getRenderProxyGroups())
})

export const renderProxyProviders = computed(() => {
  return limitInitialRender(getRenderProxyProviders())
})

export const renderProxiesPageItems = computed(() => {
  if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER) {
    return renderProxyProviders.value
  }
  const groups = renderProxyGroups.value
  if (!isProxyFolderModeActive.value) return groups
  const filter = groupsInActiveFolder.value
  if (!filter) return groups
  return groups.filter((name) => filter.has(name))
})
