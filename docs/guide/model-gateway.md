# Model gateway

The gateway is the common authenticated entry point for editor, MCP and API
clients in the current two-region deployment. It selects a configured Foundry
account, forwards requests and streams, and records metadata. Azure
[Model Router](./model-router) sits behind it as a selectable deployment.

| Component | Responsibility |
|---|---|
| Client/MCP role | Select direct deployment or router |
| Gateway | Authenticate, map to regional backend, forward responses, observe usage |
| Azure Model Router | Select an eligible model using its mode and subset |
| Foundry deployment | Inference with configured version, SKU, quota and content policy |

## Configuration and authentication

The implementation is `gateway/foundry-proxy.mjs`, with metadata collection in
`gateway/telemetry.mjs`. Private `routing.json` supplies `backends`, `models`,
`prefixes` and `defaultBackend`. Credential environment variable names belong
in configuration; values are supplied by hosted Key Vault references. Clients
use the separate gateway token.

The base address ends in `/v1`. Authentication accepts
`Authorization: Bearer <gateway-token>` or `api-key: <gateway-token>`.
`GET /v1/models` lists configured routes, not MCP permissions or guaranteed
Chat Completions compatibility. `GET /health` checks the process without
authentication; it does not test inference or upstream credentials.

## Regional routing

Explicit prefixes take precedence over the JSON `model` field. Otherwise a
known model maps to its backend; unmapped requests use the default backend.
After removing a prefix, forwarded paths must start with `/v1` or `/deployments`.
Requests cannot select arbitrary backend hosts.

Use a backend-specific prefix throughout multipart and asynchronous operations,
including polling, downloading and deletion. Such requests may have no JSON
model field. There is no job-ID-to-backend store. Unprefixed follow-up requests
use the default account and can return not-found for jobs created elsewhere.

## Compatibility and limits

For a provider HTTP 400 explicitly identifying an unsupported parameter, the
gateway can remove `temperature`, `top_p`, `presence_penalty`,
`frequency_penalty`, `logprobs` or `top_logprobs` and retry up to six times.
It preserves tools, messages, model and output limits. It does not translate
Chat Completions to Responses, repair arbitrary 422 errors or retry throttles.
`X-Foundry-Proxy-Stripped` identifies removed fields; retry-after and rate-limit
headers are forwarded when supplied.

Default request limit is 32 MiB and timeout is 600 seconds, configurable through
`FOUNDRY_MAX_REQUEST_BYTES` and `FOUNDRY_TIMEOUT_MS`. Clients and MCP may have
shorter timeouts. Client disconnect aborts upstream work. Streaming preserves
backpressure; partial streams and cancellation are observable. Clients must
choose model-compatible output-limit parameters.

## Operations

Publish both gateway modules and private `routing.json` together. Validate
Key Vault reference resolution, authentication rejection, direct and router
inference, and streaming with usage. Deployment success and health do not prove
these checks.

Telemetry includes request ID, requested/returned model, region, status,
duration, provider token fields and stream timing without retaining prompt or
response content. Coverage varies by API/provider. MCP allow/block rules apply
in MCP, not to everyone possessing a gateway token. See
[monitoring operations](../implementation/foundry-observability-operations) and
[migration](./parallel-migration).

App Service, monitoring and inference have separate charges. Size the gateway
from current regional rates and measured demand; the historical fixed monthly
estimate is not a current production forecast.
