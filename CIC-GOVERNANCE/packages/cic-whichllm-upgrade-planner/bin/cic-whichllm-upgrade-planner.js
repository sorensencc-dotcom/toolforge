#!/usr/bin/env node
import { UpgradePlanner } from '../src/upgrade-planner.js';

const planner = new UpgradePlanner();
const plan = planner.generatePlan('cic-whichllm-default-v1', '2.4.0', '2.5.0');

console.log('CIC-WHICHLLM Upgrade Planner v1.0');
console.log('=================================');
console.log(JSON.stringify(plan, null, 2));
