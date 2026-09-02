#!/usr/bin/env node
import { ObservabilityServer } from '../src/server.js';

const port = parseInt(process.env.CIC_OBSERVER_PORT ?? '9091', 10);
const harvesterId = process.env.CIC_HARVESTER_ID ?? 'cic-whichllm-default-v1';

const server = new ObservabilityServer({ harvesterId });
await server.listen(port);
console.log(`Observability Node listening on http://0.0.0.0:${port}`);
