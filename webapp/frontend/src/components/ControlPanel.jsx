import { useState } from "react";
import "./ControlPanel.css";

export default function ControlPanel({
  isCharging, state, pilot, maxCurrent, divertmode,
  onStart, onStop, onClear, onSetCurrent, onSetDivert, onRestart,
}) {
  const [currentValue, setCurrentValue] = useState(pilot || 16);
  const isSleeping = state === 254 || state === 255;
  const min = 6;
  const max = maxCurrent || 32;
  const pct = ((currentValue - min) / (max - min)) * 100;

  const sliderStyle = {
    background: `linear-gradient(90deg, var(--amber) 0%, var(--amber) ${pct}%, var(--border-lit) ${pct}%, var(--border-lit) 100%)`,
  };

  return (
    <div className="control-panel">
      {/* Charging */}
      <div className="control-group">
        <div className="control-group-label">Charging</div>
        <div className="btn-row">
          <button className="btn btn-start" onClick={onStart} disabled={isCharging}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Start
          </button>
          <button className="btn btn-stop" onClick={onStop} disabled={!isCharging && !isSleeping}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18"/></svg>
            Stop
          </button>
          <button className="btn btn-ghost" onClick={onClear}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
            </svg>
            Clear Override
          </button>
        </div>
      </div>

      {/* Current limit */}
      <div className="control-group">
        <div className="control-group-label">
          Charge Current
        </div>
        <div className="slider-row">
          <span className="slider-label">{min}A</span>
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={currentValue}
            style={sliderStyle}
            onChange={(e) => setCurrentValue(Number(e.target.value))}
          />
          <span className="slider-label">{max}A</span>
          <span className="slider-current-value">{currentValue}<span>A</span></span>
          <button className="btn btn-blue" onClick={() => onSetCurrent(currentValue)}>Apply</button>
        </div>
      </div>

      {/* Charge mode */}
      <div className="control-group">
        <div className="control-group-label">Charge Mode</div>
        <div className="btn-row">
          <button
            className={`btn mode-btn ${divertmode === 2 ? "mode-btn--active-blue" : "btn-ghost"}`}
            onClick={() => onSetDivert(2)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            Fast
          </button>
          <button
            className={`btn mode-btn ${divertmode === 1 ? "mode-btn--active-amber" : "btn-ghost"}`}
            onClick={() => onSetDivert(1)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Eco / Divert
          </button>
        </div>
      </div>

      {/* Restart */}
      <div className="control-group">
        <div className="control-group-label">Restart</div>
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={() => onRestart("gateway")}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
            Gateway
          </button>
          <button className="btn btn-ghost" onClick={() => onRestart("evse")}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
            EVSE Module
          </button>
        </div>
      </div>
    </div>
  );
}
