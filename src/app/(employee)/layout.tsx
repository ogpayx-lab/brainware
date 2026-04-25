'use client'
import { HelpTooltip } from '@/components/HelpTooltip'
import { DemoBanner } from '@/components/DemoBanner'
export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return <>
    <DemoBanner />
    {children}
    <HelpTooltip />
  </>
}
