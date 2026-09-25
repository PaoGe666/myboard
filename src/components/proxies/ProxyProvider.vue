<template>
  <CollapseCard :name="proxyProvider.name">
    <template v-slot:title>
      <div class="flex items-center justify-between gap-2">
        <div class="flex flex-1 items-center gap-2.5">
          <span class="text-base-content">{{ proxyProvider.name }}</span>
          <span
            class="text-base-content/40 min-w-0 flex-1 truncate text-[11px] tracking-wider uppercase tabular-nums"
          >
            {{ proxyProvider.vehicleType }} · {{ proxiesCount }}
          </span>
        </div>
        <div class="flex items-center gap-1.5">
          <label class="label cursor-pointer gap-1">
            <span class="label-text text-xs">{{ $t('enabled') }}</span>
            <input
              type="checkbox"
              class="toggle toggle-sm toggle-primary"
              :checked="isEnabled"
              @change="toggleEnabled"
            />
          </label>
          <button
            class="btn btn-circle btn-ghost btn-sm z-30"
            :disabled="!isEnabled || isHealthChecking"
            @click.stop="healthCheckClickHandler"
            :aria-label="isHealthChecking ? '订阅测速中' : '测试订阅延迟'"
            :title="isHealthChecking ? '订阅测速中' : '测试订阅延迟'"
          >
            <span
              v-if="isHealthChecking"
              class="loading loading-spinner loading-sm"
            ></span>
            <BoltIcon
              v-else
              class="h-3.5 w-3.5 opacity-60"
            />
          </button>
          <button
            v-if="proxyProvider.vehicleType !== 'Inline'"
            :class="
              twMerge('btn btn-circle btn-ghost btn-sm z-30', isUpdating ? 'animate-spin' : '')
            "
            @click.stop="updateProviderClickHandler"
          >
            <ArrowPathIcon class="h-3.5 w-3.5 opacity-60" />
          </button>
          <button
            class="btn btn-circle btn-ghost btn-sm text-error z-30"
            @click.stop="deleteProviderClickHandler"
          >
            <TrashIcon class="h-3.5 w-3.5 opacity-60" />
          </button>
        </div>
      </div>
      <div class="mt-2 space-y-1.5">
        <div
          v-if="subscriptionInfo"
          class="space-y-1"
        >
          <div class="bg-base-content/10 h-1.5 w-full overflow-hidden rounded-full">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="usageBarColor"
              :style="{ width: `${subscriptionInfo.percentage}%` }"
            />
          </div>
          <div class="text-base-content/60 flex justify-between text-xs">
            <span>{{ subscriptionInfo.usageStr }}</span>
            <span>{{ subscriptionInfo.expireStr }}</span>
          </div>
        </div>
        <div
          v-if="isHealthChecking"
          class="text-primary flex items-center gap-2 text-xs"
          role="status"
          aria-live="polite"
        >
          <span class="loading loading-spinner loading-xs"></span>
          <span>正在测试此订阅的节点延迟…</span>
        </div>
        <div class="text-base-content/60 text-xs">
          {{ $t('updated') }} {{ fromNow(proxyProvider.updatedAt) }}
        </div>
        <div class="text-base-content/60 flex items-center gap-2 text-xs">
          <span>自动更新</span>
          <input
            type="checkbox"
            class="toggle toggle-xs"
            :checked="autoUpdateEnabled"
            @change="toggleAutoUpdate"
          />
          <template v-if="autoUpdateEnabled">
            <input
              v-model.number="autoUpdateMinutes"
              class="input input-xs h-6 w-16"
              type="number"
              min="1"
              step="1"
              title="自动更新间隔（分钟）"
            />
            <span>分钟</span>
          </template>
        </div>
      </div>
    </template>
    <template v-slot:preview>
      <ProxyPreview :nodes="renderProxies" />
    </template>
    <template v-slot:content>
      <ProxiesContent :render-proxies="renderProxies" />
    </template>
  </CollapseCard>
</template>

<script setup lang="ts">
import {
  fetchProxies,
  proxyProviderHealthCheckAPI,
  reconcileDisabledProviderSelections,
  updateProxyProviderAPI,
  proxyProviederList,
} from '@/assembly/proxies'
import { useBounceOnVisible } from '@/composables/bouncein'
import { useRenderProxyList } from '@/composables/renderProxies'
import { showConfirmDialog } from '@/helper/confirmDialog'
import { showNotification } from '@/helper/notification'
import { callProviderCgi } from '@/helper/providerCgi'
import { notifyRequestError } from '@/helper/requestError'
import { fromNow, prettyBytesHelper } from '@/helper/utils'
import {
  providerAutoUpdateInterval,
  providerAutoUpdateIntervals,
  providerEnabledMap,
} from '@/store/settings'
import { ArrowPathIcon, BoltIcon, TrashIcon } from '@heroicons/vue/24/outline'
import dayjs from 'dayjs'
import { toFinite } from 'lodash'
import { twMerge } from 'tailwind-merge'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CollapseCard from '../common/CollapseCard.vue'
import ProxiesContent from './ProxiesContent.vue'
import ProxyPreview from './ProxyPreview.vue'

const props = defineProps<{
  name: string
}>()

const { t } = useI18n()

