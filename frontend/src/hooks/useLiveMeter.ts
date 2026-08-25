import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { Meter } from '../types'

/**
 * Rafraîchit périodiquement un compteur (GET /meters/{id}/status lit l'état vivant du
 * mock-dongle, pas un instantané figé) pour que les écrans reflètent la consommation
 * simulée (voir mock-dongle CONSUMPTION_RATE_FCFA_PER_HOUR) sans que l'utilisateur ait à
 * recharger la page manuellement. Pas de push serveur → client (pas de WebSocket/SSE dans
 * ce PoC) : un polling simple, à intervalle raisonnable pour rester quasi temps réel sans
 * solliciter le backend inutilement. Enchaîne les appels un par un (setTimeout après
 * résolution, pas setInterval) pour ne jamais empiler des requêtes si une réponse tarde.
 */
export function useLiveMeter(meterId: string, intervalMs = 5000): Meter | null {
  const [meter, setMeter] = useState<Meter | null>(null)

  useEffect(() => {
    setMeter(null) // évite d'afficher un instant l'ancien compteur si meterId change
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = () => {
      api.getMeter(meterId)
        .then((m) => { if (!cancelled) setMeter(m) })
        .catch(() => { /* transitoire (réseau/serveur) -- la prochaine tentative se rattrapera */ })
        .finally(() => { if (!cancelled) timer = setTimeout(tick, intervalMs) })
    }
    tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [meterId, intervalMs])

  return meter
}
