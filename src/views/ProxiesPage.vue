<template>
  <div
    class="relative flex size-full overflow-hidden"
    :class="[disableProxiesPageTextSelect ? 'select-none' : '']"
  >
    <div
      class="max-md:scrollbar-hidden relative h-full min-w-0 flex-1"
      :class="disableProxiesPageScroll ? 'overflow-y-hidden' : 'overflow-y-scroll'"
      :style="padding"
      ref="proxiesRef"
      @scroll.passive="handleScroll"
    >
      <ProxiesCtrl />
      <div
        v-if="proxiesTabShow === PROXY_TAB_TYPE.PROVIDER"
        class="flex items-center gap-2 px-3 pt-3 md:pr-2"
      >
        <SegmentedControl
          :model-value="providerSubTab"
          @update:model-value="setProviderSubTab"
          :options="providerSubTabOptions"
        />
        <button
          class="btn btn-circle btn-sm"
          :title="providerSubTab === 'subscription' ? $t('addProvider') : $t('addCustomNode')"
          @click="handlerClickAdd"
        >
          <PlusIcon class="h-4 w-4" />
        </button>
        <button
          v-if="providerSubTab === 'custom'"
          class="btn btn-circle btn-sm"
          :title="$t('testAllCustomNodes')"
          @click="handlerTestCustomNodes"
        >
          <BoltIcon :class="['h-4 w-4', isTestingCustomNodes && 'animate-pulse']" />
        </button>
        <button
          class="btn btn-circle btn-sm"
          :title="$t('speedTest')"
          @click="speedTestOpen = true"
        >
          <SignalIcon class="h-4 w-4" />
        </button>
      </div>
      <DialogWrapper
        v-if="speedTestOpen"
        v-model="speedTestOpen"
        :title="$t('speedTest')"
      >
        <SpeedTestDialog />
      </DialogWrapper>
      <DialogWrapper
        v-if="providerSubTab === 'subscription' && providerFormOpen"
        v-model="providerFormOpen"
        :title="$t('addProvider')"
      >
        <div class="flex flex-col gap-3 p-2 text-sm">
          <label class="setting-item">
            <span class="setting-item-label">{{ $t('providerName') }}</span>
            <TextInput
              v-model="providerFormName"
              clearable
            />
          </label>
          <label class="setting-item">
            <span class="setting-item-label">{{ $t('providerUrl') }}</span>
            <TextInput
              v-model="providerFormUrl"
              clearable
              placeholder="https://..."
            />
          </label>
          <div class="text-base-content/60 text-xs">{{ $t('addProviderHint') }}</div>
          <button
            class="btn btn-primary btn-sm"
            :disabled="providerFormSubmitting"
            @click="handlerSaveProvider"
          >
            <span
              v-if="providerFormSubmitting"
              class="loading loading-spinner loading-sm"
            ></span>
            {{ $t('add') }}
          </button>
        </div>
      </DialogWrapper>
      <DialogWrapper
        v-if="customNodeEditorOpen"
        v-model="customNodeEditorOpen"
        :title="customNodeEditorTarget ? $t('editCustomNode') : $t('addCustomNode')"
      >
        <CustomNodeEditor
          :initial="customNodeEditorTarget"
          @save="handlerSaveCustomNode"
          @cancel="closeCustomNodeEditor"
        />
      </DialogWrapper>
      <div
        ref="columnsRef"
        class="flex gap-3 p-3 md:pr-2"
      >
        <VirtualColumn
          v-for="(items, idx) in columns"
          :key="`${cardVariant}-${idx}`"
          ref="columnRefs"
          class="min-w-0 flex-1"
          :data="items"
          :scroll-element="proxiesRef"
          :scroll-margin="scrollMargin"
          :estimate-size="estimatedCardHeight"
          :size-cache-key="cardVariant"
        >
          <template v-slot="{ item }: { item: string }">
            <component
              :is="renderComponent"
              :name="item"
            />
          </template>
        </VirtualColumn>
      </div>
    </div>
    <ProxyGroupChainModal />
  </div>
</template>

