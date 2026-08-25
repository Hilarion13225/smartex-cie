import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { Meter } from '../types'

export interface LiveMeterState {
  meter: Meter | null
  // Distingue "en cours de chargement" (meter=null, notFound=false) de "ce compteur
  // n'existe/ne répond pas" (meter=null, notFound=true) -- indispensable depuis
  // l'association Client<->Compteur réelle (voir AuthService.register côté backend) : un
  // client peut être lié à un meterId sans compteur/dongle fonctionnel derrière (rollout
  // réel typique), et l'UI doit le dire honnêtement plutôt qu'un skeleton indéfini.
  notFound: boolean
}

/**
 * Rafraîchit périodiquement un compteur (GET /meters/{id}/status lit l'état vivant du
 * mock-dongle, pas un instantané figé) pour que les écrans reflètent la consommation
 * simulée (voir mock-dongle CONSUMPTION_RATE_FCFA_PER_HOUR) sans que l'utilisateur ait à
 * recharger la page manuellement. Pas de push serveur → client (pas de WebSocket/SSE dans
 * ce PoC) : un polling simple, à intervalle raisonnable pour rester quasi temps réel sans
 * solliciter le backend inutilement. Enchaîne les appels un par un (setTimeout après
 * résolution, pas setInterval) pour ne jamais empiler des requêtes si une réponse tarde.
 */
export function useLiveMeter(meterId: string, intervalMs = 5000): LiveMeterState {
  const [state, setState] = useState<LiveMeterState>({ meter: null, notFound: false })

  useEffect(() => {
    setState({ meter: null, notFound: false }) // évite d'afficher un instant l'ancien compteur si meterId change
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = () => {
      api.getMeter(meterId)
        .then((m) => { if (!cancelled) setState({ meter: m, notFound: false }) })
        .catch(() => {
          // Contrairement à un simple aléa réseau (qui se rattraperait tout seul au
          // prochain tick sans qu'on ait besoin de le signaler), un meterId qui n'existe
          // pas ne se "réparera" pas de lui-même -- mais on continue quand même de
          // réessayer (le compteur peut être provisionné après coup), juste en le disant.
          if (!cancelled) setState((s) => ({ meter: s.meter, notFound: true }))
        })
        .finally(() => { if (!cancelled) timer = setTimeout(tick, intervalMs) })
    }
    tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [meterId, intervalMs])

  return state
}
