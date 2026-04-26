'use client'
import { HelpTooltip } from '@/components/HelpTooltip'
import { DemoBanner } from '@/components/DemoBanner'
import { EmployeeSidebar } from '@/components/employee/EmployeeSidebar'
export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return <>
    <DemoBanner />
    <EmployeeSidebar />
    {children}
    <HelpTooltip />
  </>
}