<script setup lang="ts">
import VirtualColumn from '@/components/common/VirtualColumn.vue'
import ProxiesCtrl from '@/components/controls/ProxiesCtrl'
import NodeGroupBucket from '@/components/proxies/NodeGroupBucket.vue'
import ProxyGroup from '@/components/proxies/ProxyGroup.vue'
import ProxyGroupForMobile from '@/components/proxies/ProxyGroupForMobile.vue'
import CustomNodeCard from '@/components/proxies/CustomNodeCard.vue'
import CustomNodeEditor from '@/components/proxies/CustomNodeEditor.vue'
import ProxyProvider from '@/components/proxies/ProxyProvider.vue'
import ProxyGroupChainModal from '@/components/proxies/ProxyGroupChainModal.vue'
import SpeedTestDialog from '@/components/proxies/SpeedTestDialog.vue'
import DialogWrapper from '@/components/common/DialogWrapper.vue'
import SegmentedControl from '@/components/common/SegmentedControl.vue'
import TextInput from '@/components/common/TextInput.vue'
import { usePaddingForViews } from '@/composables/paddingViews'
import {
  closeCustomNodeEditor,
  customNodeEditorOpen,
  customNodeEditorTarget,
  customNodeNames,
  disableProxiesPageScroll,
  openCustomNodeEditor,
  providerSubTab,
  renderProxiesPageItems,
} from '@/composables/proxies'
import { PROXY_TAB_TYPE } from '@/constant'
import { isMiddleScreen } from '@/helper/utils'
import { fetchProxies, proxyLatencyTest } from '@/assembly/proxies'
import { proxiesTabShow } from '@/assembly/proxies'
import { callNodeCgi } from '@/helper/nodeCgi'
import { callProviderCgi } from '@/helper/providerCgi'
import { notifyRequestError } from '@/helper/requestError'
import { showNotification } from '@/helper/notification'
import { BoltIcon, PlusIcon, SignalIcon } from '@heroicons/vue/24/outline'
import { disableProxiesPageTextSelect, twoColumnProxyGroup } from '@/store/settings'
import { useResizeObserver, useSessionStorage } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const speedTestOpen = ref(false)
const isTestingCustomNodes = ref(false)
const handlerTestCustomNodes = async () => {
  if (isTestingCustomNodes.value) return
  isTestingCustomNodes.value = true
  const names = customNodeNames.value
  try {
    await Promise.allSettled(names.map((name) => proxyLatencyTest(name, undefined, 5000)))
  } finally {
    isTestingCustomNodes.value = false
  }
}
const setProviderSubTab = (value: string) => {
  providerSubTab.value = value as 'subscription' | 'custom'
}
const providerSubTabOptions = computed(() => [
  {
    value: 'subscription',
    label: t('subscription'),
    count: renderProxiesPageItems.value.length,
  },
  { value: 'custom', label: t('customNodes'), count: customNodeNames.value.length },
])

// 订阅添加表单(与自定义节点共用右侧 +,按子页签切换)
const providerFormOpen = ref(false)
const providerFormName = ref('')
const providerFormUrl = ref('')
const providerFormSubmitting = ref(false)

const handlerClickAdd = () => {
  if (providerSubTab.value === 'subscription') {
    providerFormOpen.value = true
  } else {
    openCustomNodeEditor()
  }
}

const handlerSaveProvider = async () => {
  if (providerFormSubmitting.value) return
  if (!providerFormName.value.trim() || !providerFormUrl.value.trim()) {
    showNotification({ content: 'addProviderRequireFields', type: 'alert-error' })
    return
  }
  providerFormSubmitting.value = true
  try {
    const res = await callProviderCgi(
      'add',
      providerFormName.value.trim(),
      providerFormUrl.value.trim(),
    )
    if (!res.ok) throw new Error(res.error || 'cgi failed')
    providerFormOpen.value = false
    providerFormName.value = ''
    providerFormUrl.value = ''
    await fetchProxies()
    showNotification({ content: 'addProviderSuccess', type: 'alert-success' })
  } catch (e) {
    notifyRequestError(e)
  } finally {
    providerFormSubmitting.value = false
  }
}

const handlerSaveCustomNode = async (node: Record<string, unknown>) => {
  const action =
    customNodeEditorTarget.value && customNodeEditorTarget.value['name'] ? 'update' : 'add'
  try {
    const res = await callNodeCgi(action, node['name'] as string, node)
    if (!res.ok) throw new Error(res.error || 'save failed')
    showNotification({
      content: action === 'add' ? 'addProviderSuccess' : 'updateNodeSuccess',
      type: 'alert-success',
    })
    closeCustomNodeEditor()
    await fetchProxies()
  } catch (e) {
    notifyRequestError(e)
  }
}

