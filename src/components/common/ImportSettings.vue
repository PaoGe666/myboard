<template>
  <button
    class="btn btn-sm"
    @click="importDialogShow = true"
  >
    {{ $t('importSettings') }}
  </button>
  <DialogWrapper
    v-model="importDialogShow"
    :title="$t('importSettings')"
  >
    <div class="my-4 flex items-center gap-2">
      {{ $t('importFromFile') }}
      <button
        class="btn btn-sm"
        @click="importSettingsFromFile"
      >
        {{ $t('importFromFile') }}
        <ArrowUpCircleIcon class="h-4 w-4" />
      </button>
    </div>
    <div class="my-4 flex items-center gap-2 max-sm:flex-col max-sm:items-start">
      {{ $t('importFromUrl') }}
      <div class="flex items-center gap-2">
        <div class="join">
          <TextInput
            v-model="importSettingsUrl"
            class="max-w-60"
          />
          <button
            class="btn btn-sm join-item"
            @click="importSettingsFromUrlHandler()"
          >
            <ArrowDownTrayIcon class="h-4 w-4" />
          </button>
        </div>
        <QuestionMarkCircleIcon
          v-if="importSettingsUrl === DEFAULT_SETTINGS_URL"
          class="h-4 w-4"
          @mouseenter="
            showTip($event, $t('importFromBackendTip'), {
              appendTo: 'parent',
            })
          "
        />
        <button
          v-else
          class="btn btn-sm"
          @click="importSettingsUrl = DEFAULT_SETTINGS_URL"
        >
          {{ $t('reset') }} URL
        </button>
      </div>
    </div>
    <div class="my-4 flex items-center gap-2">
      <label class="flex cursor-pointer items-center gap-2">
        <span>{{ $t('autoImportFromUrl') }}</span>
        <input
          v-model="autoImportSettings"
          type="checkbox"
          class="toggle toggle-sm"
        />
      </label>
      <QuestionMarkCircleIcon
        class="h-4 w-4"
        @mouseenter="
          showTip($event, $t('autoImportFromUrlTip'), {
            appendTo: 'parent',
          })
        "
      />
    </div>
    <input
      ref="inputRef"
      type="file"
      accept=".json"
      class="hidden"
      @change="handlerJsonUpload"
    />
  </DialogWrapper>
</template>

<script setup lang="ts">
import {
  autoImportSettings,
  DEFAULT_SETTINGS_URL,
  importSettingsFromUrl,
  importSettingsUrl,
} from '@/helper/autoImportSettings'
import { showNotification } from '@/helper/notification'
import { useTooltip } from '@/helper/tooltip'
import {
  ArrowDownTrayIcon,
  ArrowUpCircleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/vue/24/outline'
import { ref } from 'vue'
import DialogWrapper from './DialogWrapper.vue'
import TextInput from './TextInput.vue'

const inputRef = ref<HTMLInputElement>()
const importDialogShow = ref(false)

const { showTip } = useTooltip()

const showImportFileFailed = (fileName = '') => {
  showNotification({
    content: 'importFileFailed',
    params: { name: fileName || 'unknown.json' },
    type: 'alert-error',
  })
}

const handlerJsonUpload = () => {
  const file = inputRef.value?.files?.[0]
  if (!file) return

  showNotification({
    content: 'importing',
  })

  const reader = new FileReader()

  reader.onerror = () => {
    showImportFileFailed(file.name)
    if (inputRef.value) {
      inputRef.value.value = ''
    }
  }

  reader.onload = async () => {
    try {
      const settings = JSON.parse(reader.result as string) as Record<string, string>

      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        throw new Error('Invalid settings format')
      }

      for (const key in settings) {
        localStorage.setItem(key, settings[key])
      }
      location.reload()
    } catch {
      showImportFileFailed(file.name)
      if (inputRef.value) {
        inputRef.value.value = ''
      }
    }
  }
  reader.readAsText(file)
}

const importSettingsFromFile = () => {
  inputRef.value?.click()
}
const importSettingsFromUrlHandler = async () => {
  importDialogShow.value = false
  await importSettingsFromUrl(true)
}
</script>
