'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SalesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/owner/analytics/products') }, [])
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>Reindirizzamento...</div>
}
