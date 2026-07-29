'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileUp, Network, Settings, Database, Server } from 'lucide-react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'File Source', href: '/onboarding/file', icon: FileUp },
  { name: 'Kafka Topic', href: '/onboarding/kafka', icon: Network },
  { name: 'Manage Rules', href: '/manage', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <motion.aside
      initial={{ x: -250 }}
      animate={{ x: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-y-0 left-0 w-64 bg-surface border-r border-outline-variant flex flex-col z-40"
    >
      <div className="flex items-center gap-3 p-6 border-b border-outline-variant">
        <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container">
          <Database size={24} />
        </div>
        <div>
          <h1 className="font-bold text-on-surface text-lg leading-tight">DataPortal</h1>
          <p className="text-xs text-on-surface-variant font-medium">Ops Console</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <p className="px-3 text-xs font-semibold text-outline uppercase tracking-wider mb-2 mt-4">Pipelines</p>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link key={item.name} href={item.href} className="block relative">
              <div
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors relative z-10',
                  isActive ? 'text-on-secondary-container' : 'text-on-surface hover:bg-surface-container'
                )}
              >
                <item.icon size={20} className={isActive ? 'text-on-secondary-container' : 'text-outline'} />
                <span className="font-medium text-sm">{item.name}</span>
              </div>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-secondary-container rounded-md shadow-sm"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-outline-variant">
        <div className="bg-surface-container rounded-md p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-surface flex items-center justify-center shadow-sm border border-outline-variant">
            <Server size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface">Engine API</p>
            <p className="text-[10px] text-on-surface-variant flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span> Connected
            </p>
          </div>
        </div>
      </div>
    </motion.aside>
  )
}
