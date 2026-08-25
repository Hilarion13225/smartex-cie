// Client HTTP pour RealApiAdapter — attache automatiquement le JWT (Authorization: Bearer)
// aux appels qui en ont besoin, et centralise la gestion des erreurs 401/403.

import { useAppStore } from '../stores/app'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  // false pour les endpoints ouverts (auth/**, meters/**, payments/callback, devices/**) :
  // évite d'envoyer un Authorization inutile et, surtout, évite de déclencher la
  // déconnexion automatique sur 401 pour un appel qui n'est pas censé en avoir un.
  auth?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = useAppStore.getState().token
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Impossible de joindre le serveur — vérifiez votre connexion.')
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const data = text ? JSON.parse(text) : undefined

  if (!response.ok) {
    const message: string = data?.message || `Erreur ${response.status}`
    const code: string | undefined = data?.code

    // 401 sur un appel authentifié = session invalide (absente/expirée/rejetée) :
    // reconnexion nécessaire, pas la peine de laisser chaque page réinventer ce cas.
    // 403 n'est PAS traité ici : la session reste valide, seul le rôle est insuffisant —
    // c'est à l'appelant (ex: AdminAudit) de décider quoi afficher.
    if (response.status === 401 && auth) {
      useAppStore.getState().clearSession()
    }

    throw new ApiError(response.status, message, code)
  }

  return data as T
}

export const http = {
  get: <T>(path: string, auth = true) => request<T>(path, { method: 'GET', auth }),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: 'POST', body, auth }),
  put: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: 'PUT', body, auth }),
  patch: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: 'PATCH', body, auth }),
  delete: <T>(path: string, auth = true) => request<T>(path, { method: 'DELETE', auth }),
}
