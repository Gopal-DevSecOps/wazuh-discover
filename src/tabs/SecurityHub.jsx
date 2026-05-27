import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { api } from '../api'
import { useApp } from '../context/AppContext'
import { parseDateStr, formatPretty } from '../utils'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const QUICK_TIMES = [
  { label: '15m', value: 'now-15m' },
  { label: '1h', value: 'now-1h' },
  { label: '6h', value: 'now-6h' },
  { label: '24h', value: 'now-24h' },
  { label: '7d', value: 'now-7d' },
  { label: '30d', value: 'now-30d' }
]

const SEV_CONFIG = [
  { key: 'critical', label: 'Critical', range: 'rule.level:>=12', color: '#dc2626', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/30', text: 'text-[#dc2626] dark:text-red-400', icon: '\uD83D\uDD34' },
  { key: 'high', label: 'High', range: 'rule.level:[7 TO 11]', color: '#ea580c', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/30', text: 'text-[#ea580c] dark:text-orange-400', icon: '\uD83D\uDFE1' },
  { key: 'medium', label: 'Medium', range: 'rule.level:[3 TO 6]', color: '#ca8a04', bg: 'bg-yellow-50 dark:bg-yellow-500/10', border: 'border-yellow-200 dark:border-yellow-500/30', text: 'text-[#ca8a04] dark:text-yellow-400', icon: '\uD83D\uDFE0' },
  { key: 'low', label: 'Low', range: 'rule.level:[1 TO 2]', color: '#16a34a', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/30', text: 'text-[#16a34a] dark:text-green-400', icon: '\uD83D\uDFE2' }
]

const WINDOWS_EVENTS = [
  { id: 4624, label: 'Successful Logon', query: 'rule.groups:authentication_success OR data.win.system.eventID:4624' },
  { id: 4625, label: 'Failed Logon', query: 'rule.groups:authentication_failed OR data.win.system.eventID:4625' },
  { id: 4672, label: 'Admin Logon', query: 'data.win.system.eventID:4672' },
  { id: 4688, label: 'Process Created', query: 'data.win.system.eventID:4688' },
  { id: 4719, label: 'Audit Policy Changed', query: 'data.win.system.eventID:4719' },
  { id: 4720, label: 'User Account Created', query: 'data.win.system.eventID:4720' },
  { id: 4728, label: 'Group Member Added', query: 'data.win.system.eventID:4728' },
  { id: 4740, label: 'Account Lockout', query: 'data.win.system.eventID:4740' },
  { id: 1102, label: 'Log Cleared', query: 'data.win.system.eventID:1102' },
  { id: 7045, label: 'Service Installed', query: 'data.win.system.eventID:7045' }
]

const SEV_EVENT_COLORS = { critical: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#16a34a', info: '#2563eb' }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[#9ca3af] dark:text-[#6b7280] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <span className="font-semibold text-[#1a1c23] dark:text-white">{p.value?.toLocaleString() || p.value}</span></p>
      ))}
    </div>
  )
}

export default function SecurityHub() {
  const { addFilter } = useApp()
  const [timeRange, setTimeRange] = useState('now-24h')
  const [data, setData] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [drillFilters, setDrillFilters] = useState([])
  const [drillResults, setDrillResults] = useState(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const intervalRef = useRef(null)

  const timeParams = useCallback(() => {
    const sd = parseDateStr(timeRange).toISOString()
    const ed = parseDateStr('now').toISOString()
    return { start_date: sd, end_date: ed }
  }, [timeRange])

  const fetchSummary = useCallback(async () => {
    try {
      const tp = timeParams()
      const base = { start_date: tp.start_date, end_date: tp.end_date }
      const safe = (p) => p.catch(() => null)

      const [totalRes, timelineRes, agentsRes, rulesRes, recentRes, ...sevRes] = await Promise.all([
        safe(api('search', { ...base, size: 0, q: '*' })),
        safe(api('aggregate', { ...base, field: '@timestamp', type: 'date_histogram', interval: '1h', limit: 48 })),
        safe(api('search', { ...base, size: 0, q: '*', aggs: JSON.stringify({ agents: { terms: { field: 'agent.name.keyword', size: 10 } } }) })),
        safe(api('search', { ...base, size: 0, q: '*', aggs: JSON.stringify({ rules: { terms: { field: 'rule.level', size: 10 } } }) })),
        safe(api('search', { ...base, size: 10, sort: '@timestamp:desc' })),
        ...SEV_CONFIG.map(s => safe(api('search', { ...base, size: 0, q: s.range })))
      ])

      const eventResults = await Promise.all(
        WINDOWS_EVENTS.map(e => safe(api('search', { ...base, size: 0, q: e.query })))
      )
      const eventCounts = {}
      WINDOWS_EVENTS.forEach((e, i) => { eventCounts[e.id] = eventResults[i]?.total || 0 })

      let agents = []
      if (agentsRes) {
        try {
          const a = typeof agentsRes.aggregations === 'string' ? JSON.parse(agentsRes.aggregations) : agentsRes.aggregations
          agents = (a?.agents?.buckets || []).slice(0, 8)
        } catch { agents = [] }
      }
      let rules = []
      if (rulesRes) {
        try {
          const r = typeof rulesRes.aggregations === 'string' ? JSON.parse(rulesRes.aggregations) : rulesRes.aggregations
          rules = (r?.rules?.buckets || []).slice(0, 8)
        } catch { rules = [] }
      }
      const sevCounts = {}
      SEV_CONFIG.forEach((s, i) => { sevCounts[s.key] = sevRes[i]?.total || 0 })

      setSummary({
        total: totalRes?.total || 0,
        severity: sevCounts,
        timeline: timelineRes?.buckets ? timelineRes.buckets.map(b => ({ time: new Date(b.key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), alerts: b.doc_count || 0 })) : [],
        agents,
        rules,
        events: eventCounts,
        recent: (recentRes?.results || []).slice(0, 10)
      })
    } catch { }
  }, [timeParams])

  useEffect(() => {
    setLoading(true)
    fetchSummary()
    intervalRef.current = setInterval(fetchSummary, 30000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchSummary])

  useEffect(() => {
    if (summary) setLoading(false)
  }, [summary])

  const addDrill = useCallback(async (field, value) => {
    const filter = { field, value }
    setDrillFilters(prev => {
      const exists = prev.find(f => f.field === field && f.value === value)
      if (exists) return prev
      return [...prev, filter]
    })
    setDrillLoading(true)
    try {
      const tp = timeParams()
      const q = drillFilters.concat([filter]).map(f => {
        const val = /^\d+(\.\d+)?$/.test(String(f.value)) ? f.value : `"${f.value}"`
        return `${f.field}:${val}`
      }).join(' AND ')
      const res = await api('search', { start_date: tp.start_date, end_date: tp.end_date, q, size: 50, sort: '@timestamp:desc' })
      setDrillResults(res)
    } catch { }
    setDrillLoading(false)
  }, [timeParams, drillFilters])

  const removeDrill = useCallback(async (idx) => {
    const updated = drillFilters.filter((_, i) => i !== idx)
    setDrillFilters(updated)
    setDrillLoading(true)
    try {
      const tp = timeParams()
      if (updated.length === 0) {
        setDrillResults(null)
        setDrillLoading(false)
        return
      }
      const q = updated.map(f => {
        const val = /^\d+(\.\d+)?$/.test(String(f.value)) ? f.value : `"${f.value}"`
        return `${f.field}:${val}`
      }).join(' AND ')
      const res = await api('search', { start_date: tp.start_date, end_date: tp.end_date, q, size: 50, sort: '@timestamp:desc' })
      setDrillResults(res)
    } catch { }
    setDrillLoading(false)
  }, [timeParams, drillFilters])

  const clearDrills = () => { setDrillFilters([]); setDrillResults(null) }

  const navToDiscover = (field, value) => { addFilter(field, value, false) }

  const sevTotal = summary ? Object.values(summary.severity).reduce((a, b) => a + b, 0) : 0
  const severityPie = summary ? Object.entries(summary.severity).map(([k, v]) => {
    const cfg = SEV_CONFIG.find(s => s.key === k)
    return { name: cfg.label, value: v, color: cfg.color }
  }).filter(d => d.value > 0) : []
  const maxAgentCount = summary?.agents?.length ? Math.max(...summary.agents.map(a => a.doc_count)) : 1

  return (
    <div className="space-y-3 pb-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="gcard px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex w-1.5 h-1.5"><span className="absolute inset-0 rounded-full animate-ping opacity-40 bg-[#22c55e]" /><span className="absolute inset-0 rounded-full bg-[#22c55e]" /></span>
          <span className="text-sm font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">{'\uD83D\uDEE1\uFE0F'} Security Hub</span>
          <span className="gchip text-[9px]">Drill-Down</span>
          {summary && <span className="text-[10px] text-[#9ca3af] dark:text-[#6b7280]">{(summary.total || 0).toLocaleString()} alerts</span>}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {QUICK_TIMES.map(qt => (
            <button key={qt.value} onClick={() => setTimeRange(qt.value)}
              className={'gbtn text-[10px] px-2 py-1 ' + (timeRange === qt.value ? 'gbtn-primary' : 'gbtn-ghost')}>
              {qt.label}
            </button>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {[
          { label: 'Total', key: 'total', color: '#3b82f6', icon: '\uD83D\uDD35' },
          ...SEV_CONFIG.map(s => ({ label: s.label, key: s.key, color: s.color, icon: s.icon }))
        ].map(item => {
          const val = item.key === 'total' ? summary?.total : summary?.severity?.[item.key]
          const cfg = SEV_CONFIG.find(s => s.key === item.key)
          return (
            <button key={item.key} onClick={() => {
              if (item.key === 'total') return
              addDrill('rule.level', cfg.range)
            }}
              className={'gcard p-3 text-left hover:shadow-md transition-all ' + (item.key !== 'total' ? 'cursor-pointer' : '')}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[11px]">{item.icon}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: item.color }}>{item.label}</span>
              </div>
              {loading ? (
                <div className="h-7 w-16 bg-[#f3f4f6] dark:bg-[#2d3140] rounded animate-pulse" />
              ) : (
                <div className="text-2xl font-bold tracking-tight" style={{ color: item.color }}>{(val || 0).toLocaleString()}</div>
              )}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-3">
          <div className="gcard">
            <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]/60">
              <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Alert Timeline</h3>
            </div>
            {loading ? (
              <div className="h-48 m-4 bg-[#f3f4f6] dark:bg-[#2d3140] rounded animate-pulse" />
            ) : (
              <div className="h-48 px-2 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary?.timeline || []} margin={{ top: 8, right: 12, bottom: 4, left: -20 }}>
                    <defs><linearGradient id="ca" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="alerts" stroke="#3b82f6" strokeWidth={2} fill="url(#ca)" dot={false} activeDot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="gcard h-full flex flex-col p-4">
            <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb] mb-2">Severity</h3>
            {loading ? (
              <div className="flex-1 flex items-center justify-center"><div className="w-32 h-32 rounded-full bg-[#f3f4f6] dark:bg-[#2d3140] animate-pulse" /></div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                {severityPie.length > 0 ? (
                  <>
                    <div className="w-full max-w-[160px]">
                      <ResponsiveContainer width="100%" height={130}>
                        <PieChart>
                          <Pie data={severityPie} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value" style={{ cursor: 'pointer' }}>
                            {severityPie.map((entry, i) => (
                              <Cell key={i} fill={entry.color} stroke="#fff" strokeWidth={2}
                                onClick={() => { const c = SEV_CONFIG.find(s => s.label === entry.name); if (c) addDrill('rule.level', c.range) }} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
                      {severityPie.map(d => {
                        const pct = sevTotal ? ((d.value / sevTotal) * 100).toFixed(1) : 0
                        return (
                          <button key={d.name} onClick={() => { const c = SEV_CONFIG.find(s => s.label === d.name); if (c) addDrill('rule.level', c.range) }}
                            className="flex items-center gap-1 text-[10px] text-[#6b7280] dark:text-[#9ca3af] hover:text-[#1a1c23] dark:hover:text-[#e4e6eb] transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />{d.name} <span className="font-semibold">{pct}%</span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                ) : <span className="text-xs text-[#9ca3af] dark:text-[#6b7280]">No data</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        <div className="xl:col-span-3">
          <div className="gcard">
            <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]/60">
              <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Windows Security Events</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 p-4">
              {WINDOWS_EVENTS.map(ev => {
                const cnt = summary?.events?.[ev.id] || 0
                const sc = SEV_EVENT_COLORS[ev.severity] || '#6b7280'
                return (
                  <button key={ev.id} onClick={() => addDrill('_dql', ev.query)}
                    className="group flex flex-col items-start p-3 rounded-lg border border-[#e5e7eb] dark:border-[#2d3140] bg-white dark:bg-[#1a1d27] hover:bg-[#f9fafb] dark:hover:bg-[#2d3140]/50 hover:border-[#3b82f6]/40 dark:hover:border-[#60a5fa]/40 transition-all text-left hover:shadow-sm">
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-[11px] font-mono font-bold" style={{ color: sc }}>{ev.id}</span>
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="text-[#d1d5db] dark:text-[#4b5563] opacity-0 group-hover:opacity-100 transition-opacity"><path fillRule="evenodd" d="M8 7h3.5a.5.5 0 1 1 0 1H8v3.5a.5.5 0 1 1-1 0V8H3.5a.5.5 0 0 1 0-1H7V3.5a.5.5 0 0 1 1 0V7Z"/></svg>
                    </div>
                    <span className="text-[10px] text-[#6b7280] dark:text-[#9ca3af] leading-tight line-clamp-1 mb-1.5">{ev.label}</span>
                    <span className="text-sm font-bold" style={{ color: sc }}>{cnt.toLocaleString()}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="xl:col-span-2">
          <div className="gcard">
            <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]/60">
              <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Top Agents</h3>
            </div>
            <div className="p-3 space-y-1">
              {(summary?.agents?.length > 0 ? summary.agents : []).map((a, i) => (
                <button key={a.key || i} onClick={() => addDrill('agent.name', a.key)}
                  className="flex items-center gap-2.5 w-full p-2 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]/50 transition-colors group">
                  <span className="text-[9px] font-mono text-[#9ca3af] dark:text-[#6b7280] w-3.5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-[#1a1c23] dark:text-[#e4e6eb] truncate">{a.key}</span>
                      <span className="text-[10px] font-semibold text-[#6b7280] dark:text-[#9ca3af] ml-2">{a.doc_count}</span>
                    </div>
                    <div className="w-full h-1 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-full overflow-hidden">
                      <div className="h-full bg-[#3b82f6] dark:bg-[#60a5fa] rounded-full transition-all duration-700" style={{ width: (a.doc_count / maxAgentCount) * 100 + '%' }} />
                    </div>
                  </div>
                </button>
              ))}
              {(!summary?.agents || summary.agents.length === 0) && <div className="text-center py-6 text-xs text-[#9ca3af] dark:text-[#6b7280]">No agents</div>}
            </div>
          </div>
        </div>
      </div>

      {drillFilters.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="gcard">
          <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Active Drill Filters</h3>
                <span className="gchip text-[9px]">{drillFilters.length}</span>
              </div>
              <button onClick={clearDrills} className="gbtn-ghost text-[10px] text-[#dc2626] dark:text-red-400">Clear All</button>
            </div>
          </div>
          <div className="px-4 py-2 flex flex-wrap gap-1.5">
            {drillFilters.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#eff6ff] dark:bg-[#3b82f6]/10 border border-[#bfdbfe] dark:border-[#3b82f6]/30 text-[10px] text-[#2563eb] dark:text-blue-400">
                <span className="font-medium">{f.field}:</span>
                <span className="truncate max-w-[120px]">{f.value}</span>
                <button onClick={() => removeDrill(i)} className="ml-0.5 hover:text-[#dc2626] transition-colors">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {drillResults !== null && drillFilters.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="gcard">
          <div className="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]/60">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb]">Drill Results</h3>
              <span className="gchip text-[9px]">{(drillResults?.total || 0).toLocaleString()} total</span>
              {drillLoading && <span className="text-[9px] text-[#9ca3af] dark:text-[#6b7280]">{'\u23F3'} loading...</span>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-[#9ca3af] dark:text-[#6b7280] border-b border-[#e5e7eb] dark:border-[#2d3140]/50">
                  <th className="text-left py-2.5 px-4 font-medium w-20">Time</th>
                  <th className="text-left py-2.5 px-3 font-medium w-10">Lvl</th>
                  <th className="text-left py-2.5 px-3 font-medium">Rule</th>
                  <th className="text-left py-2.5 px-3 font-medium hidden sm:table-cell">Agent</th>
                  <th className="text-left py-2.5 px-3 font-medium hidden md:table-cell">Description</th>
                  <th className="text-right py-2.5 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(drillResults?.results || []).map((r, i) => {
                  const lv = parseInt(r?.rule?.level) || 0
                  const badgeCls = lv >= 15 ? 'badge-critical' : lv >= 12 ? 'badge-high' : lv >= 7 ? 'badge-medium' : lv >= 1 ? 'badge-low' : 'badge-info'
                  return (
                    <tr key={r._id || i} className={'border-b border-[#e5e7eb]/50 dark:border-[#2d3140]/30 hover:bg-[#f9fafb]/50 dark:hover:bg-[#2d3140]/30 transition-colors group ' + (i % 2 === 0 ? '' : 'bg-[#f9fafb]/30 dark:bg-[#0f1117]/30')}>
                      <td className="py-2.5 px-4 whitespace-nowrap font-mono text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                        {r['@timestamp'] ? new Date(r['@timestamp']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '\u2014'}
                      </td>
                      <td className="py-2.5 px-3"><span className={'text-[10px] badge ' + badgeCls}>{lv || '\u2014'}</span></td>
                      <td className="py-2.5 px-3">
                        <button onClick={() => addDrill('rule.id', r?.rule?.id)} className="text-[#3b82f6] dark:text-[#60a5fa] hover:underline truncate max-w-[100px] block">
                          {(r?.rule?.id || '').toString()}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 hidden sm:table-cell">
                        <button onClick={() => addDrill('agent.name', r?.agent?.name)} className="text-[#1a1c23] dark:text-[#e4e6eb] hover:text-[#3b82f6] dark:hover:text-[#60a5fa] transition-colors truncate max-w-[100px] block">
                          {r?.agent?.name || '\u2014'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 hidden md:table-cell"><span className="text-[#6b7280] dark:text-[#9ca3af] truncate max-w-[180px] block text-[10px]">{r?.rule?.description || r?.rule?.groups?.[0] || ''}</span></td>
                      <td className="py-2.5 px-4 text-right">
                        <button onClick={() => addDrill('_id', r._id)} className="p-1 rounded hover:bg-[#3b82f6]/20 text-[#9ca3af] dark:text-[#6b7280] hover:text-[#3b82f6] dark:hover:text-[#60a5fa] transition-all" title="Filter by this alert">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M8 7h3.5a.5.5 0 1 1 0 1H8v3.5a.5.5 0 1 1-1 0V8H3.5a.5.5 0 0 1 0-1H7V3.5a.5.5 0 0 1 1 0V7Z"/></svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {(!drillResults?.results || drillResults.results.length === 0) && (
              <div className="text-center py-10 text-xs text-[#9ca3af] dark:text-[#6b7280]">{'\uD83D\uDCC4'} No results</div>
            )}
          </div>
        </motion.div>
      )}

      {drillFilters.length === 0 && (
        <div className="flex items-center justify-center py-8 text-xs text-[#9ca3af] dark:text-[#6b7280] gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/></svg>
          Click any widget above to drill down \u2014 results appear here
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-[#9ca3af] dark:text-[#6b7280] pt-1">
        <span>{'\uD83D\uDEE1\uFE0F'} Security Hub &middot; Drill-down &middot; 30s refresh</span>
        <button onClick={() => { fetchSummary() }} className="gbtn-ghost gap-1 inline-flex items-center">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
          </svg>
          Refresh
        </button>
      </div>
    </div>
  )
}
