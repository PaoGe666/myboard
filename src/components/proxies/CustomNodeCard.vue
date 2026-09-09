<template>
  <div class="bg-base-100 border-base-300/50 flex w-full items-center gap-2 rounded-xl border p-3">
    <ProxyIcon
      v-if="node?.icon"
      :icon="node.icon"
      :name="name"
      class="shrink-0"
    />
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm">{{ name }}</div>
      <div class="text-base-content/50 text-xs">
        {{ node?.type }}
      </div>
    </div>
    <LatencyTag
      class="shrink-0"
      :name="name"
      :group-name="name"
      @click.stop="testLatency"
    />
    <button
      class="btn btn-circle btn-ghost btn-sm"
      :title="$t('editCustomNode')"
      @click.stop="openCustomNodeEditor(node)"
    >
      <PencilSquareIcon class="h-4 w-4 opacity-60" />
    </button>
    <button
      class="btn btn-circle btn-ghost btn-sm text-error"
      :title="$t('deleteCustomNode')"
      @click.stop="handlerDelete"
    >
      <TrashIcon class="h-4 w-4 opacity-60" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { fetchProxies, proxyLatencyTest, proxyMap } from '@/assembly/proxies'
import { openCustomNodeEditor } from '@/composables/proxies'
import { showConfirmDialog } from '@/helper/confirmDialog'
import { showNotification } from '@/helper/notification'
import { callNodeCgi } from '@/helper/nodeCgi'
import { notifyRequestError } from '@/helper/requestError'
import { PencilSquareIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LatencyTag from './LatencyTag.vue'
import ProxyIcon from './ProxyIcon.vue'

const props = defineProps<{ name: string }>()
const { t } = useI18n()
const node = computed(() => proxyMap.value[props.name])

const testLatency = async () => {
  await proxyLatencyTest(props.name, undefined, 5000)
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
