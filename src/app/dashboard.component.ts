import { SensorService } from './services/sensor.service';
import { Component, inject, computed, signal } from '@angular/core';
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
          <!-- <h2>LCD Text Sender</h2>
          <form action="/update" method="GET">
            <input type="text" name="line1" placeholder="Zeile 1 (max 16)" maxlength="16"><br><br>
            <input type="text" name="line2" placeholder="Zeile 2 (max 16)" maxlength="16"><br><br>
            <input type="submit" value="Anzeigen">
          </form> -->
          <div class="control-row" style="margin-top: 10px;">
              <span class="k">LCD Backlight</span>
              <label class="switch">
                <input type="checkbox" 
                       [checked]="backlightStatus()" 
                       (change)="toggleBacklight()">
                <span class="slider"></span>
              </label>
            </div>
          <hr style="margin: 20px 0; border: 0; border-top: 1px solid #444;">

          <h2>LCD Text Sender</h2>
          
          <div style="margin-bottom: 15px;">
            <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" 
                     [checked]="lcdEnabled()" 
                     (change)="lcdEnabled.set(!lcdEnabled())"> 
              <span>Sende-Funktion aktivieren</span>
            </label>
          </div>

          <form [action]="lcdEnabled() ? '/update' : 'javascript:void(0)'" method="GET">
            <input type="text" 
                   name="line1" 
                   placeholder="Zeile 1 (max 16)" 
                   maxlength="16" 
                   [disabled]="!lcdEnabled()"><br><br>
            
            <input type="text" 
                   name="line2" 
                   placeholder="Zeile 2 (max 16)" 
                   maxlength="16" 
                   [disabled]="!lcdEnabled()"><br><br>
            
            <input type="submit" 
                   value="Anzeigen" 
                   [disabled]="!lcdEnabled()"
                   [style.opacity]="lcdEnabled() ? 1 : 0.5">
          </form>
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
// Signal für die Checkbox-Steuerung
  lcdEnabled = signal<boolean>(false);

  backlightStatus = signal<boolean>(false);

  toggleBacklight() {
    const newState = !this.backlightStatus();
    this.backlightStatus.set(newState);
    
    // Aufruf an den Service (muss in sensor.service.ts implementiert sein)
     this.sensor.setBacklight(newState ? 'on' : 'off');
  }
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