// src/app/mqtt.service.ts
// ─────────────────────────────────────────────────────────────
//  MQTT Service für Angular 21 – OHNE externe Library
//  Nutzt natives WebSocket + MQTT 3.1.1 Protokoll direkt
//
//  Sendet:
//    - Sensordaten (SSE vom ESP32 → MQTT Broker weiterleiten)
//    - Steuerbefehle (LED, Schwellwerte)
//  Empfängt:
//    - LED Status, ESP32 Online/Offline
//
//  ⚠️  Broker braucht WebSocket Port 9001
//  Mosquitto: listener 9001 / protocol websockets
// ─────────────────────────────────────────────────────────────

import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { SensorService } from './sensor.service';

export interface MqttStatus {
  connected: boolean;
  error:     string | null;
  lastSent:  string | null;
}

// ── Topics ────────────────────────────────────────────────────
export const TOPICS = {
  TELEMETRY:   'home/sensor/telemetry',
  TEMPERATURE: 'home/sensor/temperature',
  HUMIDITY:    'home/sensor/humidity',
  LED_CMD:     'home/esp32/led/set',
  THRESHOLD:   'home/esp32/threshold/set',
  LED_STATE:   'home/esp32/led/state',
  ESP_STATUS:  'home/esp32/status',
} as const;

@Injectable({ providedIn: 'root' })
export class AppMqttService implements OnDestroy {

  private sensor = inject(SensorService);

  // ── Signals ────────────────────────────────────────────
  status    = signal<MqttStatus>({ connected: false, error: null, lastSent: null });
  ledState  = signal<'on' | 'off' | null>(null);
  espOnline = signal<boolean>(false);

  private ws!:               WebSocket;
  private publishInterval:   any;
  private reconnectTimer:    any;
  private clientId =         'angular-' + Math.random().toString(16).slice(2, 8);

  private readonly BROKER_HOST = '192.168.178.77';
  private readonly BROKER_PORT = 9001;

  constructor() {
    this.connect();
    this.startSensorForwarding();
  }

  // ── WebSocket + MQTT Handshake ──────────────────────────
  private connect() {
    this.ws = new WebSocket(
      `ws://${this.BROKER_HOST}:${this.BROKER_PORT}/mqtt`,
      ['mqtt']   // MQTT Subprotokoll
    );
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.sendConnect();   // MQTT CONNECT Paket senden
    };

    this.ws.onmessage = (event) => {
      this.handlePacket(new Uint8Array(event.data as ArrayBuffer));
    };

    this.ws.onclose = () => {
      this.status.update(s => ({ ...s, connected: false }));
      // Reconnect nach 5s
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    };

