import { isSingBox } from '@/api'
import { GLOBAL, PROXY_TAB_TYPE } from '@/constant'
import {
  getNodeGroupBucketName,
  isHiddenGroup,
  isNodeGroup,
  NODE_GROUP_BUCKET_ORDER,
} from '@/helper'
import { configs } from '@/store/config'
import { proxiesTabShow, proxyGroupList, proxyMap, proxyProviederList } from '@/store/proxies'
import { customGlobalNode, displayGlobalByMode, manageHiddenGroup } from '@/store/settings'
import { isEmpty } from 'lodash'
import { computed, ref } from 'vue'

const filterGroups = (all: string[]) => {
  if (manageHiddenGroup.value) {
    return all
  }

  return all.filter((name) => !isHiddenGroup(name))
}

const getAllGroups = () => {
  if (isEmpty(proxyMap.value)) {
    return []
  }

  return displayGlobalByMode.value
    ? configs.value?.mode.toUpperCase() === GLOBAL
      ? [
          isSingBox.value && proxyMap.value[customGlobalNode.value]
            ? customGlobalNode.value
            : GLOBAL,
        ]
      : proxyGroupList.value
    : [...proxyGroupList.value, GLOBAL]
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

  if (isProxiesPageMounted.value) {
    return groups
  }

  return groups.slice(0, 16)
})
