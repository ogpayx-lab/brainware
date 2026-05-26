'use client'
import { HelpTooltip } from '@/components/HelpTooltip'
import { DemoBanner } from '@/components/DemoBanner'
import { EmployeeSidebar } from '@/components/employee/EmployeeSidebar'
import { LanguageProvider } from '@/lib/i18n'
export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>
    <DemoBanner />
    <EmployeeSidebar />
    {children}
    <HelpTooltip />
  </LanguageProvider>
}

