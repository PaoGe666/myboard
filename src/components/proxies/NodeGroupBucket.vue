<template>
  <CollapseCard :name="bucketKey">
    <template v-slot:title>
      <div
        :class="[
          'flex flex-col gap-1',
          statusVariant !== 'none' && 'border-warning/35 border-l-2 pl-2',
        ]"
      >
        <div class="flex items-center gap-2">
          <span class="font-medium">{{ name }}</span>
          <span class="text-base-content/60 text-xs tabular-nums">· {{ groups.length }}</span>
          <ExclamationTriangleIcon
            v-if="statusVariant === 'partial'"
            class="text-warning h-4 w-4 shrink-0"
          />
          <ExclamationTriangleIcon
            v-else-if="statusVariant === 'full'"
            class="text-warning/70 h-4 w-4 shrink-0"
          />
          <span
            v-if="unavailableCount > 0"
            :class="[
              'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
              'bg-warning/12 text-warning',
            ]"
          >
            {{
              statusVariant === 'full'
                ? t('noAvailableProxy')
                : t('unavailableGroupCount', { count: unavailableCount.toString() })
            }}
          </span>
          <button
            type="button"
            class="btn btn-circle btn-ghost btn-xs ml-auto"
            :title="t('testNodeGroup')"
            :disabled="isTesting"
            @click.stop="testBucket"
          >
            <BoltIcon :class="['h-3.5 w-3.5', isTesting && 'animate-pulse']" />
          </button>
        </div>
        <div
          v-if="currentPaths.length"
          :class="[
            'flex flex-col gap-1 text-xs',
            statusVariant === 'full' ? 'text-base-content/55' : 'text-base-content/70',
          ]"
        >
          <div>当前路径</div>
          <div
            v-for="path in currentPaths"
            :key="path.label"
            class="flex flex-wrap items-center gap-1"
          >
            <span :class="['rounded px-1.5 py-0.5 font-medium', 'bg-base-300/70']">
              {{ path.label }}
            </span>
            <span>-></span>
            <span
              :class="
                path.route === t('noAvailableProxy')
                  ? 'text-base-content/45'
                  : 'text-base-content/90'
              "
            >
              {{ path.route }}
            </span>
          </div>
        </div>
      </div>
    </template>
    <template v-slot:content>
      <div class="flex flex-col gap-3">
        <div
          v-if="!sections.length"
          class="text-base-content/50 bg-base-200/50 rounded-xl px-3 py-6 text-center text-sm"
        >
          {{ $t('noData') }}
        </div>
        <div
          v-for="section in sections"
          :key="section.selectionGroupName"
          class="flex flex-col gap-2"
        >
          <div
            v-if="showSectionLabel"
            class="text-base-content/60 px-1 text-xs font-medium"
          >
            {{ section.groupName }}
          </div>
          <Component
            :is="groupProxiesByProvider ? ProxiesByProvider : ProxiesContent"
            v-if="section.proxies.length"
            :name="section.selectionGroupName"
            :activate-group-name="section.activateGroupName"
            :now="section.currentProxyName"
            :render-proxies="section.proxies"
          />
          <div
            v-else
            class="text-base-content/50 bg-base-200/50 rounded-xl px-3 py-6 text-center text-sm"
          >
            {{ $t('noData') }}
          </div>
        </div>
      </div>
    </template>
  </CollapseCard>
</template>

