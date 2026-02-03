'use client'

import { useState, ReactNode } from 'react'

export type TabItem = {
  key: string
  label: string
  title: string
  content: ReactNode
}

type NavBarHandlerProps = {
  tabs: TabItem[]
  initialTabKey?: string
}

export default function NavBarHandler({
  tabs,
  initialTabKey,
}: NavBarHandlerProps) {
  const [activeTab, setActiveTab] = useState(initialTabKey || tabs[0].key)

  const currentTab = tabs.find((tab) => tab.key === activeTab)

  return (
    <div>
      <nav className="flex gap-4 border-b-2 border-[#DEE2EA] text-sm">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`py-2 px-4 border-none cursor-pointer transition-colors duration-200 hover:border-b-2 hover:border-[#a5afe0] ${
              activeTab === tab.key ? 'border-b-2 border-primary' : ''
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="p-0 m-0">{currentTab?.content}</div>
    </div>
  )
}
