'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'

export default function TransfersRedirect() {
  const router = useRouter()
  const t = useT()
  useEffect(() => { router.replace('/owner/warehouse/stock-movements') }, [])
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>Reindirizzamento...</div>
}
