/**
 * Device detection hook
 * Returns flags for TV, phone, tablet, and desktop
 */
import { useState, useEffect } from 'react'

export type DeviceType = 'tv' | 'phone' | 'tablet' | 'desktop'

function detect(): DeviceType {
  // Android TV: large screen + no touch, OR explicit TV user agent
  const ua = navigator.userAgent.toLowerCase()
  const isTV = ua.includes('tv') || ua.includes('googletv') || ua.includes('firetv') ||
    ua.includes('androidtv') || (window as any).Android?.isTV ||
    (window.matchMedia('(min-width: 960px)').matches && !('ontouchstart' in window) && window.innerWidth >= 1280)

  if (isTV) return 'tv'

  const isMobile = /android|iphone|ipod/i.test(ua)
  const isTablet = /ipad/i.test(ua) || (isMobile && window.innerWidth >= 600)

  if (isTablet) return 'tablet'
  if (isMobile) return 'phone'
  return 'desktop'
}

export function useDevice() {
  const [device, setDevice] = useState<DeviceType>(detect)
  useEffect(() => {
    const onResize = () => setDevice(detect())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return {
    device,
    isTV:      device === 'tv',
    isPhone:   device === 'phone',
    isTablet:  device === 'tablet',
    isDesktop: device === 'desktop',
    isMobile:  device === 'phone' || device === 'tablet',
    isTouchDevice: 'ontouchstart' in window,
  }
}