<script setup lang="ts">
import { nodeGroupBuckets } from '@/composables/proxies'
import { getRenderProxies } from '@/composables/renderProxies'
import { MYBOARD_MANUAL_GROUP_PREFIX } from '@/constant'
import { getNodeGroupBucketName, isProxyGroup } from '@/helper'
import {
  getCurrentProxyName,
  getProxyGroupChains,
  handlerProxySelect,
  proxyGroupList,
  proxyMap,
  proxyGroupLatencyTest,
} from '@/assembly/proxies'
import { BoltIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CollapseCard from '../common/CollapseCard.vue'
import ProxiesContent from './ProxiesContent.vue'
import ProxiesByProvider from './ProxiesByProvider.vue'
import { groupProxiesByProvider } from '@/store/settings'
import '@/composables/autoOptimize'

const props = defineProps<{
  name: string
}>()

const bucket = computed(() => nodeGroupBuckets.value.find((item) => item.name === props.name))
const groups = computed(() => bucket.value?.groups || [])
const bucketKey = computed(() => `node-bucket:${props.name}`)
const { t } = useI18n()
const isTesting = ref(false)
const testBucket = async () => {
  if (isTesting.value) return
  isTesting.value = true
  try {
    await Promise.allSettled(groups.value.map((groupName) => proxyGroupLatencyTest(groupName)))
  } finally {
    isTesting.value = false
  }
}
const directSelectedGroupMap = computed(() => {
  const selectedMap = new Map<string, number>()

  proxyGroupList.value.forEach((sourceGroupName) => {
    const selectedGroupName = getCurrentProxyName(sourceGroupName)

    if (!selectedGroupName) {
      return
    }

    selectedMap.set(selectedGroupName, (selectedMap.get(selectedGroupName) || 0) + 1)
  })

  return selectedMap
})
const groupUsageCountMap = computed(() => {
  const usageMap = new Map<string, number>()

  proxyGroupList.value.forEach((sourceGroupName) => {
    const chains = getProxyGroupChains(sourceGroupName)

    chains.slice(1).forEach((groupName) => {
      usageMap.set(groupName, (usageMap.get(groupName) || 0) + 1)
    })
  })

  return usageMap
})
const orderedGroups = computed(() => {
  return [...groups.value].sort((prev, next) => {
    const prevDirectSelected = directSelectedGroupMap.value.get(prev) || 0
    const nextDirectSelected = directSelectedGroupMap.value.get(next) || 0

    if (prevDirectSelected !== nextDirectSelected) {
      return nextDirectSelected - prevDirectSelected
    }

    const prevUsage = groupUsageCountMap.value.get(prev) || 0
    const nextUsage = groupUsageCountMap.value.get(next) || 0

    if (prevUsage !== nextUsage) {
      return nextUsage - prevUsage
    }

    const prevAvailable = getCurrentProxyName(prev) ? 1 : 0
    const nextAvailable = getCurrentProxyName(next) ? 1 : 0

    if (prevAvailable !== nextAvailable) {
      return nextAvailable - prevAvailable
    }

    return prev.localeCompare(next, 'zh-CN')
  })
})
const sections = computed(() =>
  orderedGroups.value.flatMap((groupName) => {
    const manualGroupName = `${MYBOARD_MANUAL_GROUP_PREFIX}${groupName}`
    const regularProxies = getRenderProxies(
      (proxyMap.value[groupName]?.all ?? []).filter(
        (name) =>
          !name.startsWith(MYBOARD_MANUAL_GROUP_PREFIX) &&
          (props.name === '兜底策略' || getNodeGroupBucketName(name) === props.name),
      ),
      groupName,
    )
    const manualProxies =
      props.name === '兜底策略'
        ? []
        : getRenderProxies(
            (proxyMap.value[manualGroupName]?.all ?? []).filter(
              (name) => !isProxyGroup(name) && getNodeGroupBucketName(name) === props.name,
            ),
            manualGroupName,
          ).filter((name) => !regularProxies.includes(name))
    const result = []

    if (regularProxies.length) {
      result.push({
        groupName,
        selectionGroupName: groupName,
        activateGroupName: undefined,
        currentProxyName: getCurrentProxyName(groupName),
        proxies: regularProxies,
      })
    }
    if (manualProxies.length) {
      result.push({
        groupName,
        selectionGroupName: manualGroupName,
        activateGroupName: groupName,
        currentProxyName: getCurrentProxyName(manualGroupName),
        proxies: manualProxies,
      })
    }

    return result
  }),
)
const showSectionLabel = computed(() => orderedGroups.value.length > 1)
const getEnabledRoute = (name: string, visited = new Set<string>()): string[] => {
  if (visited.has(name)) return []
  visited.add(name)

  const selected = getCurrentProxyName(name)
  if (!selected) return []
  if (!isProxyGroup(name)) return [name]

  const downstream = getEnabledRoute(selected, visited)
  return downstream.length ? [name, ...downstream] : []
}
const getVisibleRoute = (groupName: string) =>
  getEnabledRoute(groupName).filter((name) => !name.startsWith(MYBOARD_MANUAL_GROUP_PREFIX))
const hasMatchingCurrentNode = (groupName: string) => {
  const nodeName = getVisibleRoute(groupName).at(-1) ?? ''

  return (
    Boolean(nodeName) &&
    (props.name === '兜底策略' || getNodeGroupBucketName(nodeName) === props.name)
  )
}
const autoSelectingGroups = new Set<string>()
watch(
  sections,
  (nextSections) => {
    for (const groupName of orderedGroups.value) {
      if (hasMatchingCurrentNode(groupName) || autoSelectingGroups.has(groupName)) continue

      const section = nextSections.find(
        (item) => item.groupName === groupName && item.proxies.length > 0,
      )
      const firstNode = section?.proxies[0]
      if (!section || !firstNode) continue

      autoSelectingGroups.add(groupName)
      void (async () => {
        try {
          const selected = await handlerProxySelect(section.selectionGroupName, firstNode)
          if (selected && section.activateGroupName) {
            await handlerProxySelect(section.activateGroupName, section.selectionGroupName)
          }
        } finally {
          autoSelectingGroups.delete(groupName)
        }
      })()
    }
  },
  { immediate: true },
)
const unavailableCount = computed(
  () => groups.value.filter((groupName) => !hasMatchingCurrentNode(groupName)).length,
)
const availableCount = computed(() => groups.value.length - unavailableCount.value)
const statusVariant = computed<'none' | 'partial' | 'full'>(() => {
  if (unavailableCount.value === 0) {
    return 'none'
  }

  if (availableCount.value === 0) {
    return 'full'
  }

  return 'partial'
})
const currentPaths = computed(() => {
  const targetGroups = orderedGroups.value

  return targetGroups.map((groupName) => {
    if (!hasMatchingCurrentNode(groupName)) {
      return {
        label: groupName,
        route: t('noAvailableProxy'),
      }
    }

    const routeItems = getVisibleRoute(groupName)
    const route = routeItems.slice(1).join(' -> ') || t('noAvailableProxy')

    return {
      label: groupName,
      route,
    }
  })
})
</script>
