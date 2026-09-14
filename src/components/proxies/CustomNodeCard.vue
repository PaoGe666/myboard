<template>
  <div
    :class="[
      'relative flex w-full cursor-pointer flex-col items-start rounded-md p-2 transition-colors hover:shadow-sm',
      'bg-base-200 sm:hover:bg-base-300/50',
      isTesting && 'border-warning/70 ring-warning/30 bg-warning/5 ring-2',
    ]"
    @contextmenu.stop.prevent="handlerLatencyTest"
  >
    <ProxyIcon
      v-if="node?.icon"
      :icon="node.icon"
      :name="name"
      class="shrink-0"
    />
    <div class="w-full min-w-0 flex-1 text-sm">
      <div class="flex items-center gap-2 truncate text-sm">
        <span>{{ name }}</span>
        <span
          v-if="isTesting"
          class="bg-warning/15 text-warning shrink-0 animate-pulse rounded px-1.5 py-0.5 text-[10px] font-medium"
        >
          {{ $t('testing') }}
        </span>
      </div>
      <div class="text-base-content/50 text-xs">
        {{ node?.type }}
      </div>
    </div>
    <div class="flex h-4 w-full items-center justify-between">
      <span class="text-base-content/60 truncate text-xs tracking-tight">
        {{ typeDescription }}
      </span>
      <LatencyTag
        class="shrink-0"
        :loading="isLatencyTesting"
        :name="name"
        @click.stop="handlerLatencyTest"
      />
    </div>
    <!-- 操作按钮不占用测速点击区域 -->
    <div class="absolute top-1 right-1 flex items-center">
      <button
        class="btn btn-circle btn-ghost btn-sm"
        :title="$t('editCustomNode')"
        :disabled="loadingConfig"
        @click.stop="handlerEdit"
      >
        <span
          v-if="loadingConfig"
          class="loading loading-spinner loading-xs"
        ></span>
        <PencilSquareIcon
          v-else
          class="h-4 w-4 opacity-60"
        />
      </button>
      <button
        class="btn btn-circle btn-ghost btn-sm text-error"
        :title="$t('deleteCustomNode')"
        @click.stop="handlerDelete"
      >
        <TrashIcon class="h-4 w-4 opacity-60" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { fetchProxies, proxyLatencyTest, proxyMap } from '@/assembly/proxies'
import { openCustomNodeEditor, testingNodeNames } from '@/composables/proxies'
import { showConfirmDialog } from '@/helper/confirmDialog'
import { showNotification } from '@/helper/notification'
import { callNodeCgi, getNodeConfig } from '@/helper/nodeCgi'
import { notifyRequestError } from '@/helper/requestError'
import { PencilSquareIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LatencyTag from './LatencyTag.vue'
import ProxyIcon from './ProxyIcon.vue'

const props = defineProps<{ name: string }>()
const { t } = useI18n()
const node = computed(() => proxyMap.value[props.name])
const isTesting = computed(() => testingNodeNames.value.has(props.name))
const loadingConfig = ref(false)
const isLatencyTesting = ref(false)
const typeDescription = computed(() => {
  return node.value?.type?.toLowerCase() || ''
})

const handlerEdit = async () => {
  loadingConfig.value = true
  try {
    openCustomNodeEditor(await getNodeConfig(props.name))
  } catch (e) {
    notifyRequestError(e)
  } finally {
    loadingConfig.value = false
  }
}

const handlerLatencyTest = async () => {
  if (isLatencyTesting.value) return
  isLatencyTesting.value = true
  try {
    await proxyLatencyTest(props.name, undefined, 5000)
  } finally {
    isLatencyTesting.value = false
  }
}

const handlerDelete = async () => {
  const { confirmed } = await showConfirmDialog({
    title: t('deleteCustomNode'),
    message: t('deleteCustomNodeMessage', { name: props.name }),
    confirmButtonClass: 'btn-error',
  })
  if (!confirmed) return

  try {
    const res = await callNodeCgi('delete', props.name)
    if (!res.ok) throw new Error(res.error || 'delete failed')
    showNotification({ content: 'deleteProviderSuccess', type: 'alert-success' })
    await fetchProxies()
  } catch (e) {
    notifyRequestError(e)
  }
}
</script>
