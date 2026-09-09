import {
  getLatencyByName,
  handlerProxySelect,
  isProxyEnabled,
  proxyGroupLatencyTest,
  proxyGroupList,
  proxyMap,
} from '@/assembly/proxies'
import { NOT_CONNECTED } from '@/constant'
import { isProxyGroup } from '@/helper'
import { autoOptimize } from '@/store/settings'
import { watch } from 'vue'

const OPTIMIZE_INTERVAL = 5 * 60 * 1000

let timer: ReturnType<typeof setInterval> | null = null
let isOptimizing = false

const selectBest = async (groupName: string) => {
  const all = proxyMap.value[groupName]?.all ?? []
  const candidates = all.filter(
    (name) => name !== groupName && !isProxyGroup(name) && isProxyEnabled(name),
  )

  let bestNode = ''
  let bestLatency = Infinity

  for (const name of candidates) {
    const latency = getLatencyByName(name, groupName)
    if (latency !== NOT_CONNECTED && latency < bestLatency) {
      bestLatency = latency
      bestNode = name
    }
  }

  if (bestNode) {
    await handlerProxySelect(groupName, bestNode)
  }
}

const runSelectOnly = async () => {
  if (isOptimizing) return
  isOptimizing = true
  try {
    for (const groupName of proxyGroupList.value) {
      await selectBest(groupName)
    }
  } finally {
    isOptimizing = false
  }
}

const runTestAndSelect = async () => {
  if (isOptimizing) return
  isOptimizing = true
  try {
    for (const groupName of proxyGroupList.value) {
      await proxyGroupLatencyTest(groupName)
      await selectBest(groupName)
    }
  } finally {
    isOptimizing = false
  }
}

const start = () => {
  stop()
  if (!autoOptimize.value) return
  runSelectOnly()
  timer = setInterval(runTestAndSelect, OPTIMIZE_INTERVAL)
}

const stop = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

watch(autoOptimize, start, { immediate: true })
