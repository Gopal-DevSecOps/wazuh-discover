import React, { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { motion } from 'framer-motion'
import { api } from '../api'
import { useApp } from '../context/AppContext'

const SEV_LABELS = { Critical: { color: '#dc2626', min: 15 }, High: { color: '#ea580c', min: 12 }, Medium: { color: '#ca8a04', min: 7 }, Low: { color: '#059669', min: 1 }, Info: { color: '#0891b2', min: 0 } }
const CHART_COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#c7d2fe']
const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low', 'Info']

function toSeverity(level) {
  const n = parseInt(level) || 0
  for (const s of SEV_ORDER) if (n >= SEV_LABELS[s].min) return s
  return 'Info'
}

export default function SocDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const timerRef = useRef(null)
  const { isDark } = useApp()

  const fetchDashboard = () => {
    api('dashboard', { index: 'wazuh-alerts-4.x-*', start_date: 'now-24h', end_date: 'now' })
      .then(d => { setData(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => { setLoading(false); setLastUpdated(new Date()) })
  }

  useEffect(() => { fetchDashboard(); timerRef.current = setInterval(fetchDashboard, 60000); return () => clearInterval(timerRef.current) }, [])

  if (loading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="gcard p-6"><div className="h-24 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-lg animate-pulse"/></div>)}
    </div>
  )
  if (error) return (
    <div className="p-6 text-center">
      <div className="text-2xl mb-2">{'\u26A0\uFE0F'}</div>
      <div className="text-sm text-[#dc2626] mb-3">{error}</div>
      <button onClick={fetchDashboard} className="gbtn-primary px-4 py-1.5">Retry</button>
    </div>
  )
  if (!data) return null

  const { count24, count7d, count30d, byLevel, topRules, topAgents, timeline, categories, recent, recentTotal } = data

  const sevMap = {}
  for (const b of byLevel) { const s = toSeverity(b.key); sevMap[s] = (sevMap[s] || 0) + b.doc_count }
  const sevData = SEV_ORDER.filter(s => sevMap[s]).map(s => ({ name: s, value: sevMap[s], color: SEV_LABELS[s].color }))
  const sevTotal = sevData.reduce((a, b) => a + b.value, 0)

  const timelineData = (timeline || []).slice(-24).map(b => ({ time: new Date(b.key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), alerts: b.doc_count }))

  const topRulesData = (topRules || []).slice(0, 8).map((b, i) => ({ name: b.key || `Rule ${i+1}`, count: b.doc_count }))
  const topAgentsData = (topAgents || []).slice(0, 8).map(b => ({ name: b.key || 'Unknown', count: b.doc_count }))
  const catData = (categories || []).slice(0, 6).map((b, i) => ({ name: (b.key || 'Other').slice(0, 20), value: b.doc_count, color: CHART_COLORS[i % CHART_COLORS.length] }))
  const maxRule = Math.max(1, ...topRulesData.map(r => r.count))
  const maxAgent = Math.max(1, ...topAgentsData.map(a => a.count))

  const tc = isDark ? '#9ca3af' : '#6b7280'
  const tc2 = isDark ? '#e4e6eb' : '#1a1c23'
  const tbg = isDark ? '#1a1d27' : '#fff'

  const SummaryCard = ({ label, value, prev, suffix }) => {
    const pct = prev ? Math.round(((value - prev) / prev) * 100) : 0
    const isUp = pct > 0
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="gcard p-4">
        <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] dark:text-[#6b7280] font-semibold">{label}</div>
        <div className="text-2xl font-bold text-[#1a1c23] dark:text-[#e4e6eb] mt-1">{value?.toLocaleString()}{suffix || ''}</div>
        {pct !== 0 && (
          <div className={`text-[10px] font-medium mt-0.5 flex items-center gap-0.5 ${isUp ? 'text-[#dc2626]' : 'text-[#059669]'}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className={isUp ? '' : 'rotate-180'}><path d="M12 5l7 7-1.41 1.41L13 9.83V21h-2V9.83l-4.59 4.58L5 12l7-7z"/></svg>
            {Math.abs(pct)}%
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-3">
        <SummaryCard label="Last 24 Hours" value={count24} prev={count7d / 7} />
        <SummaryCard label="Last 7 Days" value={count7d} prev={count30d / 4} />
        <SummaryCard label="Last 30 Days" value={count30d} />
        <SummaryCard label="Alert Rate" value={Math.round(count24 / 24)} suffix="/hr" />
        <SummaryCard label="Recent Alerts" value={recentTotal} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="gcard p-4 col-span-1">
          <div className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb] mb-3">Alert Severity</div>
          <div className="space-y-2">
            {sevData.map(s => {
              const pct = sevTotal ? Math.round((s.value / sevTotal) * 100) : 0
              return (
                <div key={s.name}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="flex items-center gap-1.5 text-[#1a1c23] dark:text-[#e4e6eb]">
                      <span className="text-sm">{s.name === 'Critical' ? '\uD83D\uDD34' : s.name === 'High' ? '\uD83D\uDFE1' : s.name === 'Medium' ? '\uD83D\uDFE0' : s.name === 'Low' ? '\uD83D\uDFE2' : '\uD83D\uDD35'}</span>
                      <span className="font-medium">{s.name}</span>
                    </span>
                    <span className="font-semibold" style={{ color: s.color }}>{s.value.toLocaleString()} <span className="text-[#9ca3af] dark:text-[#6b7280] font-normal">({pct}%)</span></span>
                  </div>
                  <div className="w-full h-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: pct + '%', backgroundColor: s.color }} />
                  </div>
                </div>
              )
            })}
            {sevData.length === 0 && <div className="text-xs text-[#9ca3af] dark:text-[#6b7280] py-4 text-center">No data</div>}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="gcard p-4 col-span-2">
          <div className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb] mb-2">Alert Timeline (24h)</div>
          <div className="h-40">
            {timelineData.length === 0 ? <div className="text-xs text-[#9ca3af] dark:text-[#6b7280] h-full flex items-center justify-center">No timeline data</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: tc, fontFamily: 'Inter' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: tc, fontFamily: 'Inter' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={{ fontSize: 11, fontFamily: 'Inter', borderRadius: 8, border: '1px solid #e5e7eb', background: tbg }} formatter={v => [v, 'Alerts']} />
                  <Area type="monotone" dataKey="alerts" stroke="#3b82f6" strokeWidth={2} fill="url(#tg)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="gcard p-4">
          <div className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb] mb-2">Top Alert Rules</div>
          {topRulesData.length === 0 ? <div className="text-xs text-[#9ca3af] dark:text-[#6b7280] py-4 text-center">No data</div> : (
            <div className="space-y-1.5">
              {topRulesData.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs group">
                  <span className="w-4 text-center text-[#9ca3af] dark:text-[#6b7280] font-medium shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="truncate text-[#1a1c23] dark:text-[#e4e6eb]">{r.name}</span>
                      <span className="shrink-0 ml-2 font-semibold text-[#3b82f6] dark:text-[#60a5fa]">{r.count.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#3b82f6] dark:bg-[#60a5fa] transition-all duration-700" style={{ width: (r.count / maxRule) * 100 + '%' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="gcard p-4">
          <div className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb] mb-2">Alert Categories</div>
          <div className="h-48 flex items-center justify-center">
            {catData.length === 0 ? <div className="text-xs text-[#9ca3af] dark:text-[#6b7280]">No data</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={catData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={2}>
                    {catData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, fontFamily: 'Inter', borderRadius: 8, border: '1px solid #e5e7eb', background: tbg }} formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-1 justify-center">
            {catData.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] text-[#6b7280] dark:text-[#9ca3af]">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: c.color }} />{c.name}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="gcard p-4">
          <div className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb] mb-2">Top Agents</div>
          {topAgentsData.length === 0 ? <div className="text-xs text-[#9ca3af] dark:text-[#6b7280] py-8 text-center">No data</div> : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topAgentsData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fontFamily: 'Inter', fill: tc }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip contentStyle={{ fontSize: 11, fontFamily: 'Inter', borderRadius: 8, background: tbg }} formatter={v => [v, 'Alerts']} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="gcard p-4">
          <div className="text-xs font-semibold text-[#1a1c23] dark:text-[#e4e6eb] mb-2">Recent Alerts</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[#9ca3af] dark:text-[#6b7280] border-b border-[#e5e7eb] dark:border-[#2d3140]">
                  <th className="text-left font-semibold py-1.5 pr-2">Time</th>
                  <th className="text-left font-semibold py-1.5 px-2">Level</th>
                  <th className="text-left font-semibold py-1.5 px-2">Rule</th>
                  <th className="text-left font-semibold py-1.5 px-2">Agent</th>
                  <th className="text-left font-semibold py-1.5 pl-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {recent.slice(0, 6).map((r, i) => {
                  const lv = r.rule?.level || 0
                  const badgeCls = lv >= 15 ? 'badge-critical' : lv >= 12 ? 'badge-high' : lv >= 7 ? 'badge-medium' : lv >= 1 ? 'badge-low' : 'badge-info'
                  return (
                    <tr key={i} className="border-b border-[#e5e7eb]/50 dark:border-[#2d3140]/50 hover:bg-[#f9fafb]/50 dark:hover:bg-[#1a1d27]/50 transition-colors">
                      <td className="py-1.5 pr-2 font-mono text-[10px] text-[#6b7280] dark:text-[#9ca3af] whitespace-nowrap">{r['@timestamp'] ? new Date(r['@timestamp']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                      <td className="py-1.5 px-2"><span className={`${badgeCls} text-[10px]`}>{lv}</span></td>
                      <td className="py-1.5 px-2 text-[#3b82f6] dark:text-[#60a5fa] font-medium">{r.rule?.id || '--'}</td>
                      <td className="py-1.5 px-2 text-[#1a1c23] dark:text-[#e4e6eb]">{r.agent?.name || '--'}</td>
                      <td className="py-1.5 pl-2 text-[#6b7280] dark:text-[#9ca3af] truncate max-w-[200px]">{r.rule?.description || '--'}</td>
                    </tr>
                  )
                })}
                {recent.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-[#9ca3af] dark:text-[#6b7280]">No recent alerts</td></tr>}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      <div className="text-center text-[10px] text-[#9ca3af] dark:text-[#6b7280]">Auto-refreshes every 60s. Last: {lastUpdated.toLocaleTimeString()}</div>
    </div>
  )
}
