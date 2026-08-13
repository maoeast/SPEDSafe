# Errors

Command failures and integration errors.

---

## [ERR-20260724-001] electron_debug_port_expired

**Logged**: 2026-07-24T09:47:18+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
The isolated Electron test process and its DevTools endpoint were no longer reachable after the long-running session resumed.

### Error

```text
TypeError: fetch failed
```

### Context
- Operation: local CDP inspection of the Electron renderer
- Environment: Electron 23.3.13, isolated APPDATA profile, local port 9333
- The process had to be restarted before continuing the manual flow.

### Suggested Fix
Start the Vite and Electron test processes immediately before CDP inspection and verify the debug port before each interaction batch.

### Metadata
- Reproducible: unknown
- Related Files: none

### Resolution
- **Resolved**: 2026-07-24T10:05:00+08:00
- **Commit/PR**: none
- **Notes**: Restarted Vite and Electron immediately before CDP inspection, then completed the manual test in short interaction batches.

---

## [ERR-20260723-001] sandbox_source_read

**Logged**: 2026-07-23T15:36:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
The first parallel read of the read-only reference repository failed while the Windows sandbox helper refreshed its setup.

### Error

```text
windows sandbox: helper_unknown_error: setup refresh had errors
```

### Context
- Operation: parallel read-only document and file-list inspection
- Environment: Windows PowerShell workspace-write sandbox

### Suggested Fix
Retry the reference reads as smaller, independent read-only commands.

### Metadata
- Reproducible: unknown
- Related Files: none

### Resolution
- **Resolved**: 2026-07-23T15:36:00+08:00
- **Commit/PR**: none
- **Notes**: Continued with isolated read-only commands.

---
