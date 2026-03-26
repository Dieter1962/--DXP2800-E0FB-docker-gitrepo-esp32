// src/app/sensor.service.ts
import { Injectable, signal, inject, computed } from '@angular/core';
import { DatePipe, DOCUMENT } from '@angular/common';


export interface SensorRaw {
  temp:      number | null;
  hum:       number | null;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class SensorService {
  private datePipe = inject(DatePipe);

  // ── Signals ────────────────────────────────────────────
  private raw       = signal<SensorRaw>({ temp: null, hum: null, timestamp: 0 });
  connected         = signal(false);

  // ── Computed – automatisch neu bei Signal-Änderung ─────
  temp = computed(() => {
    const t = this.raw().temp;
    return t !== null ? t.toFixed(1) : '--.-';
  });

  hum = computed(() => {
    const h = this.raw().hum;
    return h !== null ? h.toFixed(1) : '--.-';
  });

  // Datum auf Deutsch: "Donnerstag, 26. März 2026"
  date = computed(() => {
    const ts = this.raw().timestamp;
    if (!ts) return '';
    return this.datePipe.transform(
      ts * 1000,
      'EEEE, dd. MMMM yyyy',
      undefined,
      'de-DE'
    ) ?? '';
  });

  // Uhrzeit: "14:32:01"
  time = computed(() => {
    const ts = this.raw().timestamp;
    if (!ts) return '--:--:--';
    return this.datePipe.transform(
      ts * 1000,
      'HH:mm:ss',
      undefined,
      'de-DE'
    ) ?? '--:--:--';
  });

  // ── SSE Verbindung ──────────────────────────────────────
  private es!: EventSource;

  constructor() {
    this.connect();
  }

  private connect() {
    this.es = new EventSource('/events');

    this.es.addEventListener('sensor', (event: MessageEvent) => {
      this.raw.set(JSON.parse(event.data));
      this.connected.set(true);
    });

    this.es.onerror = () => {
      this.connected.set(false);
      this.es.close();
      setTimeout(() => this.connect(), 3000);
    };
  }

  // ── REST: LED steuern ───────────────────────────────────
  async setLed(state: 'on' | 'off'): Promise<void> {
    const body = new URLSearchParams({ state });
    await fetch('/led', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  async getLedState(): Promise<'on' | 'off'> {
    const res  = await fetch('/led');
    const json = await res.json();
    return json.led;
  }
}