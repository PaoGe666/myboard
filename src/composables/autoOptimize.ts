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
import { nextTick, watch } from 'vue'

const OPTIMIZE_INTERVAL = 5 * 60 * 1000
// mihomo 数据会定期刷新(proxyGroupList 引用每次都变)但内容通常不变,
// 不防抖就会无谓地重复全量测速。
const RESCHEDULE_DELAY = 5_000

let timer: ReturnType<typeof setInterval> | null = null
let isOptimizing = false
let rescheduleTimer: ReturnType<typeof setTimeout> | null = null

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
  // 启用后立即测速并选择,不依赖节点已有历史延迟或等待五分钟定时器。
  nextTick(() => runTestAndSelect())
  timer = setInterval(runTestAndSelect, OPTIMIZE_INTERVAL)
}

const stop = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (rescheduleTimer) {
    clearTimeout(rescheduleTimer)
    rescheduleTimer = null
  }
}

watch(autoOptimize, start, { immediate: true })

// 后端切换/首次拉取后 proxyGroupList 才有内容,避免启动时空扫描后要等五分钟。
// 数据刷新期间 proxyGroupList 引用每次都变,但稳态下内容相同,加防抖避免重复测速。
watch(proxyGroupList, () => {
  if (!autoOptimize.value || isOptimizing || !proxyGroupList.value.length) return
  if (rescheduleTimer) clearTimeout(rescheduleTimer)
  rescheduleTimer = setTimeout(runTestAndSelect, RESCHEDULE_DELAY)
})
