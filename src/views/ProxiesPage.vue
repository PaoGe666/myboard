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
          v-if="providerSubTab === 'subscription'"
          class="btn btn-circle btn-sm"
          :title="$t('testAllSubscriptions')"
          :aria-label="$t('testAllSubscriptions')"
          :disabled="isTestingSubscriptions || enabledSubscriptionProviders.length === 0"
          @click="handlerTestSubscriptions"
        >
          <span
            v-if="isTestingSubscriptions"
            class="loading loading-spinner loading-sm"
          ></span>
          <BoltIcon
            v-else
            class="h-4 w-4"
          />
        </button>
        <button
          v-if="providerSubTab === 'custom'"
          class="btn btn-circle btn-sm"
          :title="$t('testAllCustomNodes')"
          @click="handlerTestCustomNodes"
        >
          <BoltIcon :class="['h-4 w-4', isTestingCustomNodes && 'animate-pulse']" />
        </button>
      </div>
      <DialogWrapper
        v-if="providerFormOpen"
        v-model="providerFormOpen"
        :title="$t(subscriptionAddMode === 'custom' ? 'addCustomNode' : 'addProvider')"
      >
        <div class="flex flex-col gap-3 p-2 text-sm">
          <SegmentedControl
            :model-value="subscriptionAddMode"
            :options="addModeOptions"
            block
            @update:model-value="setAddMode"
          />
          <template v-if="subscriptionAddMode !== 'custom'">
            <label class="setting-item">
              <span class="setting-item-label">{{ $t('providerName') }}</span>
              <TextInput
                v-model="providerFormName"
                clearable
              />
            </label>
            <label
              v-if="subscriptionAddMode === 'url'"
              class="setting-item"
            >
              <span class="setting-item-label">{{ $t('providerUrl') }}</span>
              <TextInput
                v-model="providerFormUrl"
                clearable
                placeholder="https://..."
              />
            </label>
            <label
              v-else
              class="flex flex-col gap-2 text-sm font-medium"
            >
              {{ $t('vlessSubscriptionInput') }}
              <textarea
                v-model="providerFormBase64"
                class="textarea textarea-bordered min-h-32 w-full font-mono text-xs"
                :placeholder="$t('vlessSubscriptionInputPlaceholder')"
              />
            </label>
            <div
              v-if="subscriptionAddMode === 'url'"
              class="text-base-content/60 text-xs"
            >
              {{ $t('addProviderHint') }}
            </div>
            <div
              v-else-if="providerBase64Result.error"
              class="alert alert-error py-2 text-sm"
            >
              {{ $t(providerBase64Result.error) }}
            </div>
            <div
              v-else-if="providerBase64Result.links.length"
              class="text-sm"
            >
              {{ $t('vlessSubscriptionCount', { count: providerBase64Result.links.length }) }}
            </div>
            <button
              class="btn btn-primary btn-sm"
              :disabled="providerFormSubmitting || !canSaveSubscription"
              @click="handlerSaveProvider"
            >
              <span
                v-if="providerFormSubmitting"
                class="loading loading-spinner loading-sm"
              ></span>
              {{ subscriptionAddMode === 'url' ? $t('add') : $t('vlessSubscriptionCreate') }}
            </button>
          </template>
          <CustomNodeEditor
            v-else
            :show-title="false"
            :group-names="proxyGroupList"
            @save="handlerSaveCustomNode"
            @cancel="providerFormOpen = false"
          />
        </div>
      </DialogWrapper>
      <DialogWrapper
        v-if="customNodeEditorOpen"
        v-model="customNodeEditorOpen"
        :title="customNodeEditorTarget ? $t('editCustomNode') : $t('addCustomNode')"
      >
        <CustomNodeEditor
          :initial="customNodeEditorTarget"
          :group-names="proxyGroupList"
          :show-title="false"
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
  markNodeTesting,
  providerSubTab,
  renderProxiesPageItems,
} from '@/composables/proxies'
import { PROXY_TAB_TYPE } from '@/constant'
import { isMiddleScreen } from '@/helper/utils'
import {
  fetchProxies,
  proxyLatencyTest,
  proxyProviderHealthCheckAPI,
  proxyProviederList,
  proxiesTabShow,
  proxyGroupList,
  updateProxyProviderAPI,
} from '@/assembly/proxies'
import { callNodeCgi } from '@/helper/nodeCgi'
import { callLocalProviderCgi, callProviderCgi } from '@/helper/providerCgi'
import { parseShareLink } from '@/helper/shareLink'
import { notifyRequestError } from '@/helper/requestError'
import { showNotification } from '@/helper/notification'
import { BoltIcon, PlusIcon } from '@heroicons/vue/24/outline'
import {
  disableProxiesPageTextSelect,
  providerAutoUpdateInterval,
  providerAutoUpdateIntervals,
  providerEnabledMap,
  twoColumnProxyGroup,
} from '@/store/settings'
import { useResizeObserver, useSessionStorage } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const isTestingCustomNodes = ref(false)
const isTestingSubscriptions = ref(false)
let providerAutoUpdateTimer: ReturnType<typeof setInterval> | undefined
let providerAutoUpdating = false
const enabledSubscriptionProviders = computed(() =>
  proxyProviederList.value.filter((provider) => providerEnabledMap.value[provider.name] !== false),
)

