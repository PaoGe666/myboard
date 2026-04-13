<template>
  <CollapseCard :name="bucketKey">
    <template v-slot:title>
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <span class="font-medium">{{ name }}</span>
          <span class="text-base-content/60 text-xs tabular-nums">· {{ groups.length }}</span>
        </div>
        <div
          v-if="currentPaths.length"
          class="text-base-content/70 flex flex-col gap-1 text-xs"
        >
          <div>当前路径</div>
          <div
            v-for="path in currentPaths"
            :key="path.label"
            class="flex flex-wrap items-center gap-1"
          >
            <span class="bg-base-300/70 rounded px-1.5 py-0.5 font-medium">
              {{ path.label }}
            </span>
            <span>-></span>
            <span class="text-base-content/90">{{ path.route }}</span>
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
        />
      </div>
    </template>
  </CollapseCard>
</template>

<script setup lang="ts">
import { nodeGroupBuckets } from '@/composables/proxies'
import { getNowProxyNodeName, getProxyGroupChains } from '@/store/proxies'
import { computed } from 'vue'
import CollapseCard from '../common/CollapseCard.vue'
import ProxyGroup from './ProxyGroup.vue'

const props = defineProps<{
  name: string
}>()

const bucket = computed(() => nodeGroupBuckets.value.find((item) => item.name === props.name))
const groups = computed(() => bucket.value?.groups || [])
const bucketKey = computed(() => `node-bucket:${props.name}`)
const currentPaths = computed(() => {
  const primaryGroup = groups.value.find((groupName) => groupName === props.name)
  const targetGroups = primaryGroup ? [primaryGroup] : groups.value

  return targetGroups.map((groupName) => {
    const chains = getProxyGroupChains(groupName)
    const finalNode = getNowProxyNodeName(groupName)
    const routeItems = [...chains, finalNode].filter(
      (item, index, all) => index === 0 || item !== all[index - 1],
    )
    const route = routeItems.slice(1).join(' -> ') || finalNode

    return {
      label: groupName,
      route,
    }
  })
})
</script>
