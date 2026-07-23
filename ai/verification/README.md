# verification/

Read-only readiness and post-deployment proof. Authored by `foundry-env-verifier` (Sonnet).

- `environment-readiness.md` - which tenant and subscription can host Foundry plus the MAI models, per-model region and quota, and a go or no-go. Written before deployment.
- `deployment-verification.md` - health, auth, and a tiny smoke test (one image, one short audio clip) proving the endpoints work. Written after deployment. No bulk generation.
