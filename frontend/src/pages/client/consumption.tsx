import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api } from '../../services/api'
import type { ConsumptionPoint } from '../../types'
import { Card, PageHeader, Skeleton } from '../../components/ui'

const periods = ['jour', 'semaine', 'mois', 'trimestre', 'année']

export function ConsumptionPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState('semaine')
  const [data, setData] = useState<ConsumptionPoint[] | null>(null)

  useEffect(() => {
    setData(null)
    api.getConsumption(period).then(setData)
  }, [period])

  const total = data?.reduce((s, p) => s + p.kwh, 0) ?? 0
  const cost = data?.reduce((s, p) => s + p.costFcfa, 0) ?? 0
  const avg = data ? total / data.length : 0
  const peak = data ? Math.max(...data.map((p) => p.kwh)) : 0
  const prev = total * 0.92

  return (
    <div>
      <PageHeader title="Consommation" onBack={() => navigate('/app')} />
      <div className="px-5 py-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap capitalize ${period === p ? 'bg-cie-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
            >
              {p}
            </button>
          ))}
        </div>

        {!data ? (
          <>
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-52 rounded-2xl" />
            <Skeleton className="h-52 rounded-2xl" />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3.5"><p className="text-[11px] text-gray-400">Total</p><p className="font-bold text-lg">{total.toFixed(1)} kWh</p></Card>
              <Card className="p-3.5"><p className="text-[11px] text-gray-400">Coût</p><p className="font-bold text-lg">{Math.round(cost).toLocaleString('fr-FR')} F</p></Card>
              <Card className="p-3.5"><p className="text-[11px] text-gray-400">Moyenne</p><p className="font-bold text-lg">{avg.toFixed(1)} kWh</p></Card>
              <Card className="p-3.5"><p className="text-[11px] text-gray-400">Pic</p><p className="font-bold text-lg">{peak.toFixed(1)} kWh</p></Card>
            </div>

            <Card className="p-4">
              <p className="text-sm font-semibold text-gray-800 mb-1">Consommation (kWh)</p>
              <p className="text-[11px] text-gray-400 mb-3">vs période précédente : {prev.toFixed(1)} kWh (<span className="text-red-500">+8%</span>)</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#16a34a" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip />
                  <Area type="monotone" dataKey="kwh" stroke="#0d9448" fill="url(#g1)" strokeWidth={2} name="kWh" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4">
              <p className="text-sm font-semibold text-gray-800 mb-3">Coût (FCFA)</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip />
                  <Bar dataKey="costFcfa" fill="#f59e0b" radius={[4, 4, 0, 0]} name="FCFA" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4">
              <p className="text-sm font-semibold text-gray-800 mb-3">Tension (V) — anomalies</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[215, 245]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip />
                  <Line type="monotone" dataKey="voltage" stroke="#3b82f6" strokeWidth={2} dot={false} name="V" />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-gray-400 mt-2">Seuil surtension : 250 V — données simulées cohérentes (MOCK)</p>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
