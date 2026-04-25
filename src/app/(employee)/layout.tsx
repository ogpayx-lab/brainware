'use client'
import { HelpTooltip } from '@/components/HelpTooltip'
export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return <>
    {children}
    <HelpTooltip />
  </>
}
