import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAppStore } from '../stores/app'
import { Button, FullScreenLoader, PageHeader } from '../components/ui'

// Mock data (11 chiffres pour méterId)
const MOCK_CUSTOMERS = [
  { phone: '07 08 56 78 90', meterId: '45892123456', firstName: 'Jean', lastName: 'KOUADIO' },
  { phone: '07 12 34 56 78', meterId: '58901234567', firstName: 'Marie', lastName: 'TOLO' },
  { phone: '07 98 76 54 32', meterId: '12345678901', firstName: 'Pierre', lastName: 'DIALLO' },
]

export function Welcome() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'home' | 'login' | 'register'>('home')
  const [loginForm, setLoginForm] = useState({ meterId: '45892123456', phone: '0708567890' })
  const [loading, setLoading] = useState(false)
  const setCustomer = useAppStore((s) => s.setCustomer)
  const notify = useAppStore((s) => s.notify)

  const handleLogin = async () => {
    // Validation des champs
    if (!loginForm.meterId.trim()) {
      notify('Erreur', 'Veuillez entrer votre numéro de compteur', 'WARNING')
      return
    }
    if (!loginForm.phone.trim()) {
      notify('Erreur', 'Veuillez entrer votre numéro de téléphone', 'WARNING')
      return
    }

    // Format validation (11 chiffres pour méterId)
    const isValidMeter = /^[0-9]{11}$/.test(loginForm.meterId.replace(/\s/g, ''))
    const isValidPhone = /^[0-9]{10,}$/.test(loginForm.phone.replace(/\s/g, ''))
    if (!isValidMeter || !isValidPhone) {
      notify('Erreur', 'Format invalide: 11 chiffres pour compteur, 10+ pour téléphone', 'WARNING')
      return
    }

    setLoading(true)
    const customer = MOCK_CUSTOMERS.find(
      (c) => c.meterId === loginForm.meterId.replace(/\s/g, '') &&
             c.phone.replace(/\s/g, '') === loginForm.phone.replace(/\s/g, '')
    )
    if (customer) {
      setCustomer(customer)
      notify('Connexion réussie', `Bienvenue ${customer.firstName} !`, 'SUCCESS')
      setTimeout(() => navigate('/verification'), 1500)
    } else {
      notify('Erreur', 'Identifiants incorrects - Vérifiez MTR et téléphone', 'WARNING')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-full max-w-md mx-auto bg-gradient-to-b from-cie-50 via-white to-cie-100 flex flex-col px-6 pt-12 pb-10">
      {loading && <FullScreenLoader title="Vérification..." />}

      {mode === 'home' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-8">
          <img src="/logos/cie-logo.jpg" alt="CIE" className="h-24 object-contain" />
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Bienvenue !</h1>
            <p className="text-gray-500 mt-2">Gérez votre compteur intelligent</p>
          </div>
          <div className="w-full space-y-3">
            <Button onClick={() => setMode('login')} className="w-full">Connexion</Button>
            <Button onClick={() => setMode('register')} variant="secondary" className="w-full">Créer un compte</Button>
          </div>
        </div>
      )}

      {mode === 'login' && (
        <div className="flex-1 flex flex-col justify-center">
          <PageHeader title="Connexion" onBack={() => setMode('home')} />
          <div className="px-4 py-5 space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-2">Numéro de compteur</label>
              <input
                value={loginForm.meterId}
                onChange={(e) => setLoginForm({ ...loginForm, meterId: e.target.value })}
                placeholder="MTR-458921"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cie-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Numéro de téléphone</label>
              <input
                value={loginForm.phone}
                onChange={(e) => setLoginForm({ ...loginForm, phone: e.target.value })}
                placeholder="07 08 56 78 90"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cie-500"
              />
            </div>
            <p className="text-xs text-gray-400 text-center">Ex: 45892123456 / 0708567890</p>
            <Button onClick={handleLogin} disabled={loading} className="w-full mt-6">Continuer</Button>
          </div>
        </div>
      )}

      {mode === 'register' && <Register onBack={() => setMode('home')} />}

      {mode === 'home' && (
        <p className="text-center text-[10px] text-gray-400 mt-4">Gestion intelligente d'électricité prépayée</p>
      )}
    </div>
  )
}

const steps = ['Identité', 'Compteur', 'Sécurité', 'Vérification']

