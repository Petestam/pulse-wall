# Topology accuracy references

Place authoritative client documents here for cross-checking before sign-off:

| File | Use |
|------|-----|
| **Anatomy of an Attack — React2Shell.docx** | Ingress, lateral movement, crown-jewel, and remediation-adjacent nodes and paths |
| **React2Shell.md** | Nine-step attack (ADC → AI → IPS → Nexus → RCE → firewall C2 → XDR → Splunk ES); mirrored in `routes.json` → `sec-react2shell` and topology nodes `adc`, `ips`, `nexus`, `app-server` |
| **Pulse Wall SOW-Ext.docx** | Experience modes, scenario counts, LED wall behavior |

## Workflow

1. Copy the `.docx` files into this folder (or paste excerpts into a new markdown note in this directory).
2. Update [`../components.json`](../components.json) node labels, rings, and edges to match agreed language.
3. Update [`../routes.json`](../routes.json) so each route’s `nodes` array follows the narrative paths you need to demo.

Until documents are available, [`../routes.json`](../routes.json) uses placeholder labels aligned to [`../../context.md`](../../context.md) visualization states (threat ingress, lateral movement, degradation, and so on).
