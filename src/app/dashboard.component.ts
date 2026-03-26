import { SensorService } from './services/sensor.service';
import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wrap">
      <div class="card">

        <!-- Linkes Panel: Hauptanzeige -->
        <div class="panel main-panel">
          <div class="title">Indoor Climate</div>

          <div class="temp">
            {{ sensor.temp() }}<span class="unit">°C</span>
          </div>

          <div class="chip">💧 {{ sensor.hum() }} %</div>

          <div class="time">{{ sensor.time() }}</div>
          <div class="date">{{ sensor.date() }}</div>

          <div class="footer">{{ hostname }} · ESP32-S3</div>
        </div>

        <!-- Rechtes Panel: Details + Steuerung -->
        <div class="panel detail-panel">
          <div class="title">Details</div>

          <div class="kv">
            <span class="k">Temperatur</span>
            <span class="v">{{ sensor.temp() }} °C</span>
          </div>
          <div class="kv">
            <span class="k">Luftfeuchtigkeit</span>
            <span class="v">{{ sensor.hum() }} %</span>
          </div>
          <div class="kv">
            <span class="k">Uhrzeit</span>
            <span class="v">{{ sensor.time() }}</span>
          </div>
          <div class="kv">
            <span class="k">Datum</span>
            <span class="v">{{ sensor.date() }}</span>
          </div>

          <!-- LED Steuerung (REST POST) -->
          <div class="led-control">
            <span class="k">LED</span>
            <div class="led-buttons">
              <button class="btn on"  (click)="sensor.setLed('on')">ON</button>
              <button class="btn off" (click)="sensor.setLed('off')">OFF</button>
            </div>
          </div>

          <!-- Verbindungsstatus -->
          <div class="status" [class.connected]="sensor.connected()">
            <span class="dot"></span>
            {{ sensor.connected() ? 'Live' : 'Verbinde...' }}
          </div>
        </div>

      </div>
    </div>
  `,
  styleUrl: './app.scss'
})
export class DashboardComponent {
  // inject statt constructor injection
  sensor = inject(SensorService);

  hostname = location.hostname;

  // computed signals – werden automatisch neu berechnet
  // tempDisplay = computed(() => {
  //   const t = this.sensor.temp();
  //   return t !== null ? t.toFixed(1) : '--.-';
  // });

  // humDisplay = computed(() => {
  //   const h = this.sensor.hum();
  //   return h !== null ? h.toFixed(1) : '--.-';
  // });
}