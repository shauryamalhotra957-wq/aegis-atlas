# aegis-atlas: STRIDE Threat Model & Security Posture

Operational security assessment for **Humanitarian Crisis Mapping & Infrastructure Resilience Atlas**.

| STRIDE Category | Threat Description | Severity | Mitigation Strategy |
|---|---|---|---|
| **Spoofing** | Spoofed ADS-B, AIS, or TLE orbital ephemeris injection | High | Strict cryptographic signature validation and ephemeris plausibility gating |
| **Tampering** | Man-in-the-Middle tampering with disaster evacuation corridors | Critical | End-to-end TLS 1.3 with Certificate Transparency pinning and hash verification |
| **Repudiation** | Operator denying transmission of regional disaster evacuation sirens | High | Nonce-backed immutable audit log with multi-signature authorization keys |
| **Information Disclosure** | Exposure of classified satellite orbits or vulnerability vectors | Critical | Strict RBAC spatial geometry clipping and classification-based layer masking |
| **Denial of Service** | Volumetric coordinate flood aimed at crashing WebGL canvas | High | Client-side rate-limiting and bounding-box spatial clustering before rendering |
| **Elevation of Privilege** | Remote code execution via malformed 3D asset files (GLTF/OBJ) | Critical | Hardened GLTF validator rejecting embedded buffer scripts or external URIs |
