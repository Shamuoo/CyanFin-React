/**
 * Device detection hook
 * Returns flags for TV, phone, tablet, and desktop
 */
import { useState, useEffect } from 'react'

export type DeviceType = 'tv' | 'phone' | 'tablet' | 'desktop'

function detect(): DeviceType {
  // Android TV: large screen + no touch, OR explicit TV user agent
  const ua = navigator.userAgent.toLowerCase()
  // Only flag as TV if user agent explicitly says TV — never infer from screen size alone
  const isTV = ua.includes('googletv') || ua.includes('firetv') ||
    ua.includes('androidtv') || ua.includes('crkey') ||
    ua.includes('webos') || ua.includes('tizen') ||
    (window as any).Android?.isTV === true

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
