<template>
  <CollapseCard :name="bucketKey">
    <template v-slot:title>
      <div
        :class="[
          'flex flex-col gap-1',
          statusVariant === 'partial' &&
            'bg-warning/8 border-warning/30 -mx-2 rounded-xl border px-2 py-2',
          statusVariant === 'full' &&
            'bg-error/8 border-error/30 -mx-2 rounded-xl border px-2 py-2',
        ]"
      >
        <div class="flex items-center gap-2">
          <span class="font-medium">{{ name }}</span>
          <span class="text-base-content/60 text-xs tabular-nums">· {{ groups.length }}</span>
          <ExclamationTriangleIcon
            v-if="statusVariant === 'partial'"
            class="text-warning h-4 w-4 shrink-0"
          />
          <XCircleIcon
            v-else-if="statusVariant === 'full'"
            class="text-error h-4 w-4 shrink-0"
          />
          <span
            v-if="unavailableCount > 0"
            :class="[
              'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
              statusVariant === 'full' ? 'bg-error/15 text-error' : 'bg-warning/18 text-warning',
            ]"
          >
            {{
              statusVariant === 'full'
                ? t('noAvailableProxy')
                : t('unavailableGroupCount', { count: unavailableCount.toString() })
            }}
          </span>
        </div>
        <div
          v-if="currentPaths.length"
          :class="[
            'flex flex-col gap-1 text-xs',
            statusVariant === 'full' ? 'text-error/80' : 'text-base-content/70',
          ]"
        >
          <div>当前路径</div>
          <div
            v-for="path in currentPaths"
            :key="path.label"
            class="flex flex-wrap items-center gap-1"
          >
            <span
              :class="[
                'rounded px-1.5 py-0.5 font-medium',
                path.route === t('noAvailableProxy') ? 'bg-error/12 text-error' : 'bg-base-300/70',
              ]"
            >
              {{ path.label }}
            </span>
            <span>-></span>
            <span
              :class="
                path.route === t('noAvailableProxy')
                  ? 'text-error font-medium'
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
          class="tabs-box tabs tabs-xs self-start"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            class="tab gap-1"
            :class="activeTypeTab === 'auto' && 'tab-active'"
            @click="activeTypeTab = 'auto'"
          >
            {{ $t('auto') }}
            <span class="text-[10px] opacity-70">{{ autoGroups.length }}</span>
          </button>
          <button
            type="button"
            role="tab"
            class="tab gap-1"
            :class="activeTypeTab === 'manual' && 'tab-active'"
            @click="activeTypeTab = 'manual'"
          >
            {{ $t('manual') }}
            <span class="text-[10px] opacity-70">{{ manualGroups.length }}</span>
          </button>
        </div>
        <template v-if="activeTypeTab === 'auto'">
          <div
            v-if="!autoSections.length"
            class="text-base-content/50 bg-base-200/50 rounded-xl px-3 py-6 text-center text-sm"
          >
            {{ $t('noData') }}
          </div>
          <div
            v-for="section in autoSections"
            :key="section.groupName"
            class="flex flex-col gap-2"
          >
            <div
              v-if="showAutoSectionLabel"
              class="text-base-content/60 px-1 text-xs font-medium"
            >
              {{ section.groupName }}
            </div>
            <template v-if="section.currentProxyName">
              <ProxiesContent
                :readonly="true"
                :name="section.groupName"
                :now="section.currentProxyName"
                :render-proxies="[section.currentProxyName]"
              />
            </template>
            <div
              v-else
              class="text-base-content/50 bg-base-200/50 rounded-xl px-3 py-6 text-center text-sm"
            >
              {{ $t('noAvailableProxy') }}
            </div>
          </div>
        </template>
        <template v-else>
          <div
            v-if="!manualSections.length"
            class="text-base-content/50 bg-base-200/50 rounded-xl px-3 py-6 text-center text-sm"
          >
            {{ $t('noData') }}
          </div>
          <div
            v-for="section in manualSections"
            :key="section.groupName"
            class="flex flex-col gap-2"
          >
            <div
              v-if="showManualSectionLabel"
              class="text-base-content/60 px-1 text-xs font-medium"
            >
              {{ section.groupName }}
            </div>
            <Component
              :is="groupProxiesByProvider ? ProxiesByProvider : ProxiesContent"
              v-if="section.leafNodes.length"
              :name="section.groupName"
              :now="section.currentProxyName"
              :render-proxies="section.leafNodes"
            />
            <ProxyGroup
              v-else
              :name="section.groupName"
              :mode-filter="'manual'"
              :show-warning="false"
            />
          </div>
        </template>
      </div>
    </template>
  </CollapseCard>
</template>

<script setup lang="ts">
import { nodeGroupBuckets } from '@/composables/proxies'
import { getRenderProxies } from '@/composables/renderProxies'
import {
  collectProxyGroupsByMode,
  getDirectProxyGroupMode,
  getNodeGroupBucketName,
  isProxyGroup,
} from '@/helper'
import {
  getCurrentProxyName,
  getNowProxyNodeName,
  getProxyGroupChains,
  proxyGroupList,
  proxyMap,
} from '@/store/proxies'
import { ExclamationTriangleIcon, XCircleIcon } from '@heroicons/vue/24/outline'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CollapseCard from '../common/CollapseCard.vue'
import ProxiesContent from './ProxiesContent.vue'
import ProxiesByProvider from './ProxiesByProvider.vue'
import ProxyGroup from './ProxyGroup.vue'
import { groupProxiesByProvider } from '@/store/settings'
import '@/composables/autoOptimize'