export function Register({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    lastName: 'TOLO',
    firstName: 'Marie',
    phone: '07 12 34 56 78',
    email: 'marie.tolo@email.com',
    meterId: '58901234567',
    contractId: '1234567890',
    password: 'Test@1234',
    confirm: 'Test@1234',
  })
  const notify = useAppStore((s) => s.notify)
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // Validations
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isValidPhone = (phone: string) => /^[0-9]{10,}$/.test(phone.replace(/\s/g, ''))
  const isValidMeterId = (id: string) => /^[0-9]{11}$/.test(id.replace(/\s/g, ''))
  const isValidContractId = (id: string) => /^[0-9]{10,}$/.test(id.replace(/\s/g, ''))

  const isStrongPassword = (pwd: string) => {
    if (pwd.length < 8) return false
    const hasUpper = /[A-Z]/.test(pwd)
    const hasLower = /[a-z]/.test(pwd)
    const hasNumber = /\d/.test(pwd)
    const hasSpecial = /[!@#$%^&*]/.test(pwd)
    return hasUpper && hasLower && hasNumber && hasSpecial
  }

  const validateStep = () => {
    if (step === 0) {
      if (!form.firstName.trim()) return 'Prénom requis'
      if (!form.lastName.trim()) return 'Nom requis'
      if (!isValidPhone(form.phone)) return 'Téléphone invalide (10 chiffres min)'
      if (!isValidEmail(form.email)) return 'Email invalide'
    }
    if (step === 1) {
      if (!isValidMeterId(form.meterId)) return 'Numéro de compteur: 11 chiffres'
      if (!isValidContractId(form.contractId)) return 'Numéro de contrat: 10+ chiffres'
    }
    if (step === 2) {
      if (!form.password) return 'Mot de passe requis'
      if (!isStrongPassword(form.password)) {
        return 'Mot de passe: 8+ caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 symbole (!@#$%^&*)'
      }
      if (!form.confirm) return 'Confirmez votre mot de passe'
      if (form.password !== form.confirm) return 'Les mots de passe ne correspondent pas'
    }
    return null
  }

  const next = async () => {
    const error = validateStep()
    if (error) {
      notify('Erreur', error, 'WARNING')
      return
    }
    if (step === 2) {
      setLoading(true)
      await api.register({ ...form })
      setLoading(false)
      notify('Inscription réussie', 'Vérifiez votre code OTP', 'SUCCESS')
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
    <div className="flex-1 flex flex-col">
      <PageHeader title="Inscription" onBack={() => (step > 0 ? setStep(step - 1) : onBack())} />
      {loading && <FullScreenLoader title="Création du compte..." />}
      <div className="px-6 py-5 flex-1">
        <div className="flex items-center justify-between mb-6">
          {steps.map((s, i) => (
            <div key={s} className="flex-1 flex items-center">
              <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${i <= step ? 'bg-cie-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{i + 1}</div>
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${i < step ? 'bg-cie-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
        <div className="space-y-4" key={step}>
          {step === 0 && (
            <>
              {input('Prénom', 'firstName')}
              {input('Nom', 'lastName')}
              {input('Téléphone', 'phone')}
              {input('Email', 'email', 'email')}
            </>
          )}
          {step === 1 && (
            <>
              {input('Numéro de compteur', 'meterId')}
              {input('Numéro de contrat', 'contractId')}
            </>
          )}
          {step === 2 && (
            <>
              {input('Mot de passe', 'password', 'password')}
              {form.password && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg text-xs space-y-1">
                  <p className={form.password.length >= 8 ? 'text-green-600' : 'text-gray-500'}>
                    {form.password.length >= 8 ? '✓' : '○'} Au moins 8 caractères
                  </p>
                  <p className={/[A-Z]/.test(form.password) ? 'text-green-600' : 'text-gray-500'}>
                    {/[A-Z]/.test(form.password) ? '✓' : '○'} Une lettre majuscule
                  </p>
                  <p className={/[a-z]/.test(form.password) ? 'text-green-600' : 'text-gray-500'}>
                    {/[a-z]/.test(form.password) ? '✓' : '○'} Une lettre minuscule
                  </p>
                  <p className={/\d/.test(form.password) ? 'text-green-600' : 'text-gray-500'}>
                    {/\d/.test(form.password) ? '✓' : '○'} Un chiffre
                  </p>
                  <p className={/[!@#$%^&*]/.test(form.password) ? 'text-green-600' : 'text-gray-500'}>
                    {/[!@#$%^&*]/.test(form.password) ? '✓' : '○'} Un symbole (!@#$%^&*)
                  </p>
                </div>
              )}
              {input('Confirmer', 'confirm', 'password')}
              {form.confirm && form.password !== form.confirm && (
                <p className="text-xs text-red-600">Les mots de passe ne correspondent pas</p>
              )}
              {form.password === form.confirm && form.password && (
                <p className="text-xs text-green-600">✓ Les mots de passe correspondent</p>
              )}
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" defaultChecked className="accent-cie-600" />
                J'accepte les conditions d'utilisation
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
  const customer = useAppStore((s) => s.customer)
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
      const { customer: c } = await api.verifyOtp(digits.join('') || '264719')
      setCustomer(c)
      notify('Compte activé', 'Votre compteur est prêt', 'SUCCESS')
      setTimeout(() => navigate('/app'), 1500)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full max-w-md mx-auto bg-[#f6f8fa]">
      {loading && <FullScreenLoader title="Vérification..." />}
      <PageHeader title="Vérification" onBack={() => navigate(-1)} />
      <div className="px-6 py-10 text-center">
        <div className="text-5xl">📲</div>
        <p className="mt-6 text-sm text-gray-600">Code OTP envoyé au<br /><b>{customer?.phone || '07 08 56 78 90'}</b></p>
        <p className="text-xs text-gray-400 mt-4 mb-2">Saisissez les 6 chiffres</p>
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
        <p className="text-xs text-gray-400 mt-4">00:{countdown.toString().padStart(2, '0')}</p>
        <Button onClick={verify} className="w-full mt-8">Vérifier</Button>
      </div>
    </div>
  )
}