const { padding } = usePaddingForViews({
  offsetTop: 0,
  offsetBottom: 0,
})
const renderPageItems = computed(() => {
  if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER && providerSubTab.value === 'custom') {
    return customNodeNames.value
  }
  return renderProxiesPageItems.value
})
const proxiesRef = ref<HTMLElement | null>(null)

type ScrollAnchor = {
  item: string
  offset: number
  scrollTop: number
}
type SavedScrollPosition = ScrollAnchor | number
type VirtualColumnRef = {
  scrollToItem: (name: string) => boolean
  correctScrollBy: (delta: number) => void
}

const scrollStatus = useSessionStorage<Record<PROXY_TAB_TYPE, SavedScrollPosition>>(
  'cache/proxies-scroll-status',
  {
    [PROXY_TAB_TYPE.PROVIDER]: 0,
    [PROXY_TAB_TYPE.PROXIES]: 0,
    [PROXY_TAB_TYPE.NODE_GROUPS]: 0,
  },
)
const columnRefs = ref<VirtualColumnRef[]>([])
let saveFrame = 0

const handleScroll = () => {
  if (!proxiesRef.value) return

  if (!restoringScroll && !saveFrame) {
    const tab = proxiesTabShow.value

    saveFrame = requestAnimationFrame(() => {
      saveFrame = 0
      saveScrollPosition(tab)
    })
  }
  syncScrollMargin()
}

/*
 * 卡片列上面还有控制栏(桌面端 sticky,占着流内高度)和文件夹栏,虚拟列表得知道
 * 自己从滚动内容的哪个位置开始,否则算出来的可视区会整体偏移一个控制栏的高度。
 *
 * 滚动容器是 relative,列的 offsetParent 就是它,offsetTop 直接就是这个偏移;
 * 它只在控制栏高度 / 内边距变化时才会变,所以跟着滚动、resize 和几个布局开关同步就够了。
 */
const columnsRef = ref<HTMLElement | null>(null)
const scrollMargin = ref(0)
const syncScrollMargin = () => {
  scrollMargin.value = columnsRef.value?.offsetTop ?? 0
}

/*
 * scrollTop 在虚拟列表里不是稳定坐标:锚点前面的卡片从估算高度换成实测高度时,同一个
 * scrollTop 会指向别的内容。这里为两个代理标签分别保存「视口顶部的卡片 + 卡片相对视口
 * 的偏移」,恢复时先让所属虚拟列挂载该卡片,再用真实 DOM 位置瞬时校准。
 *
 * 恢复期间忽略 scroll 事件,否则旧列表被新列表替换时产生的那一下滚动会覆盖新标签保存的
 * 锚点。旧版本存下来的数字仍作为一次性的兼容回退；锚点不存在时也用 scrollTop 尽量恢复。
 */
const SCROLL_RESTORE_TIMEOUT = 1000
let restoreFrame = 0
let restoreToken = 0
let restoringScroll = false

const findAnchorElement = (item?: string) => {
  const renderedItems = columnsRef.value?.querySelectorAll<HTMLElement>('[data-proxy-page-item]')

  if (!renderedItems) return null

  if (item !== undefined) {
    return [...renderedItems].find((element) => element.dataset.proxyPageItem === item) ?? null
  }

  const viewportTop = proxiesRef.value?.getBoundingClientRect().top ?? 0
  let anchor: HTMLElement | null = null
  let anchorTop = Infinity

  for (const element of renderedItems) {
    const rect = element.getBoundingClientRect()

    if (rect.bottom <= viewportTop || rect.top >= anchorTop) continue

    anchor = element
    anchorTop = rect.top
  }

  return anchor
}

const saveScrollPosition = (tab = proxiesTabShow.value) => {
  if (!proxiesRef.value || restoringScroll) return

  const anchor = findAnchorElement()

  scrollStatus.value[tab] = anchor
    ? {
        item: anchor.dataset.proxyPageItem!,
        offset: anchor.getBoundingClientRect().top - proxiesRef.value.getBoundingClientRect().top,
        scrollTop: proxiesRef.value.scrollTop,
      }
    : proxiesRef.value.scrollTop
}

