'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileUp, Network, Settings, ArrowRight, Activity, Database, CheckCircle2 } from 'lucide-react'
import { AnimatedCard } from '@/components/AnimatedCard'
import { motion } from 'framer-motion'

export default function Dashboard() {
  const router = useRouter()
  
  const [activePipelines, setActivePipelines] = useState('0')
  const [totalRecordsProcessed, setTotalRecordsProcessed] = useState('0')
  const [dqRulesApplied, setDqRulesApplied] = useState('0')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data.activePipelines !== undefined) {
          setActivePipelines(data.activePipelines.toString())
          setTotalRecordsProcessed(data.totalRecordsProcessed)
          setDqRulesApplied(data.dqRulesApplied.toString())
        }
      })
      .catch(err => console.error("Failed to load stats:", err))
      .finally(() => setIsLoading(false))
  }, [])

  const stats = [
    { label: 'Active Pipelines', value: activePipelines, icon: Activity, color: 'text-on-primary-fixed-variant', bg: 'bg-primary-fixed' },
    { label: 'Total Records Processed', value: totalRecordsProcessed, icon: Database, color: 'text-on-secondary-fixed-variant', bg: 'bg-secondary-fixed' },
    { label: 'DQ Rules Applied', value: dqRulesApplied, icon: CheckCircle2, color: 'text-on-tertiary-fixed-variant', bg: 'bg-tertiary-fixed' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Operations Console</h1>
          <p className="text-muted-foreground mt-1">Monitor pipelines and onboard new sources.</p>
        </div>
      </motion.div>

      {/* KPI Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <AnimatedCard key={stat.label} delay={i * 0.1} className="p-6 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <h3 className="text-2xl font-bold">
                {isLoading ? <span className="animate-pulse text-muted-foreground">...</span> : stat.value}
              </h3>
            </div>
          </AnimatedCard>
        ))}
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <AnimatedCard 
            delay={0.3}
            onClick={() => router.push('/onboarding/file')}
            className="p-6 group relative overflow-hidden bg-surface-container hover:bg-surface-container-high transition-colors border-none"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-container rounded-bl-full -z-10 transition-transform duration-500 ease-out origin-top-right transform-gpu group-hover:scale-125" />
            <div className="w-12 h-12 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center mb-4 shadow-sm">
              <FileUp size={24} />
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-2">Onboard File Source</h3>
            <p className="text-sm text-on-surface-variant mb-4">
              Connect to local or SFTP files, auto-detect schemas, and apply AI data quality rules.
            </p>
            <div className="flex items-center text-sm font-semibold text-primary group-hover:underline">
              Start Wizard <ArrowRight size={16} className="ml-1" />
            </div>
          </AnimatedCard>

          <AnimatedCard 
            delay={0.4}
            onClick={() => router.push('/onboarding/kafka')}
            className="p-6 group relative overflow-hidden bg-surface-container hover:bg-surface-container-high transition-colors border-none"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-container rounded-bl-full -z-10 transition-transform duration-500 ease-out origin-top-right transform-gpu group-hover:scale-125" />
            <div className="w-12 h-12 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center mb-4 shadow-sm">
              <Network size={24} />
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-2">Onboard Kafka Topic</h3>
            <p className="text-sm text-on-surface-variant mb-4">
              Connect to a Kafka broker, extract schema from live messages, and configure DQ.
            </p>
            <div className="flex items-center text-sm font-semibold text-on-surface group-hover:underline">
              Start Wizard <ArrowRight size={16} className="ml-1" />
            </div>
          </AnimatedCard>

          <AnimatedCard 
            delay={0.5}
            onClick={() => router.push('/manage')}
            className="p-6 group relative overflow-hidden bg-surface-container hover:bg-surface-container-high transition-colors border-none"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-container rounded-bl-full -z-10 transition-transform duration-500 ease-out origin-top-right transform-gpu group-hover:scale-125" />
            <div className="w-12 h-12 rounded-lg bg-tertiary-container text-on-tertiary-container flex items-center justify-center mb-4 shadow-sm">
              <Settings size={24} />
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-2">Manage Rules</h3>
            <p className="text-sm text-on-surface-variant mb-4">
              View existing pipelines and toggle Data Quality rules on or off dynamically.
            </p>
            <div className="flex items-center text-sm font-semibold text-tertiary group-hover:underline">
              Manage DQ <ArrowRight size={16} className="ml-1" />
            </div>
          </AnimatedCard>
        </div>
      </div>
    </div>
  )
}
