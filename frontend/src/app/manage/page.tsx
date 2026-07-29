'use client'

import { useState } from 'react'
import { Settings, Search, Trash2, RotateCcw, Save } from 'lucide-react'
import { AnimatedCard } from '@/components/AnimatedCard'

export default function ManageRules() {
  const [searchType, setSearchType] = useState('file')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [pipelineData, setPipelineData] = useState<any>(null)
  const [rules, setRules] = useState<any[]>([])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery) return

    setIsSearching(true)
    try {
      const endpoint = searchType === 'file' ? `/api/search-file?fileName=${searchQuery}` : `/api/search-topic?topicName=${searchQuery}`
      const res = await fetch(endpoint)
      const data = await res.json()
      
      if (data.src_object_key) {
        setPipelineData(data)
        
        let loadedRules: any[] = []
        if (data.dqRules) {
          loadedRules = data.dqRules.map((r: any) => ({
            dq_column_name: r.dq_column_name,
            dq_rule_name: r.dq_rule_name,
            _active: r.is_dq_active === 1 || r.dq_flag === 1 || r.is_dq_active === '1' || r.dq_flag === '1'
          }))
        } else if (data.existing_rules) {
          Object.keys(data.existing_rules).forEach(col => {
            data.existing_rules[col].forEach((rule: string) => {
              loadedRules.push({
                dq_column_name: col,
                dq_rule_name: rule,
                _active: true
              })
            })
          })
        }
        setRules(loadedRules)
      } else {
        alert("Pipeline not found")
        setPipelineData(null)
      }
    } catch {
      alert("Error searching for pipeline")
      setPipelineData(null)
    } finally {
      setIsSearching(false)
    }
  }

  const toggleRule = (index: number) => {
    const newRules = [...rules]
    newRules[index]._active = !newRules[index]._active
    setRules(newRules)
  }

  const saveChanges = async () => {
    const endpoint = searchType === 'file' ? '/api/update-dq' : '/api/update-kafka-dq'
    
    // Map internal UI state back to API format { src_object_key, dq_rules: { col: [rules] } }
    const dqRulesPayload: Record<string, string[]> = {}
    rules.forEach(r => {
      if (r._active) {
        if (!dqRulesPayload[r.dq_column_name]) dqRulesPayload[r.dq_column_name] = []
        dqRulesPayload[r.dq_column_name].push(r.dq_rule_name)
      }
    })

    const payload = {
      src_object_key: pipelineData.src_object_key,
      dq_rules: dqRulesPayload
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error("Failed")
      alert("Rules updated successfully!")
    } catch (e) {
      alert("Failed to update rules")
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="text-amber-500" /> Manage Pipeline DQ Rules
        </h1>
        <p className="text-muted-foreground mt-2">Search for existing pipelines and toggle rules on/off.</p>
      </div>

      <AnimatedCard className="p-6 mb-8">
        <form onSubmit={handleSearch} className="flex gap-4 items-end">
          <div className="w-1/4">
            <label className="block text-sm font-semibold mb-2">Pipeline Type</label>
            <select 
              className="w-full p-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-amber-500 outline-none"
              value={searchType}
              onChange={e => { setSearchType(e.target.value); setPipelineData(null) }}
            >
              <option value="file">File Source</option>
              <option value="kafka">Kafka Topic</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-semibold mb-2">
              {searchType === 'file' ? 'File Name' : 'Topic Name'}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
              <input 
                type="text" 
                className="w-full p-2 pl-10 border border-border rounded-md bg-background focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder={searchType === 'file' ? "e.g. daily_sales_*.csv" : "e.g. clickstream_events"}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <button 
            type="submit"
            disabled={isSearching || !searchQuery}
            className="bg-amber-500 text-white px-6 py-2 rounded-md font-bold flex items-center gap-2 hover:bg-amber-600 disabled:opacity-50"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>
      </AnimatedCard>

      {pipelineData && (
        <AnimatedCard delay={0.2} className="p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
            <div>
              <h2 className="text-xl font-bold">
                {searchType === 'file' ? pipelineData.source_file_name : pipelineData.topic_name}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Target: <span className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">{pipelineData.tgt_schema_name}.{pipelineData.tgt_table_name}</span>
              </p>
            </div>
            <button 
              onClick={saveChanges}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-semibold flex items-center gap-2 hover:bg-primary/90"
            >
              Save Changes <Save size={18} />
            </button>
          </div>
          
          <div className="bg-muted rounded-lg border border-border overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-background border-b border-border text-sm text-muted-foreground uppercase">
                <tr>
                  <th className="p-3 font-semibold">Field / Column</th>
                  <th className="p-3 font-semibold">DQ Rule</th>
                  <th className="p-3 font-semibold text-right">Status</th>
                  <th className="p-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">No DQ rules found for this pipeline.</td>
                  </tr>
                ) : (
                  rules.map((r, i) => (
                    <tr key={i} className={`border-b border-border last:border-0 transition-colors ${!r._active ? 'bg-muted/50 opacity-60' : 'bg-background/50'}`}>
                      <td className="p-3 font-mono text-sm font-semibold">{r.dq_column_name}</td>
                      <td className="p-3 text-sm">{r.dq_rule_name}</td>
                      <td className="p-3 text-right">
                        <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wider ${r._active ? 'bg-green-100 text-green-700' : 'bg-surface-variant text-on-surface-variant'}`}>
                          {r._active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button 
                          onClick={() => toggleRule(i)}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title={r._active ? 'Disable Rule' : 'Re-enable Rule'}
                        >
                          {r._active ? <Trash2 size={18} className="text-destructive/70 hover:text-destructive" /> : <RotateCcw size={18} />}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AnimatedCard>
      )}
    </div>
  )
}