const restoreScrollPosition = (tab = proxiesTabShow.value) => {
  const token = ++restoreToken
  const saved = scrollStatus.value[tab]
  const fallbackTop = Math.max(0, Number(typeof saved === 'number' ? saved : saved?.scrollTop) || 0)
  const startTime = performance.now()
  let stableFrames = 0
  let anchorColumn: VirtualColumnRef | undefined

  cancelAnimationFrame(restoreFrame)
  restoringScroll = true

  const restoreWhenReady = () => {
    if (token !== restoreToken) return

    const proxiesEl = proxiesRef.value

    if (!proxiesEl) return

    const isTimedOut = performance.now() - startTime >= SCROLL_RESTORE_TIMEOUT

    if (typeof saved !== 'number' && saved?.item) {
      anchorColumn ??= columnRefs.value.find((column) => column.scrollToItem(saved.item))

      const anchor = findAnchorElement(saved.item)

      if (anchor) {
        const currentOffset =
          anchor.getBoundingClientRect().top - proxiesEl.getBoundingClientRect().top
        const delta = currentOffset - saved.offset

        if (Math.abs(delta) > 1) {
          anchorColumn?.correctScrollBy(delta)
          stableFrames = 0
        } else {
          stableFrames++
        }

        if (stableFrames >= 3 || isTimedOut) {
          finishRestore()

          return
        }
      }

      if (!isTimedOut) {
        restoreFrame = requestAnimationFrame(restoreWhenReady)

        return
      }
    }

    // 兼容旧的纯数字记录,也处理锚点已被过滤或删除的情况。
    proxiesEl.scrollTop = Math.min(
      fallbackTop,
      Math.max(0, proxiesEl.scrollHeight - proxiesEl.clientHeight),
    )
    finishRestore()
  }

  const finishRestore = () => {
    restoreFrame = 0
    restoringScroll = false
    syncScrollMargin()
  }

  restoreFrame = requestAnimationFrame(restoreWhenReady)
}

watch(proxiesTabShow, (tab, previousTab) => {
  cancelAnimationFrame(saveFrame)
  saveFrame = 0
  saveScrollPosition(previousTab)

  nextTick(() => restoreScrollPosition(tab))
})

onMounted(() => {
  nextTick(() => {
    syncScrollMargin()
    restoreScrollPosition()
  })
  setTimeout(() => {
    fetchProxies()
  })
})

onBeforeUnmount(() => {
  cancelAnimationFrame(saveFrame)
  saveFrame = 0
  saveScrollPosition()
  restoreToken++
  cancelAnimationFrame(restoreFrame)
})

const cardType = computed(() => {
  if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER) {
    return providerSubTab.value === 'custom' ? ('custom' as const) : ('provider' as const)
  }

  if (proxiesTabShow.value === PROXY_TAB_TYPE.NODE_GROUPS) {
    return 'nodeGroup' as const
  }

  if (isMiddleScreen.value && displayTwoColumns.value) {
    return 'mobile' as const
  }

  return 'group' as const
})

const renderComponent = computed(() => {
  if (cardType.value === 'provider') {
    return ProxyProvider
  }

  if (cardType.value === 'custom') {
    return CustomNodeCard
  }

  if (cardType.value === 'nodeGroup') {
    return NodeGroupBucket
  }

  if (cardType.value === 'mobile') {
    return ProxyGroupForMobile
  }

  return ProxyGroup
})

// 三种卡片折叠态的高度不同,估算高度与量到的高度缓存都按形态分开
const cardVariant = computed(() => `${cardType.value}:${displayTwoColumns.value ? 2 : 1}`)
const estimatedCardHeight = computed(() => {
  if (cardType.value === 'mobile') return 88
  if (cardType.value === 'nodeGroup') return 300
  if (cardType.value === 'custom') return 64
  return 112
})

const displayTwoColumns = computed(() => {
  if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER && isMiddleScreen.value) {
    return false
  }
  return twoColumnProxyGroup.value && renderPageItems.value.length > 1
})

const filterContent: <T>(all: T[], target: number) => T[] = (all, target) => {
  return all.filter((_, index: number) => index % 2 === target)
}

// 双列不是 masonry,还是按 index % 2 分成两条独立的列,各自一个 virtualizer 共用页面的滚动条
const columns = computed(() =>
  displayTwoColumns.value
    ? [filterContent(renderPageItems.value, 0), filterContent(renderPageItems.value, 1)]
    : [renderPageItems.value],
)

useResizeObserver(proxiesRef, syncScrollMargin)
watch([displayTwoColumns, isMiddleScreen], () => nextTick(syncScrollMargin))
</script>