const refreshEnabledSubscriptions = async () => {
  if (providerAutoUpdating) return

  const now = Date.now()
  const providers = enabledSubscriptionProviders.value
    .filter((provider) => {
      const interval =
        providerAutoUpdateIntervals.value[provider.name] ?? providerAutoUpdateInterval.value
      const updatedAt = Date.parse(provider.updatedAt || '')
      return interval > 0 && (!updatedAt || now - updatedAt >= interval)
    })
    .map(({ name }) => name)
  if (!providers.length) return

  providerAutoUpdating = true
  try {
    const results = await Promise.allSettled(providers.map((name) => updateProxyProviderAPI(name)))
    if (results.some((result) => result.status === 'fulfilled')) {
      await fetchProxies()
    }
  } finally {
    providerAutoUpdating = false
  }
}
const latestProviderHistoryTime = (history?: { time: string }[]) =>
  Math.max(0, ...(history ?? []).map(({ time }) => Date.parse(time) || 0))

const handlerTestSubscriptions = async () => {
  if (isTestingSubscriptions.value || !enabledSubscriptionProviders.value.length) return
  isTestingSubscriptions.value = true
  try {
    const providers = [...enabledSubscriptionProviders.value]
    const snapshots = new Map(
      providers.map((provider) => [
        provider.name,
        new Map(
          provider.proxies.map((proxy) => [proxy.name, latestProviderHistoryTime(proxy.history)]),
        ),
      ]),
    )
    const results = await Promise.allSettled(
      providers.map((provider) => proxyProviderHealthCheckAPI(provider.name)),
    )
    const failed = results.filter((result) => result.status === 'rejected')
    const successfulNames = providers
      .filter((_, index) => results[index]?.status === 'fulfilled')
      .map((provider) => provider.name)
    if (!successfulNames.length && failed.length) throw failed[0].reason

    const deadline = Date.now() + 30_000
    do {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await fetchProxies()
      const finished = successfulNames.every((name) => {
        const previous = snapshots.get(name) ?? new Map()
        const current = proxyProviederList.value.find((provider) => provider.name === name)
        return current?.proxies.every(
          (proxy) => latestProviderHistoryTime(proxy.history) > (previous.get(proxy.name) ?? 0),
        )
      })
      if (finished) break
    } while (Date.now() < deadline)
    if (failed.length) notifyRequestError(failed[0].reason)
  } catch (error) {
    notifyRequestError(error)
  } finally {
    isTestingSubscriptions.value = false
  }
}