    this.ws.onerror = () => {
      this.status.update(s => ({ ...s, error: 'WebSocket Fehler' }));
    };
  }

  // ── MQTT Pakete aufbauen ────────────────────────────────

  // CONNECT Paket (nach WebSocket-Verbindung)
  private sendConnect() {
    const clientIdBytes = this.encode(this.clientId);
    const payload = new Uint8Array([
      // Fixed Header
      0x10,                          // CONNECT
      12 + clientIdBytes.length,     // Remaining Length
      // Variable Header
      0x00, 0x04, 0x4D, 0x51, 0x54, 0x54,  // "MQTT"
      0x04,                          // Protocol Level 3.1.1
      0x02,                          // Connect Flags: Clean Session
      0x00, 0x3C,                    // Keep Alive: 60s
      // Payload: Client ID
      ...this.prefixed(clientIdBytes),
    ]);
    this.ws.send(payload);
  }

  // SUBSCRIBE Paket
  private sendSubscribe(topic: string) {
    const topicBytes = this.encode(topic);
    const packetId   = [0x00, 0x01];
    const payload    = new Uint8Array([
      0x82,                           // SUBSCRIBE
      2 + 2 + topicBytes.length + 1,  // Remaining Length
      ...packetId,
      ...this.prefixed(topicBytes),
      0x01,                           // QoS 1
    ]);
    this.ws.send(payload);
  }

  // PUBLISH Paket
  private sendPublish(topic: string, message: string, retain = false) {
    const topicBytes   = this.encode(topic);
    const messageBytes = this.encode(message);
    const flags        = retain ? 0x31 : 0x30;  // PUBLISH | retain bit
    const payload      = new Uint8Array([
      flags,
      2 + topicBytes.length + messageBytes.length,
      ...this.prefixed(topicBytes),
      ...messageBytes,
    ]);
    this.ws.send(payload);
  }

  // PINGREQ – Keep Alive
  private sendPing() {
    this.ws.send(new Uint8Array([0xC0, 0x00]));
  }

  // ── Eingehende Pakete verarbeiten ───────────────────────
  private handlePacket(data: Uint8Array) {
    const type = (data[0] & 0xF0) >> 4;

    switch (type) {
      case 2:  // CONNACK
        if (data[3] === 0x00) {
          this.status.update(s => ({ ...s, connected: true, error: null }));
          console.log('MQTT verbunden');
          // Topics abonnieren nach erfolgreicher Verbindung
          this.sendSubscribe(TOPICS.LED_STATE);
          this.sendSubscribe(TOPICS.ESP_STATUS);
          // Keep-Alive Ping alle 50s
          setInterval(() => this.sendPing(), 50_000);
        } else {
          this.status.update(s => ({ ...s, error: `CONNACK Fehler: ${data[3]}` }));
        }
        break;

      case 3: { // PUBLISH (empfangen)
        const topicLen  = (data[2] << 8) | data[3];
        const topic     = new TextDecoder().decode(data.slice(4, 4 + topicLen));
        const message   = new TextDecoder().decode(data.slice(4 + topicLen));
        this.onMessage(topic, message);
        break;
      }

      case 13: // PINGRESP
        break;
    }
  }

  private onMessage(topic: string, message: string) {
    if (topic === TOPICS.LED_STATE) {
      this.ledState.set(message as 'on' | 'off');
    }
    if (topic === TOPICS.ESP_STATUS) {
      this.espOnline.set(message === 'online');
    }
  }

  // ── Sensordaten weiterleiten ────────────────────────────
  private startSensorForwarding() {
    this.publishInterval = setInterval(() => {
      if (!this.status().connected) return;

      const raw = this.sensor.getRaw();
      if (!raw.timestamp) return;

      if (raw.temp !== null)
        this.publish(TOPICS.TEMPERATURE, raw.temp.toFixed(1));

      if (raw.hum !== null)
        this.publish(TOPICS.HUMIDITY, raw.hum.toFixed(1));

      this.publish(TOPICS.TELEMETRY, JSON.stringify({
        temperature: raw.temp,
        humidity:    raw.hum,
        timestamp:   raw.timestamp,
        iso:         new Date(raw.timestamp * 1000).toISOString(),
      }), true);

    }, 5000);
  }

  // ── Public API: Steuerbefehle ───────────────────────────
  sendLedCommand(state: 'on' | 'off') {
    this.publish(TOPICS.LED_CMD, state);
  }

  sendThreshold(tempMax: number, humMax: number) {
    this.publish(TOPICS.THRESHOLD, JSON.stringify({ temp_max: tempMax, hum_max: humMax }));
  }

  // ── Public API: beliebiges Topic ───────────────────────
  publish(topic: string, payload: string, retain = false) {
    if (!this.status().connected) return;
    this.sendPublish(topic, payload, retain);
    const t = new Date().toLocaleTimeString('de-DE');
    this.status.update(s => ({ ...s, lastSent: `${topic} @ ${t}` }));
  }

  // ── Hilfsfunktionen ─────────────────────────────────────
  private encode(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }

  private prefixed(bytes: Uint8Array): Uint8Array {
    const result = new Uint8Array(2 + bytes.length);
    result[0] = (bytes.length >> 8) & 0xFF;
    result[1] =  bytes.length       & 0xFF;
    result.set(bytes, 2);
    return result;
  }

  ngOnDestroy() {
    clearInterval(this.publishInterval);
    clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}
