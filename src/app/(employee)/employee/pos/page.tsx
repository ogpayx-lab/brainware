'use client'
import { Suspense } from 'react'
import POSContent from './pos-content'
import { useT } from '@/lib/i18n'

export default function POSPage() {
  const t = useT()
  return (
    <Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>{t('loading')}</div>}>
      <POSContent />
    </Suspense>
  )
}
