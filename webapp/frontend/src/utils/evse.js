export const EVSE_STATES = {
  0:   { label: "Unknown",              color: "var(--text-muted)" },
  1:   { label: "Not Connected",        color: "var(--yellow)"     },
  2:   { label: "EV Connected",         color: "var(--blue)"       },
  3:   { label: "Charging",             color: "var(--green)"      },
  4:   { label: "Vent Required",        color: "var(--orange)"     },
  5:   { label: "Diode Check Failed",   color: "var(--red)"        },
  6:   { label: "GFCI Fault",           color: "var(--red)"        },
  7:   { label: "No Ground",            color: "var(--orange)"     },
  8:   { label: "Stuck Relay",          color: "var(--red)"        },
  9:   { label: "GFI Self-Test Failed", color: "var(--red)"        },
  10:  { label: "Over Temperature",     color: "var(--red)"        },
  11:  { label: "Over Current",         color: "var(--red)"        },
  254: { label: "Sleeping",             color: "var(--purple)"     },
  255: { label: "Disabled",             color: "var(--text-muted)" },
};

export function fmtEnergy(wh) {
  const v = parseFloat(wh) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(2)} kWh`;
  return `${v.toFixed(0)} Wh`;
}

export function fmtElapsed(seconds) {
  const s = parseInt(seconds) || 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
