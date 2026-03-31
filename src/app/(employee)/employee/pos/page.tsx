'use client'
import { Suspense } from 'react'
import POSContent from './pos-content'

export default function POSPage() {
  return (
    <Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>Caricamento...</div>}>
      <POSContent />
    </Suspense>
  )
}
