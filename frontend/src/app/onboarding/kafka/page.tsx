'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Save, Database, Table as TableIcon, Key, Network, Cable, Braces } from 'lucide-react'
import { AnimatedCard } from '@/components/AnimatedCard'

export default function KafkaOnboarding() {
  const [step, setStep] = useState(1)
  const [schemas, setSchemas] = useState<string[]>([])
  const [tables, setTables] = useState<string[]>([])
  
  const [formData, setFormData] = useState({
    sourceSystem: '',
    topicName: '',
    brokerUri: '',
    messageFormat: 'JSON',
    targetSchema: '',
    targetTable: '',
    primaryKey: '',
  })
  
  const [fields, setFields] = useState<{name: string, dqRules: string[]}[]>([])
  const [availableDqChecks, setAvailableDqChecks] = useState<string[]>([])
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/schemas')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSchemas(data.map((s: any) => s.schema_name))
        } else {
          setSchemas([])
        }
      })
      .catch(err => console.error("Could not load schemas", err))

    fetch('/api/dq-checks')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAvailableDqChecks(data.map((d: any) => d.dq_name))
        }
      })
      .catch(err => console.error("Could not load DQ checks:", err))
  }, [])

  const handleSchemaChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const schema = e.target.value
    setFormData({ ...formData, targetSchema: schema, targetTable: '', primaryKey: '' })
    if (!schema) return
    const res = await fetch(`/api/tables?schemaName=${schema}`)
    const data = await res.json()
    setTables(Array.isArray(data) ? data.map((t: any) => t.table_name) : [])
  }

  const handleTableChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const table = e.target.value
    setFormData({ ...formData, targetTable: table })
    if (!table) return
    const res = await fetch(`/api/primary-key?schemaName=${formData.targetSchema}&tableName=${table}`)
    const data = await res.json()
    if (data.primaryKey) {
      setFormData(prev => ({ ...prev, primaryKey: data.primaryKey === 'NO_PRIMARY_KEY' ? '' : data.primaryKey }))
    }
  }

  const testConnection = async (e: React.MouseEvent) => {
    e.preventDefault()
    setIsTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/test-kafka-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          brokers: formData.brokerUri, 
          // add authType etc if needed in future, currently not in UI
        })
      })
      if (!res.ok) throw new Error("Failed")
      setTestResult(true)
    } catch {
      setTestResult(false)
    } finally {
      setIsTesting(false)
    }
  }

  const discoverSchema = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/fetch-kafka-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          brokers: formData.brokerUri, 
          topicName: formData.topicName,
          format: formData.messageFormat
        })
      })
      const data = await res.json()
      if (data.columns) {
        setFields(data.columns.map((c: string) => ({ name: c, dqRules: [] })))
        setStep(3)
      } else {
        alert("Failed to parse schema: " + (data.error || "Unknown error"))
      }
    } catch {
      alert("Error fetching schema. Make sure backend and Kafka broker are running.")
    }
  }

  const toggleDqRule = (fieldIndex: number, rule: string) => {
    const newFields = [...fields]
    const currentRules = newFields[fieldIndex].dqRules
    if (currentRules.includes(rule)) {
      newFields[fieldIndex].dqRules = currentRules.filter(r => r !== rule)
    } else {
      newFields[fieldIndex].dqRules = [...currentRules, rule]
    }
    setFields(newFields)
  }

  const deployPipeline = async () => {
    const dqRulesPayload: Record<string, string[]> = {}
    let hasRules = false
    fields.forEach(f => {
      if (f.dqRules.length > 0) {
        dqRulesPayload[f.name] = f.dqRules
        hasRules = true
      }
    })

    const payload = {
      metadata: {
        source_system_name: formData.sourceSystem,
        topic_name: formData.topicName,
        message_format: formData.messageFormat,
        target_table_schema: formData.targetSchema,
        target_table_name: formData.targetTable,
        primary_key_column: formData.primaryKey,
        dq_enable_flag: hasRules,
        source_fields: fields.map(f => f.name).join(',')
      },
      dq_rules: dqRulesPayload
    }

    try {
      const res = await fetch('/api/kafka-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error("Failed to deploy")
      alert("Pipeline deployed successfully!")
    } catch (e) {
      alert("Error deploying pipeline. Make sure backend is running.")
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Network className="text-secondary" /> Kafka Source Onboarding
        </h1>
        <p className="text-muted-foreground mt-2">Configure a real-time streaming ingestion pipeline.</p>
      </div>

      <div className="flex gap-4 mb-8">
        {[1, 2, 3].map(i => (
          <div key={i} className={`flex-1 h-2 rounded-full ${step >= i ? 'bg-secondary' : 'bg-muted'}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <AnimatedCard className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Database size={20}/> Target Database</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Schema Name</label>
                  <select 
                    className="w-full p-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-secondary outline-none"
                    value={formData.targetSchema}
                    onChange={handleSchemaChange}
                  >
                    <option value="">Select Schema...</option>
                    {schemas.map((s: string) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 flex items-center gap-2"><TableIcon size={16}/> Table Name</label>
                  <select 
                    className="w-full p-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-secondary outline-none"
                    value={formData.targetTable}
                    onChange={handleTableChange}
                    disabled={!formData.targetSchema}
                  >
                    <option value="">Select Table...</option>
                    {tables.map((t: string) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold mb-2 flex items-center gap-2"><Key size={16}/> Primary Key</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border border-border rounded-md bg-muted text-muted-foreground"
                    value={formData.primaryKey}
                    readOnly
                    placeholder="Auto-detected..."
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => setStep(2)}
                  disabled={!formData.targetTable}
                  className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md font-semibold flex items-center gap-2 hover:bg-secondary/90 disabled:opacity-50"
                >
                  Next Step <ArrowRight size={18} />
                </button>
              </div>
            </AnimatedCard>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <AnimatedCard className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Cable size={20} /> Broker Details</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Source System</label>
                    <input 
                      type="text" 
                      className="w-full p-2 border border-border rounded-md bg-background"
                      value={formData.sourceSystem}
                      onChange={e => setFormData({...formData, sourceSystem: e.target.value})}
                      placeholder="e.g. IoT, Clickstream"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Message Format</label>
                    <select 
                      className="w-full p-2 border border-border rounded-md bg-background"
                      value={formData.messageFormat}
                      onChange={e => setFormData({...formData, messageFormat: e.target.value})}
                    >
                      <option value="JSON">JSON</option>
                      <option value="AVRO">AVRO</option>
                      <option value="CSV">CSV</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Broker URI</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border border-border rounded-md bg-background"
                    value={formData.brokerUri}
                    onChange={e => setFormData({...formData, brokerUri: e.target.value})}
                    placeholder="kafka:9092"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Topic Name</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border border-border rounded-md bg-background"
                    value={formData.topicName}
                    onChange={e => setFormData({...formData, topicName: e.target.value})}
                    placeholder="clickstream_events"
                  />
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">Connection Test</p>
                  <p className="text-xs text-muted-foreground">Verify broker connectivity before parsing.</p>
                </div>
                <button 
                  onClick={testConnection}
                  disabled={isTesting || !formData.brokerUri}
                  className="px-4 py-1.5 text-sm rounded bg-background border border-border hover:bg-muted font-medium transition-colors"
                >
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </button>
              </div>

              {testResult !== null && (
                <div className={`mt-2 text-sm font-semibold ${testResult ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult ? '✓ Connection successful' : '✗ Connection failed'}
                </div>
              )}

              <div className="mt-6 flex justify-between">
                <button 
                  onClick={() => setStep(1)}
                  className="text-muted-foreground font-semibold hover:text-foreground"
                >
                  Back
                </button>
                <button 
                  onClick={discoverSchema}
                  className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md font-semibold flex items-center gap-2 hover:bg-secondary/90"
                >
                  Discover Schema <ArrowRight size={18} />
                </button>
              </div>
            </AnimatedCard>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <AnimatedCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2"><Braces size={20} /> Discovered Fields & DQ</h2>
                  <p className="text-sm text-muted-foreground mt-1">Select multiple assertions per field.</p>
                </div>
              </div>
              
              <div className="space-y-4">
                {fields.map((f, i) => (
                  <div key={i} className="p-4 bg-muted/30 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-mono font-bold text-lg">{f.name}</h3>
                      <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                        {f.dqRules.length} Rule{f.dqRules.length !== 1 ? 's' : ''} Active
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableDqChecks.map(rule => {
                        const isActive = f.dqRules.includes(rule)
                        return (
                          <button
                            key={rule}
                            onClick={() => toggleDqRule(i, rule)}
                            className={`px-3 py-1.5 text-sm rounded-full border transition-all ${isActive ? 'bg-primary text-primary-foreground border-primary font-medium' : 'bg-background border-border text-muted-foreground hover:border-muted-foreground'}`}
                          >
                            {rule}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 flex justify-between">
                <button 
                  onClick={() => setStep(2)}
                  className="text-muted-foreground font-semibold hover:text-foreground"
                >
                  Back
                </button>
                <button 
                  onClick={deployPipeline}
                  className="bg-green-600 text-white px-6 py-2 rounded-md font-bold flex items-center gap-2 hover:bg-green-700 shadow-md shadow-green-600/20"
                >
                  Deploy Pipeline <Save size={18} />
                </button>
              </div>
            </AnimatedCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
