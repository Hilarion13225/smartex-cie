import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAppStore } from '../stores/app'
import { Button, CieLogo, FullScreenLoader, PageHeader } from '../components/ui'

export function Welcome() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const setCustomer = useAppStore((s) => s.setCustomer)
  const notify = useAppStore((s) => s.notify)

  const login = async () => {
    setLoading(true)
    const c = await api.login(phone || '07 08 56 78 90', 'demo')
    setCustomer(c)
    setLoading(false)
    notify('Connexion réussie', `Bienvenue ${c.firstName} !`, 'SUCCESS')
    navigate('/app')
  }

  return (
    <div className="min-h-full max-w-md mx-auto bg-gradient-to-b from-cie-50 via-white to-cie-100 flex flex-col px-6 pt-20 pb-10">
      {loading && <FullScreenLoader title="Connexion sécurisée" subtitle="Vérification de vos informations..." />}
      <div className="flex-1 flex flex-col items-center text-center">
        <CieLogo size="lg" />
        <h1 className="text-3xl font-extrabold text-gray-900 mt-8">Bienvenue !</h1>
        <p className="text-gray-500 mt-2">Gérez votre compteur où que vous soyez</p>
        <div className="w-full mt-10 space-y-3">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Numéro de téléphone"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-cie-500"
          />
          <Button onClick={login} className="w-full">Continuer</Button>
          <div className="text-xs text-gray-400">ou</div>
          <Button onClick={login} variant="secondary" className="w-full">Se connecter avec email</Button>
        </div>
      </div>
      <p className="text-center text-sm text-gray-500">
        Vous n’avez pas de compte ? <Link to="/inscription" className="text-cie-600 font-semibold">S’inscrire</Link>
      </p>
      <p className="text-center text-[10px] text-gray-400 mt-4">PoC — authentification simulée (MOCK)</p>
    </div>
  )
}

const steps = ['Identité', 'Compteur', 'Sécurité', 'Vérification']

export function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    lastName: 'KOUADIO', firstName: 'Jean', phone: '07 08 56 78 90', email: 'jean.kouadio@email.com',
    meterId: 'MTR-458921', contractId: 'CTR-2021-88412', password: '', confirm: '',
  })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const next = async () => {
    if (step === 2) {
      setLoading(true)
      await api.register({ ...form })
      setLoading(false)
      navigate('/verification')
      return
    }
    setStep(step + 1)
  }

  const input = (label: string, key: keyof typeof form, type = 'text') => (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cie-500"
      />
    </label>
  )

  return (
    <div className="min-h-full max-w-md mx-auto bg-[#f6f8fa]">
      {loading && <FullScreenLoader title="Création du compte" subtitle="Envoi du code de vérification..." />}
      <PageHeader title="Inscription" onBack={() => (step > 0 ? setStep(step - 1) : navigate('/'))} />
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-6">
          {steps.map((s, i) => (
            <div key={s} className="flex-1 flex items-center">
              <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${i <= step ? 'bg-cie-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{i + 1}</div>
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${i < step ? 'bg-cie-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
        <div className="space-y-4 animate-slide-up" key={step}>
          {step === 0 && (
            <>
              {input('Nom complet', 'lastName')}
              {input('Prénom', 'firstName')}
              {input('Téléphone', 'phone')}
              {input('Email', 'email', 'email')}
            </>
          )}
          {step === 1 && (
            <>
              {input('Numéro de compteur', 'meterId')}
              {input('Identifiant contrat', 'contractId')}
              <p className="text-xs text-gray-400">Le numéro de compteur permet de rattacher votre compte à votre installation.</p>
            </>
          )}
          {step === 2 && (
            <>
              {input('Mot de passe', 'password', 'password')}
              {input('Confirmer le mot de passe', 'confirm', 'password')}
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" defaultChecked className="accent-cie-600" />
                J’accepte les <span className="text-cie-600">Conditions d’utilisation</span>
              </label>
            </>
          )}
        </div>
        <Button onClick={next} className="w-full mt-8">Suivant</Button>
      </div>
    </div>
  )
}

export function Otp() {
  const navigate = useNavigate()
  const setCustomer = useAppStore((s) => s.setCustomer)
  const notify = useAppStore((s) => s.notify)
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(45)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [])

  const setDigit = (i: number, v: string) => {
    const d = [...digits]
    d[i] = v.slice(-1)
    setDigits(d)
    if (v && i < 5) refs.current[i + 1]?.focus()
  }

  const verify = async () => {
    setLoading(true)
    try {
      const { customer } = await api.verifyOtp(digits.join('') || '264719')
      setCustomer(customer)
      notify('Compte vérifié', 'Votre compteur est associé à votre compte.', 'SUCCESS')
      navigate('/app')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full max-w-md mx-auto bg-[#f6f8fa]">
      {loading && <FullScreenLoader title="Vérification du code" subtitle="Association de votre compteur..." />}
      <PageHeader title="Vérification" onBack={() => navigate(-1)} />
      <div className="px-6 py-10 text-center">
        <div className="text-5xl">📲</div>
        <p className="mt-6 text-sm text-gray-600">Nous avons envoyé un code OTP au<br /><b>07 08 56 78 90</b></p>
        <p className="text-xs text-gray-400 mt-4 mb-2">Code de vérification (simulé)</p>
        <div className="flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              inputMode="numeric"
              className="w-11 h-12 text-center text-lg font-bold rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-cie-500"
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">Renvoyer le code dans 00:{countdown.toString().padStart(2, '0')}</p>
        <Button onClick={verify} className="w-full mt-8">Vérifier</Button>
      </div>
    </div>
  )
}
