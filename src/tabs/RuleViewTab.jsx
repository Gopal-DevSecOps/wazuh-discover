import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import ResultsTable from '../components/ResultsTable'
import Histogram from '../components/Histogram'
import { getAllRules } from '../services/ruleStorage'
import { evaluateAllRules, interpolateMessage } from '../services/ruleEngine'

export default function RuleViewTab() {
  const { total, results, loading, dql, filters, isDark, doSearch } = useApp()
  const [transformed, setTransformed] = useState([])
  const [ruleMatches, setRuleMatches] = useState({})
  const [matchedCount, setMatchedCount] = useState(0)

  useEffect(() => { doSearch() }, [])

  useEffect(() => {
    if (!results.length) {
      setTransformed([]); setRuleMatches({}); setMatchedCount(0)
      return
    }
    const rules = getAllRules().filter(r => r.enabled)
    if (!rules.length) {
      setTransformed(results); setRuleMatches({}); setMatchedCount(0)
      return
    }
    const out = []; const mm = {}; let mc = 0
    results.forEach((doc, idx) => {
      const er = evaluateAllRules(rules, doc)
      if (er.matched) {
        const top = er.matches[0]; const act = top.actions?.[0]
        const sev = act?.params?.severity || 'info'
        const msg = interpolateMessage(act?.params?.message || '', doc)
        const lvl = act?.params?.level
        const d = JSON.parse(JSON.stringify(doc))
        if (top.rule.overwrite) {
          if (lvl != null) d.rule = { ...d.rule, level: lvl }
          if (msg) d.rule = { ...d.rule, description: msg }
        }
        out.push(d)
        mm[idx] = { ruleName: top.rule.name, severity: sev, level: lvl, message: msg, priority: top.rule.priority }
        mc++
      } else {
        out.push(doc)
      }
    })
    setTransformed(out); setRuleMatches(mm); setMatchedCount(mc)
  }, [results])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} className="space-y-2">
      <div className="flex items-center gap-3 px-1 py-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-soc-darkstext' : 'text-soc-stext'}`}>Query</span>
          <span className="text-soc-blue dark:text-blue-400 font-mono">{dql || filters.length ? 'Filtered' : '*'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-soc-darkstext' : 'text-soc-stext'}`}>Total</span>
          <span className="font-bold text-soc-text dark:text-soc-darktext">{total.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-soc-darkstext' : 'text-soc-stext'}`}>Showing</span>
          <span className="text-soc-text dark:text-soc-darktext">{results.length}</span>
        </div>
        {loading && <span className="text-soc-stext dark:text-soc-darkstext">{'\u23F3'} searching...</span>}
        <div className="ml-auto">
          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 ring-1 ring-purple-400/50">
            {'\u2699'} Rules Applied
          </span>
        </div>
      </div>
      {matchedCount > 0 && (
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${isDark ? 'bg-purple-900/10 ring-1 ring-purple-800/30' : 'bg-purple-50 ring-1 ring-purple-200/50'}`}>
          <span className="font-semibold text-purple-700 dark:text-purple-300">{'\u2699'} Rules:</span>
          <span className="text-soc-text dark:text-soc-darktext"><b>{matchedCount}</b>/{results.length} alerts transformed</span>
        </div>
      )}
      {matchedCount === 0 && results.length > 0 && (
        <div className="px-2 py-1.5 text-xs text-soc-stext dark:text-soc-darkstext">No rules matched — showing original data</div>
      )}
      <Histogram />
      <div className="flex gap-3 flex-col lg:flex-row">
        <div className="flex-1 min-w-0">
          <ResultsTable results={transformed} total={total} loading={loading} ruleMatches={ruleMatches} />
        </div>
      </div>
    </motion.div>
  )
}
