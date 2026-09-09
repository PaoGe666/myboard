<script setup lang="ts">
import SelectInput from '@/components/common/SelectInput.vue'
import TextInput from '@/components/common/TextInput.vue'
import { computed, ref } from 'vue'

defineOptions({ name: 'CustomNodeEditor' })

const props = defineProps<{
  initial?: Record<string, unknown> | null
}>()

const emit = defineEmits<{
  save: [node: Record<string, unknown>]
  cancel: []
}>()

const NODE_TYPES = ['ss', 'vmess', 'trojan', 'vless', 'hysteria2', 'tuic', 'socks5', 'http']

const read = (k: string, d = '') => ((props.initial?.[k] as string | undefined) ?? d).toString()
const num = (k: string, d = 443) => Number((props.initial?.[k] as number | undefined) ?? d)

const name = ref(read('name'))
const type = ref(read('type', 'ss'))
const server = ref(read('server'))
const port = ref<number | string>(num('port'))

const password = ref(read('password'))
const cipher = ref(read('cipher', 'aes-128-gcm'))
const uuid = ref(read('uuid'))
const alterId = ref<number | string>(num('alterId', 0))
const cipherSecurity = ref(read('cipher'))
const flow = ref(read('flow'))
const username = ref(read('username'))
const sni = ref(read('sni'))
const tls = ref(Boolean(props.initial?.['tls']))
// 传输 ws / http
const network = ref(read('network', 'tcp'))
const wsPath = ref(read('ws-opts.path', '/'))
const wsHost = ref(read('ws-opts.headers.Host', ''))

const isValid = computed(() =>
  Boolean(name.value.trim() && server.value.trim() && Number(port.value) > 0),
)

const buildNode = (): Record<string, unknown> => {
  const node: Record<string, unknown> = {
    name: name.value.trim(),
    type: type.value,
    server: server.value.trim(),
    port: Number(port.value),
  }

  switch (type.value) {
    case 'ss':
      node.password = password.value
      node.cipher = cipher.value
      break
    case 'vmess':
      node.uuid = uuid.value
      node.alterId = Number(alterId.value)
      node.cipher = cipherSecurity.value
      break
    case 'vless':
      node.uuid = uuid.value
      node.flow = flow.value || undefined
      break
    case 'trojan':
    case 'hysteria2':
      node.password = password.value
      break
    case 'tuic':
      node.uuid = uuid.value
      node.password = password.value
      break
    case 'socks5':
    case 'http':
      node.username = username.value
      node.password = password.value
      break
  }

  if (tls.value || ['trojan', 'vless', 'vmess'].includes(type.value)) {
    if (sni.value) node.sni = sni.value
    if (tls.value) node.tls = true
  }

  if (network.value !== 'tcp') {
    const opts: Record<string, unknown> = { path: wsPath.value }
    if (wsHost.value) opts.headers = { Host: wsHost.value }
    if (network.value === 'ws') node['ws-opts'] = opts
    if (network.value === 'h2') node['h2-opts'] = { path: wsPath.value }
  }

  return node
}

const handlerSave = () => {
  if (!isValid.value) return
  let node = buildNode()
  if (props.initial) node = { ...props.initial, ...node }
  emit('save', node)
}
</script>

<template>
  <div class="flex flex-col gap-3 p-2 text-sm">
    <div class="card-title">{{ props.initial ? $t('editCustomNode') : $t('addCustomNode') }}</div>
    <div class="settings-grid">
      <label class="setting-item">
        <span class="setting-item-label">{{ $t('providerName') }}</span>
        <TextInput
          v-model="name"
          clearable
        />
      </label>
      <label class="setting-item">
        <span class="setting-item-label">{{ $t('nodeType') }}</span>
        <SelectInput
          v-model="type"
          :options="NODE_TYPES.map((v) => ({ value: v, label: v }))"
        />
      </label>
      <label class="setting-item">
        <span class="setting-item-label">{{ $t('server') }}</span>
        <TextInput
          v-model="server"
          clearable
        />
      </label>
      <label class="setting-item">
        <span class="setting-item-label">{{ $t('port') }}</span>
        <input
          v-model="port"
          type="number"
          class="input input-sm w-24"
        />
      </label>

      <template v-if="type === 'ss'">
        <label class="setting-item">
          <span class="setting-item-label">{{ $t('password') }}</span>
          <TextInput
            v-model="password"
            clearable
          />
        </label>
        <label class="setting-item">
          <span class="setting-item-label">{{ $t('cipher') }}</span>
          <TextInput
            v-model="cipher"
            clearable
          />
        </label>
      </template>

      <template v-if="type === 'vmess' || type === 'vless' || type === 'tuic'">
        <label class="setting-item">
          <span class="setting-item-label">{{ $t('uuid') }}</span>
          <TextInput
            v-model="uuid"
            clearable
          />
        </label>
      </template>
      <label
        v-if="type === 'vmess'"
        class="setting-item"
      >
        <span class="setting-item-label">{{ $t('alterId') }}</span>
        <input
          v-model="alterId"
          type="number"
          class="input input-sm w-24"
        />
      </label>
      <label
        v-if="type === 'vmess'"
        class="setting-item"
      >
        <span class="setting-item-label">{{ $t('cipher') }}</span>
        <TextInput
          v-model="cipherSecurity"
          clearable
        />
      </label>

      <template
        v-if="type === 'trojan' || type === 'hysteria2' || type === 'tuic' || type === 'ss'"
      >
        <label class="setting-item">
          <span class="setting-item-label">{{ $t('password') }}</span>
          <TextInput
            v-model="password"
            clearable
          />
        </label>
      </template>

      <template v-if="type === 'socks5' || type === 'http'">
        <label class="setting-item">
          <span class="setting-item-label">{{ $t('username') }}</span>
          <TextInput
            v-model="username"
            clearable
          />
        </label>
        <label class="setting-item">
          <span class="setting-item-label">{{ $t('password') }}</span>
          <TextInput
            v-model="password"
            clearable
          />
        </label>
      </template>

      <template v-if="['trojan', 'vmess', 'vless', 'hysteria2'].includes(type)">
        <label class="setting-item">
          <span class="setting-item-label">{{ $t('sni') }}</span>
          <TextInput
            v-model="sni"
            clearable
          />
        </label>
      </template>

      <template v-if="type === 'vmess' || type === 'vless'">
        <label class="setting-item">
          <span class="setting-item-label">{{ $t('transport') }}</span>
          <SelectInput
            v-model="network"
            :options="[
              { value: 'tcp', label: 'tcp' },
              { value: 'ws', label: 'ws' },
              { value: 'grpc', label: 'grpc' },
              { value: 'h2', label: 'h2' },
            ]"
          />
        </label>
        <label
          v-if="network === 'ws'"
          class="setting-item"
        >
          <span class="setting-item-label">{{ $t('wsPath') }}</span>
          <TextInput
            v-model="wsPath"
            clearable
          />
        </label>
        <label
          v-if="network === 'ws'"
          class="setting-item"
        >
          <span class="setting-item-label">{{ $t('wsHost') }}</span>
          <TextInput
            v-model="wsHost"
            clearable
          />
        </label>
      </template>
    </div>

    <div class="modal-action">
      <button
        class="btn btn-sm"
        @click="emit('cancel')"
      >
        {{ $t('cancel') }}
      </button>
      <button
        class="btn btn-primary btn-sm"
        :disabled="!isValid"
        @click="handlerSave"
      >
        {{ $t('save') }}
      </button>
    </div>
  </div>
</template>
