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
        <ProxyGroup
          v-for="groupName in groups"
          :key="groupName"
          :name="groupName"
          :force-open="true"
          :show-warning="false"
        />
      </div>
    </template>
  </CollapseCard>
</template>

<script setup lang="ts">
import { nodeGroupBuckets } from '@/composables/proxies'
import { getCurrentProxyName, getNowProxyNodeName, getProxyGroupChains } from '@/store/proxies'
import { ExclamationTriangleIcon, XCircleIcon } from '@heroicons/vue/24/outline'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CollapseCard from '../common/CollapseCard.vue'
import ProxyGroup from './ProxyGroup.vue'

const props = defineProps<{
  name: string
}>()

const bucket = computed(() => nodeGroupBuckets.value.find((item) => item.name === props.name))
const groups = computed(() => bucket.value?.groups || [])
const bucketKey = computed(() => `node-bucket:${props.name}`)
const { t } = useI18n()
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
  const primaryGroup = groups.value.find((groupName) => groupName === props.name)
  const targetGroups = primaryGroup ? [primaryGroup] : groups.value

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
