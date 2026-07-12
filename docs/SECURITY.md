# Security Notes

## Threat Model

Aegis Atlas handles scenario inputs and field notes that could be sensitive during a real crisis. The demo assumes an attacker may try to inject markup, corrupt local storage, overload numeric ranges, or infer private operational notes.

## Controls Implemented

- Content Security Policy in `index.html`.
- No external API calls.
- No `dangerouslySetInnerHTML`.
- Field notes are stripped of angle brackets and control characters.
- Field notes are capped at 600 characters.
- Scenario values are clamped to bounded operational ranges.
- Local storage loads are validated and fall back to defaults.
- JSON and Markdown exports are generated from structured simulation output.
- Service worker caches only static app assets.
- Tests cover sanitizer behavior, numeric normalization, export shape, and UI flows.

## Known Production Gaps

- Real deployment needs authentication, authorization, audit logs, and role-based access.
- Official GIS and sensor feeds need schema validation, provenance, and replay protection.
- Incident exports should be digitally signed for chain of custody.
- Service worker caching should include versioned asset manifests in a production hosting environment.
- Accessibility should receive a full manual audit with emergency-management users.

## Safety Boundary

This tool is a planning simulator. It should not be used as the sole source of truth for emergency actions. Real-world use requires official command review, verified field data, and legally accountable operators.
