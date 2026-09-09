<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const DOWN_URL = 'https://speed.cloudflare.com/__down?bytes=104857600'
const UP_URL = 'https://speed.cloudflare.com/__up'
const UP_SIZE = 10485760 // 10MB

const running = ref(false)
const downMbps = ref(0)
const upMbps = ref(0)
const liveDown = ref(0)
const liveUp = ref(0)
const phase = ref<'idle' | 'download' | 'upload' | 'done'>('idle')
const error = ref('')

let abort: AbortController | null = null

const fmt = (mbps: number) => (mbps >= 0.01 ? mbps.toFixed(1) : '0.0')

const testDownload = async () => {
  phase.value = 'download'
  abort = new AbortController()
  const res = await fetch(DOWN_URL, { signal: abort.signal })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  const reader = res.body.getReader()
  let total = 0
  const start = performance.now()
  let last = start
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    const now = performance.now()
    const sec = (now - last) / 1000
    if (sec >= 0.2) {
      liveDown.value = (value.length * 8) / sec / 1e6
      last = now
    }
  }
  const sec = (performance.now() - start) / 1000
  downMbps.value = (total * 8) / sec / 1e6
}

const testUpload = async () => {
  phase.value = 'upload'
  abort = new AbortController()
  const body = new Blob([new Uint8Array(UP_SIZE)])
  const start = performance.now()
  const res = await fetch(UP_URL, {
    method: 'POST',
    body,
    signal: abort.signal,
    headers: { 'Content-Type': 'application/octet-stream' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const sec = (performance.now() - start) / 1000
  upMbps.value = (UP_SIZE * 8) / sec / 1e6
}

const handlerStart = async () => {
  if (running.value) return
  running.value = true
  downMbps.value = 0
  upMbps.value = 0
  liveDown.value = 0
  liveUp.value = 0
  error.value = ''
  phase.value = 'download'
  try {
    await testDownload()
    await testUpload()
    phase.value = 'done'
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      phase.value = 'idle'
    } else {
      error.value = t('speedTestFailed')
      phase.value = 'done'
    }
  } finally {
    running.value = false
  }
}

const handlerCancel = () => {
  abort?.abort()
}

onBeforeUnmount(() => abort?.abort())

const busy = computed(() => running.value)
</script>

<template>
  <div class="flex flex-col gap-4 p-2 text-sm">
    <div class="text-base-content/60 text-xs">{{ $t('speedTestHint') }}</div>

    <div class="grid grid-cols-2 gap-3">
      <div class="bg-base-200/50 rounded-xl p-4 text-center">
        <div class="text-base-content/60 text-xs">{{ $t('download') }}</div>
        <div class="mt-1 text-2xl font-bold tabular-nums">
          {{ phase === 'download' ? fmt(liveDown) : fmt(downMbps) }}
        </div>
        <div class="text-base-content/40 text-[10px]">Mbps</div>
      </div>
      <div class="bg-base-200/50 rounded-xl p-4 text-center">
        <div class="text-base-content/60 text-xs">{{ $t('upload') }}</div>
        <div class="mt-1 text-2xl font-bold tabular-nums">
          {{ phase === 'upload' ? fmt(liveUp) : fmt(upMbps) }}
        </div>
        <div class="text-base-content/40 text-[10px]">Mbps</div>
      </div>
    </div>

    <div
      v-if="error"
      class="alert alert-error text-xs"
    >
      {{ error }}
    </div>

    <div class="modal-action">
      <button
        v-if="phase === 'idle' || phase === 'done'"
        class="btn btn-primary btn-sm"
        @click="handlerStart"
      >
        {{ $t('speedTestStart') }}
      </button>
      <button
        v-else
        class="btn btn-ghost btn-sm"
        :disabled="!busy"
        @click="handlerCancel"
      >
        {{ $t('cancel') }}
      </button>
    </div>
  </div>
</template>
