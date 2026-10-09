#!/usr/bin/env node
/**
 * scripts/ambient-hardware-agent-bridge.mjs
 *
 * Ambient Hardware Agent Bridge for Rewrite-MCP.
 * Connects autonomous agent swarms to physical hardware peripherals:
 * 1. RGB Status LEDs (Idle / Thinking / Step-Up Review / Failure)
 * 2. E-ink / Ambient status displays (Task / Token burn rate / Fleet status)
 * 3. Physical hardware kill-switches and approval foot pedals
 * 4. Monotonic protocol serialization over Serial/IPC/WebSocket
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');

export const HARDWARE_DEVICE_TYPES = {
  STATUS_LED: 'status_led',
  EINK_DISPLAY: 'eink_display',
  KILL_SWITCH: 'kill_switch',
  FOOT_PEDAL: 'foot_pedal'
};

export const LED_STATUS_COLORS = {
  IDLE_HEALTHY: '#00FF00',    // Green
  ACTIVE_THINKING: '#0088FF', // Blue
  STEP_UP_REVIEW: '#FFAA00',  // Amber
  SECURITY_ALERT: '#FF0000',  // Red
  MUTED: '#000000'            // Off
};

/**
 * Format and encode an outbound hardware event envelope.
 * @param {Object} params { deviceType: string, deviceId: string, seq: number, payload: Object }
 * @returns {Object} Validated hardware event envelope
 */
export function encodeHardwareMessage(params = {}) {
  const {
    deviceType = HARDWARE_DEVICE_TYPES.STATUS_LED,
    deviceId = 'dev-default',
    seq = 1,
    payload = {}
  } = params;

  return {
    protocol_version: '1.0.0',
    device_type: deviceType,
    device_id: deviceId,
    seq: Math.max(1, Math.floor(seq)),
    timestamp: new Date().toISOString(),
    payload
  };
}

/**
 * Validate an inbound hardware event message.
 * @param {Object} rawMessage
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateHardwareMessage(rawMessage) {
  const errors = [];
  if (!rawMessage || typeof rawMessage !== 'object') {
    return { valid: false, errors: ['Message must be a non-null object'] };
  }

  if (rawMessage.protocol_version !== '1.0.0') {
    errors.push('Unsupported protocol version; expected 1.0.0');
  }

  if (!Object.values(HARDWARE_DEVICE_TYPES).includes(rawMessage.device_type)) {
    errors.push(`Invalid device_type: ${rawMessage.device_type}`);
  }

  if (typeof rawMessage.device_id !== 'string' || !rawMessage.device_id.trim()) {
    errors.push('Missing or empty device_id');
  }

  if (!Number.isInteger(rawMessage.seq) || rawMessage.seq < 1) {
    errors.push('seq must be a positive integer');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Map agent fleet state to LED color code and display message.
 * @param {'IDLE'|'THINKING'|'STEP_UP'|'ERROR'} agentState
 * @returns {{ colorHex: string, brightness: number, statusLabel: string }}
 */
export function resolveLedState(agentState) {
  switch (agentState) {
    case 'THINKING':
      return { colorHex: LED_STATUS_COLORS.ACTIVE_THINKING, brightness: 0.8, statusLabel: 'AGENT_PROCESSING' };
    case 'STEP_UP':
      return { colorHex: LED_STATUS_COLORS.STEP_UP_REVIEW, brightness: 1.0, statusLabel: 'OPERATOR_REVIEW_REQUIRED' };
    case 'ERROR':
      return { colorHex: LED_STATUS_COLORS.SECURITY_ALERT, brightness: 1.0, statusLabel: 'EXECUTION_HALTED' };
    case 'IDLE':
    default:
      return { colorHex: LED_STATUS_COLORS.IDLE_HEALTHY, brightness: 0.3, statusLabel: 'FLEET_READY' };
  }
}

/**
 * Handle inbound hardware signals (e.g. emergency kill switch or approval pedal).
 * @param {Object} event Inbound hardware message
 * @returns {{ action: 'EMERGENCY_HALT'|'STEP_APPROVED'|'IGNORED', reason: string }}
 */
export function processHardwareInterrupt(event) {
  const validation = validateHardwareMessage(event);
  if (!validation.valid) {
    return { action: 'IGNORED', reason: `Invalid message: ${validation.errors.join(', ')}` };
  }

  if (event.device_type === HARDWARE_DEVICE_TYPES.KILL_SWITCH && event.payload?.state === 'TRIGGERED') {
    return {
      action: 'EMERGENCY_HALT',
      reason: `Physical kill switch triggered by ${event.device_id}`
    };
  }

  if (event.device_type === HARDWARE_DEVICE_TYPES.FOOT_PEDAL && event.payload?.press === 'CONFIRM') {
    return {
      action: 'STEP_APPROVED',
      reason: `Step-up confirmation received from foot pedal ${event.device_id}`
    };
  }

  return { action: 'IGNORED', reason: 'Non-interrupt event payload' };
}

// CLI Execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const state = process.argv[2] || 'THINKING';
  const led = resolveLedState(state);
  const msg = encodeHardwareMessage({
    deviceType: HARDWARE_DEVICE_TYPES.STATUS_LED,
    deviceId: 'led-desk-01',
    seq: 1,
    payload: led
  });
  console.log(JSON.stringify(msg, null, 2));
}