const proxyProvider = computed(() =>
  proxyProviederList.value.find((group) => group.name === props.name)!,
)
const allProxies = computed(() => proxyProvider.value.proxies.map((node) => node.name) ?? [])
// 订阅详情必须能查看完整节点清单，不能被全局“隐藏不可用节点”筛掉。
const { renderProxies, proxiesCount } = useRenderProxyList(allProxies, undefined, true)

const subscriptionInfo = computed(() => {
  const info = proxyProvider.value.subscriptionInfo

  if (info) {
    const { Download = 0, Upload = 0, Total = 0, Expire = 0 } = info

    if (Download === 0 && Upload === 0 && Total === 0 && Expire === 0) {
      return null
    }

    const { t } = useI18n()
    const total = prettyBytesHelper(Total, { binary: true })
    const used = prettyBytesHelper(Download + Upload, { binary: true })
    const percentage = toFinite((((Download + Upload) / Total) * 100).toFixed(2))
    const expireStr =
      Expire === 0
        ? `${t('expire')}: ${t('noExpire')}`
        : `${t('expire')}: ${dayjs(Expire * 1000).format('YYYY-MM-DD')}`

    const usedStr = `${used} / ${total}`
    const usageStr = Total === 0 ? usedStr : `${usedStr} ( ${percentage}% )`

    return {
      expireStr,
      usageStr,
      percentage: Math.min(percentage, 100),
    }
  }

  return null
})

const usageBarColor = computed(() => {
  const pct = subscriptionInfo.value?.percentage ?? 0

  if (pct >= 90) return 'bg-error'
  if (pct >= 70) return 'bg-warning'
  return 'bg-primary'
})

const isUpdating = ref(false)
const isHealthChecking = ref(false)
const latestHistoryTime = (history?: { time: string }[]) =>
  Math.max(0, ...(history ?? []).map(({ time }) => Date.parse(time) || 0))

// 订阅启用状态,默认 true(启用)
const isEnabled = computed(() => {
  return providerEnabledMap.value[props.name] !== false
})
const autoUpdateMinutes = computed({
  get: () =>
    Math.max(
      1,
      Math.round(
        (providerAutoUpdateIntervals.value[props.name] ?? providerAutoUpdateInterval.value) / 60000,
      ),
    ),
  set: (minutes: number) => {
    const value = Number.isFinite(minutes) ? Math.max(1, Math.round(minutes)) : 1
    providerAutoUpdateIntervals.value = {
      ...providerAutoUpdateIntervals.value,
      [props.name]: value * 60000,
    }
  },
})
const autoUpdateEnabled = computed(
  () => (providerAutoUpdateIntervals.value[props.name] ?? providerAutoUpdateInterval.value) > 0,
)
const toggleAutoUpdate = (event: Event) => {
  const enabled = (event.target as HTMLInputElement).checked
  const next = { ...providerAutoUpdateIntervals.value }
  if (enabled) next[props.name] = Math.max(1, autoUpdateMinutes.value) * 60000
  else next[props.name] = 0
  providerAutoUpdateIntervals.value = next
}

const toggleEnabled = async () => {
  const current = providerEnabledMap.value[props.name] !== false
  if (current) {
    providerEnabledMap.value = {
      ...providerEnabledMap.value,
      [props.name]: false,
    }
  } else {
    const newMap = { ...providerEnabledMap.value }
    delete newMap[props.name]
    providerEnabledMap.value = newMap
  }

  if (current) {
    await reconcileDisabledProviderSelections()
    return
  }

  await fetchProxies()
}

const deleteProviderClickHandler = async () => {
  const { confirmed } = await showConfirmDialog({
    title: t('deleteProviderTitle', { name: props.name }),
    message: t('deleteProviderMessage', { name: props.name }),
    confirmButtonClass: 'btn-error',
  })
  if (!confirmed) return

  try {
    // 从配置中永久移除，失败时直接报告后端错误，不能假装临时删除成功。
    const cgi = await callProviderCgi('delete', props.name)
    if (!cgi.ok) throw new Error(cgi.error || 'failed to delete provider')
    await fetchProxies()
    showNotification({
      content: 'deleteProviderSuccess',
      type: 'alert-success',
    })
  } catch (e) {
    notifyRequestError(e)
  }
}

const healthCheckClickHandler = async () => {
  if (isHealthChecking.value || !isEnabled.value) return

  isHealthChecking.value = true
  try {
    const previousHistory = new Map(
      proxyProvider.value.proxies.map((proxy) => [proxy.name, latestHistoryTime(proxy.history)]),
    )
    await proxyProviderHealthCheckAPI(props.name)
    // Mihomo accepts the request immediately, then checks the provider's nodes asynchronously.
    // Keep the spinner visible and refresh until every node has a new result (or 30s elapse).
    const deadline = Date.now() + 30_000
    do {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await fetchProxies()
      const updatedProvider = proxyProviederList.value.find(
        (provider) => provider.name === props.name,
      )
      const finished = updatedProvider?.proxies.every(
        (proxy) => latestHistoryTime(proxy.history) > (previousHistory.get(proxy.name) ?? 0),
      )
      if (finished) break
    } while (Date.now() < deadline)
  } catch (e) {
    notifyRequestError(e)
  } finally {
    isHealthChecking.value = false
  }
}

const updateProviderClickHandler = async () => {
  if (isUpdating.value) return

  isUpdating.value = true
  try {
    await updateProxyProviderAPI(props.name)
    await fetchProxies()
  } catch (e) {
    notifyRequestError(e)
  } finally {
    isUpdating.value = false
  }
}

useBounceOnVisible()
</script>
