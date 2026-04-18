const FALLBACK_PROXY_ICON_RULES: Array<{
  pattern: RegExp
  icon: string
}> = [
  {
    pattern: /\badobe\b|acrobat|creative\s*cloud|\bcc\b/i,
    icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/adobe.svg',
  },
  {
    pattern: /\bnvidia\b|geforce|cuda/i,
    icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/nvidia.svg',
  },
  {
    pattern: /\bubuntu\b|canonical/i,
    icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/ubuntu.svg',
  },
]

export const getFallbackProxyIcon = (name: string) => {
  const normalizedName = name.trim()

  if (!normalizedName) {
    return ''
  }

  return FALLBACK_PROXY_ICON_RULES.find(({ pattern }) => pattern.test(normalizedName))?.icon || ''
}

export const getPreferredProxyIcon = (
  name: string,
  currentIcon: string,
  preferBrandSvgIcon: boolean,
) => {
  const fallbackIcon = getFallbackProxyIcon(name)

  if (preferBrandSvgIcon && fallbackIcon) {
    return fallbackIcon
  }

  return currentIcon
}