const props = defineProps<{
  name: string
}>()

const bucket = computed(() => nodeGroupBuckets.value.find((item) => item.name === props.name))
const groups = computed(() => bucket.value?.groups || [])
const bucketKey = computed(() => `node-bucket:${props.name}`)
const { t } = useI18n()
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
const belongsToActiveBucket = (name: string) => {
  const bucketName = getNodeGroupBucketName(name)

  if (bucketName === props.name) {
    return true
  }

  return bucketName === name
}
const collectOrderedGroupsByMode = (mode: 'auto' | 'manual') => {
  const result: string[] = []
  const seen = new Set<string>()

  orderedGroups.value.forEach((groupName) => {
    collectProxyGroupsByMode(groupName, mode).forEach((matchedGroupName) => {
      if (!belongsToActiveBucket(matchedGroupName) || seen.has(matchedGroupName)) {
        return
      }

      seen.add(matchedGroupName)
      result.push(matchedGroupName)
    })
  })

  return result
}
const autoGroups = computed(() => collectOrderedGroupsByMode('auto'))
const manualGroups = computed(() => collectOrderedGroupsByMode('manual'))
const preferredTypeTab = computed<'auto' | 'manual'>(() => {
  const primaryGroup = orderedGroups.value[0]

  if (!primaryGroup) {
    return 'auto'
  }

  return getDirectProxyGroupMode(primaryGroup)
})
const activeTypeTab = ref<'auto' | 'manual'>(preferredTypeTab.value)
const visibleGroups = computed(() => {
  return activeTypeTab.value === 'auto' ? autoGroups.value : manualGroups.value
})
const collectSectionsByMode = (
  mode: 'auto' | 'manual',
  groupName: string,
  visited = new Set<string>(),
): { groupName: string; leafNodes: string[]; currentProxyName: string }[] => {
  if (!groupName || visited.has(groupName)) {
    return []
  }

  visited.add(groupName)

  const renderProxies = getRenderProxies(proxyMap.value[groupName]?.all ?? [], groupName, mode)
  const leafNodes = renderProxies.filter(
    (proxyName) => !isProxyGroup(proxyName) && belongsToActiveBucket(proxyName),
  )
  const childGroups = renderProxies.filter(
    (proxyName) => isProxyGroup(proxyName) && belongsToActiveBucket(proxyName),
  )
  const sections: { groupName: string; leafNodes: string[]; currentProxyName: string }[] = []

  if (leafNodes.length) {
    const currentProxyName = getNowProxyNodeName(groupName)

    sections.push({
      groupName,
      leafNodes,
      currentProxyName: leafNodes.includes(currentProxyName) ? currentProxyName : '',
    })
  }

  const childSections = childGroups.flatMap((childGroupName) =>
    collectSectionsByMode(mode, childGroupName, new Set(visited)),
  )

  if (childSections.length) {
    sections.push(...childSections)
  }

  if (sections.length) {
    return sections
  }

  return belongsToActiveBucket(groupName)
    ? [
        {
          groupName,
          leafNodes: [],
          currentProxyName: getCurrentProxyName(groupName),
        },
      ]
    : []
}
type Section = { groupName: string; leafNodes: string[]; currentProxyName: string }
const sectionsByMode = (mode: 'auto' | 'manual') => {
  const groups = mode === 'auto' ? autoGroups.value : manualGroups.value
  const result: Section[] = []
  const seen = new Set<string>()

  groups.forEach((groupName) => {
    collectSectionsByMode(mode, groupName).forEach((section) => {
      if (seen.has(section.groupName)) {
        return
      }

      seen.add(section.groupName)
      result.push(section)
    })
  })

  return result
}
const manualSections = computed(() => sectionsByMode('manual'))
const autoSections = computed(() => sectionsByMode('auto'))
const showManualSectionLabel = computed(() => manualSections.value.length > 1)
const showAutoSectionLabel = computed(() => autoSections.value.length > 1)
watch(
  [autoGroups, manualGroups],
  ([nextAutoGroups, nextManualGroups]) => {
    if (!orderedGroups.value.length) {
      activeTypeTab.value = 'auto'
      return
    }

    if (activeTypeTab.value === 'auto' && !nextAutoGroups.length && nextManualGroups.length) {
      activeTypeTab.value = 'manual'
      return
    }

    if (activeTypeTab.value === 'manual' && !nextManualGroups.length && nextAutoGroups.length) {
      activeTypeTab.value = 'auto'
    }
  },
  { immediate: true },
)
const unavailableCount = computed(
  () => groups.value.filter((groupName) => !getCurrentProxyName(groupName)).length,
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
  const targetGroups = visibleGroups.value.length ? visibleGroups.value : orderedGroups.value

  return targetGroups.map((groupName) => {
    const chains = getProxyGroupChains(groupName)
    const finalNode = getNowProxyNodeName(groupName)
    const routeItems = [...chains, finalNode].filter(
      (item, index, all) => index === 0 || item !== all[index - 1],
    )
    const route = routeItems.slice(1).join(' -> ') || finalNode || t('noAvailableProxy')

    return {
      label: groupName,
      route,
    }
  })
})
</script>
