'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'

export default function SalesRedirect() {
  const router = useRouter()
  const t = useT()
  useEffect(() => { router.replace('/owner/analytics/products') }, [])
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>Reindirizzamento...</div>
}
