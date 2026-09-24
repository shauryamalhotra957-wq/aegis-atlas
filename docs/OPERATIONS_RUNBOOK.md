# aegis-atlas: Production Operations Runbook & Incident Triage

Operational standards, telemetry thresholds, and disaster recovery procedures for **Humanitarian Crisis Mapping & Infrastructure Resilience Atlas**.

## Service Level Objectives (SLOs)
- **Command UI Availability**: >= 99.9% uptime for WebGL and telemetry sockets.
- **Rendering Performance**: Main thread frame rate locked at >= 58 FPS on standard GPU hardware.
- **Telemetry Ingestion Lag**: < 100ms lag from satellite/ground telemetry feed receipt to screen projection.

## Incident Triage Matrix

### Sev-1: WebGL Context Loss / Driver Crash
1. **Detection**: `webglcontextlost` event fired on primary 3D canvas element.
2. **Immediate Action**: Engage 2D Canvas SVG fallback view and trigger audio warning tone.
3. **Recovery**: Wait for `webglcontextrestored`, rebind GPU shader textures, and reset view matrix to default nadir coordinates.

### Sev-2: Telemetry Socket Disconnection / Uplink Loss
1. **Detection**: Keep-alive ping timeout (>3000ms) on telemetry WebSocket connection.
2. **Remediation**: Seamlessly transition to local dead-reckoning extrapolation and display amber "DATA STALE" HUD warning while initiating exponential retry reconnect loop.