// 简易并发信号量:同时最多 CONCURRENCY 个测速,完成后取下一个
const CONCURRENCY = 3
const handlerTestCustomNodes = async () => {
  if (isTestingCustomNodes.value) return
  isTestingCustomNodes.value = true
  const names = [...customNodeNames.value]
  let cursor = 0
  const next = async () => {
    const idx = cursor++
    if (idx >= names.length) return
    const name = names[idx]
    markNodeTesting(name, true)
    try {
      await proxyLatencyTest(name, undefined, 5000)
    } finally {
      markNodeTesting(name, false)
    }
    await next()
  }
  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, names.length) }, () => next()))
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
const providerFormBase64 = ref('')
const providerFormSubmitting = ref(false)
const subscriptionAddMode = ref<'url' | 'base64' | 'custom'>('url')
const addModeOptions = computed(() => [
  { value: 'url', label: t('subscriptionUrl') },
  { value: 'base64', label: t('base64Vless') },
  { value: 'custom', label: t('customNodeMode') },
])
const setAddMode = (value: string) => {
  subscriptionAddMode.value = value as 'url' | 'base64' | 'custom'
}
const providerBase64Result = computed(
  (): {
    links: string[]
    nodes: Record<string, unknown>[]
    error: string
  } => {
    const source = providerFormBase64.value.trim()
    if (!source) return { links: [], nodes: [], error: '' }
    try {
      const compact = source.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
      const binary = atob(compact.padEnd(Math.ceil(compact.length / 4) * 4, '='))
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      const links = decoded
        .split(/[\r\n|]+/)
        .map((line) => line.trim())
        .filter(Boolean)
      const parsed = parseShareLink(links.join('\n'))
      const nodes = (Array.isArray(parsed) ? parsed : parsed ? [parsed] : []) as Record<
        string,
        unknown
      >[]
      if (
        !links.length ||
        links.some((line) => !/^vless:\/\/\S+$/i.test(line)) ||
        nodes.length !== links.length
      ) {
        return { links: [], nodes: [], error: 'vlessSubscriptionInvalidContent' }
      }
      return { links, nodes, error: '' }
    } catch {
      return { links: [], nodes: [], error: 'vlessSubscriptionDecodeFailed' }
    }
  },
)
const canSaveSubscription = computed(() => {
  if (!providerFormName.value.trim()) return false
  return subscriptionAddMode.value === 'url'
    ? Boolean(providerFormUrl.value.trim())
    : subscriptionAddMode.value === 'base64' && providerBase64Result.value.nodes.length > 0
})
watch(providerFormOpen, (open) => {
  if (!open) {
    providerFormName.value = ''
    providerFormUrl.value = ''
    providerFormBase64.value = ''
    subscriptionAddMode.value = 'url'
  }
})

const handlerClickAdd = () => {
  subscriptionAddMode.value = providerSubTab.value === 'custom' ? 'custom' : 'url'
  providerFormOpen.value = true
}

const handlerSaveProvider = async () => {
  if (providerFormSubmitting.value) return
  if (subscriptionAddMode.value === 'custom') return
  if (!providerFormName.value.trim() || !canSaveSubscription.value) {
    showNotification({ content: 'addProviderRequireFields', type: 'alert-error' })
    return
  }
  const isBase64Subscription = subscriptionAddMode.value === 'base64'
  providerFormSubmitting.value = true
  try {
    const res = !isBase64Subscription
      ? await callProviderCgi('add', providerFormName.value.trim(), providerFormUrl.value.trim())
      : await callLocalProviderCgi(providerFormName.value.trim(), providerBase64Result.value.nodes)
    if (!res.ok) throw new Error(res.error || 'cgi failed')
    providerFormOpen.value = false
    await fetchProxies()
    showNotification({
      content: isBase64Subscription ? 'vlessSubscriptionCreated' : 'addProviderSuccess',
      type: 'alert-success',
    })
  } catch (e) {
    notifyRequestError(e)
  } finally {
    providerFormSubmitting.value = false
  }
}

const handlerSaveCustomNode = async (node: Record<string, unknown>) => {
  const originalName = customNodeEditorTarget.value?.['name'] as string | undefined
  const action = originalName ? 'update' : 'add'
  const nodePayload = { ...node }
  const selectedGroup = nodePayload['__myboardGroupName'] as string | undefined
  delete nodePayload['__myboardGroupName']
  if (selectedGroup) nodePayload.__myboardGroupName = selectedGroup
  try {
    // update 用旧名称定位,允许用户在编辑器内修改节点名称。
    const res = await callNodeCgi(action, originalName || (node['name'] as string), nodePayload)
    if (!res.ok) throw new Error(res.error || 'save failed')
    showNotification({
      content: action === 'add' ? 'addProviderSuccess' : 'updateNodeSuccess',
      type: 'alert-success',
    })
    closeCustomNodeEditor()
    providerFormOpen.value = false
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
  // 定时器本身不依赖全局默认值；单个订阅可以在全局关闭时独立启用。
  providerAutoUpdateTimer = setInterval(refreshEnabledSubscriptions, 60 * 1000)
})

onBeforeUnmount(() => {
  if (providerAutoUpdateTimer) {
    clearInterval(providerAutoUpdateTimer)
    providerAutoUpdateTimer = undefined
  }
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
