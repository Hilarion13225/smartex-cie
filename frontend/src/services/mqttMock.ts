// mqttMockService — simule le flux IoT (MQTT) côté frontend.
// Le navigateur ne se connecte JAMAIS au broker réel : cette couche mock
// sera remplacée par l'adapter backend (WebSocket/SSE) sans toucher aux pages.

export type MqttEventType =
  | 'METER_CONNECTED'
  | 'TELEMETRY_RECEIVED'
  | 'CREDIT_UPDATED'
  | 'LOW_CREDIT'
  | 'OVERVOLTAGE'
  | 'COMMAND_SENT'
  | 'COMMAND_ACK'
  | 'METER_OFFLINE'
  | 'METER_RECONNECTED'
  | 'INJECTION_FAILED'

export interface MqttEvent {
  type: MqttEventType
  meterId: string
  payload?: Record<string, unknown>
  timestamp: string
}

type Listener = (event: MqttEvent) => void

class MqttMockService {
  private listeners = new Set<Listener>()

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  emit(type: MqttEventType, meterId: string, payload?: Record<string, unknown>) {
    const event: MqttEvent = { type, meterId, payload, timestamp: new Date().toISOString() }
    this.listeners.forEach((l) => l(event))
  }

  // Séquence complète de recharge : commande → ACK
  simulateCommandFlow(meterId: string, commandId: string, ok = true) {
    this.emit('COMMAND_SENT', meterId, { commandId })
    setTimeout(() => {
      if (ok) this.emit('COMMAND_ACK', meterId, { commandId, status: 'ACCEPTED' })
      else this.emit('INJECTION_FAILED', meterId, { commandId, status: 'REJECTED' })
    }, 1800)
  }
}

export const mqttMock = new MqttMockService()
