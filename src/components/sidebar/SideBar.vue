<template>
  <div
    ref="sidebarRef"
    class="sidebar border-base-300/30 bg-base-200 text-base-content scrollbar-hidden h-full overflow-x-hidden border-r p-2 transition-[width,padding] duration-320 ease-[cubic-bezier(0.34,0.1,0.2,1)]"
    :class="isSidebarCollapsed ? 'w-18 px-0' : 'w-64'"
    @transitionend="handleTransitionEnd"
  >
    <div :class="twMerge('flex h-full flex-col gap-2', isSidebarCollapsed ? 'w-18 px-0' : 'w-60')">
      <ul class="menu w-full flex-1">
        <li
          v-for="r in renderRoutes"
          :key="r"
          @mouseenter="(e) => mouseenterHandler(e, r)"
        >
          <a
            :class="[
              r === route.name ? 'menu-active' : '',
              isSidebarCollapsed && 'justify-center',
              'relative py-2',
            ]"
            @click.passive="() => router.push({ name: r })"
          >
            <component
              :is="ROUTE_ICON_MAP[r]"
              class="h-5 w-5"
            />
            <span
              v-if="isSidebarCollapsed && r === ROUTE_NAME.proxies && proxiesWarningCount > 0"
              class="bg-warning absolute top-1 right-2 h-2.5 w-2.5 rounded-full"
            />
            <template v-if="!isSidebarCollapsed">
              {{ $t(r) }}
              <span
                v-if="r === ROUTE_NAME.proxies && proxiesWarningCount > 0"
                class="bg-warning/18 text-warning ml-auto inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium"
              >
                {{ proxiesWarningCount }}
              </span>
            </template>
          </a>
        </li>
      </ul>
      <template v-if="isSidebarCollapsed">
        <VerticalInfos v-if="showStatisticsWhenSidebarCollapsed">
          <SidebarButtons vertical />
        </VerticalInfos>
        <SidebarButtons
          v-else
          vertical
        />
      </template>
      <template v-else>
        <OverviewCarousel />
        <CommonSidebar class="base-container" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import CommonSidebar from '@/components/sidebar/CommonCtrl.vue'
import { nodeGroupBuckets } from '@/composables/proxies'
import { ROUTE_ICON_MAP, ROUTE_NAME } from '@/constant'
import { isNodeGroup, renderRoutes } from '@/helper'
import { useTooltip } from '@/helper/tooltip'
import router from '@/router'
import { getCurrentProxyName, proxyMap } from '@/store/proxies'
import { isSidebarCollapsed, showStatisticsWhenSidebarCollapsed } from '@/store/settings'
import { twMerge } from 'tailwind-merge'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import OverviewCarousel from './OverviewCarousel.vue'
import SidebarButtons from './SidebarButtons.vue'
import VerticalInfos from './VerticalInfos.vue'

const emit = defineEmits<{
  transitionend: []
}>()

const sidebarRef = ref<HTMLDivElement>()
const { showTip } = useTooltip()
const { t } = useI18n()

const mouseenterHandler = (e: MouseEvent, r: string) => {
  if (!isSidebarCollapsed.value) return
  showTip(e, t(r), {
    placement: 'right',
  })
}

const route = useRoute()
const proxiesWarningCount = computed(() => {
  const allGroupNames = Object.keys(proxyMap.value).filter(
    (name) => proxyMap.value[name]?.all?.length,
  )
  const unavailableProxyGroupCount = allGroupNames.filter(
    (name) => !isNodeGroup(name) && !getCurrentProxyName(name),
  ).length
  const unavailableNodeGroupCount = nodeGroupBuckets.value.filter(({ groups }) =>
    groups.some((groupName) => !getCurrentProxyName(groupName)),
  ).length

  return unavailableProxyGroupCount + unavailableNodeGroupCount
})

const handleTransitionEnd = (e: TransitionEvent) => {
  if (e.target !== sidebarRef.value || e.propertyName !== 'width') return
  emit('transitionend')
}
</script>
