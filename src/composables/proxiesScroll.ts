import { PROXY_CARD_SIZE } from '@/constant'
import { findScrollableParent } from '@/helper/utils'
import { minProxyCardWidth, proxyCardSize } from '@/store/settings'
import { useCurrentElement, useElementSize, useInfiniteScroll } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, watch, type InjectionKey } from 'vue'

/*
 * 虚拟化之后,节点卡片可能不在渲染窗口里 —— 想滚到某个节点得让列表自己去滚,
 * 卡片拿不到自己的 DOM 也就无从滚起。由 ProxiesContent 提供。
 * 定位一律瞬时:动态行高下带动画的滚动会被沿途的测量修正打断,停在半路。
 */
export type ScrollProxyNodeIntoView = (name: string) => void

export const scrollNodeIntoViewKey: InjectionKey<ScrollProxyNodeIntoView> =
  Symbol('scrollNodeIntoView')

/*
 * 测速后的高亮提到模块作用域:重排会把卡片挪出渲染窗口再挪回来,
 * 状态留在组件实例里的话,卡片一卸载高亮就没了。
 */
export const highlightedProxyNode = ref('')

let highlightTimer: ReturnType<typeof setTimeout> | undefined

export const highlightProxyNode = (name: string) => {
  highlightedProxyNode.value = name
  clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => {
    if (highlightedProxyNode.value === name) {
      highlightedProxyNode.value = ''
    }
  }, 1500)
}

/*
 * myboard 沿用旧版「按需递增渲染节点」:展开时只渲染前几行,随滚动用 InfiniteScroll 增量
 * 补齐。虚拟列页面对整组卡片仍走 v3.26.0 的行虚拟化;这里仅服务折叠卡片内的节点网格。
 */
export const useCalculateMaxProxies = (totalProxies: number, activeIndex: number) => {
  const el = useCurrentElement()
  const { width } = useElementSize(el)
  const initMaxProxies = computed(() => {
    return (
      Math.max(Math.floor(width.value / minProxyCardWidth.value), 2) *
      (proxyCardSize.value === PROXY_CARD_SIZE.LARGE ? 9 : 12)
    )
  })
  const maxProxies = ref(Math.max(24, activeIndex + 12))

  onMounted(() => {
    watch(
      initMaxProxies,
      () => {
        maxProxies.value = Math.max(maxProxies.value, initMaxProxies.value)
      },
      { immediate: true },
    )

    nextTick(() => {
      const scrollEl = findScrollableParent(el.value as HTMLElement)

      useInfiniteScroll(
        scrollEl,
        () => {
          maxProxies.value = Math.min((maxProxies.value += initMaxProxies.value), totalProxies)
        },
        {
          distance: 100,
          canLoadMore: () => {
            return maxProxies.value < totalProxies
          },
        },
      )
    })
  })

  return {
    maxProxies,
  }
}
