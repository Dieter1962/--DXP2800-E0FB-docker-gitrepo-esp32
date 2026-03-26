// src/app/websocket.service.ts
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface SensorData {
  temp: string;
  hum: string;
  time: string;
  date: string;
}

@Injectable({ providedIn: 'root' })
export class WebsocketService {
  private ws!: WebSocket;
  data$ = new Subject<SensorData>();

  connect() {
    this.ws = new WebSocket(`ws://${location.host}/ws`);

    this.ws.onmessage = (event) => {
      const d: SensorData = JSON.parse(event.data);
      this.data$.next(d);
    };

    this.ws.onclose = () => {
      // Reconnect nach 2s
      setTimeout(() => this.connect(), 2000);
    };
  }
}