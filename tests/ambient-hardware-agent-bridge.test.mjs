import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeHardwareMessage,
  validateHardwareMessage,
  resolveLedState,
  processHardwareInterrupt,
  HARDWARE_DEVICE_TYPES,
  LED_STATUS_COLORS
} from '../scripts/ambient-hardware-agent-bridge.mjs';

test('HardwareBridge - encodes valid envelope with monotonic sequence and ISO timestamp', () => {
  const msg = encodeHardwareMessage({
    deviceType: HARDWARE_DEVICE_TYPES.STATUS_LED,
    deviceId: 'led-matrix-01',
    seq: 42,
    payload: { brightness: 100 }
  });

  assert.equal(msg.protocol_version, '1.0.0');
  assert.equal(msg.device_id, 'led-matrix-01');
  assert.equal(msg.seq, 42);
  assert.ok(msg.timestamp.includes('T'));
});

test('HardwareBridge - validates envelope and catches malformed fields', () => {
  const invalid = { protocol_version: '0.9.0', device_type: 'unknown', seq: -1 };
  const res = validateHardwareMessage(invalid);
  assert.equal(res.valid, false);
  assert.ok(res.errors.length >= 3);
});

test('HardwareBridge - resolves LED color and brightness mapping across agent lifecycle states', () => {
  assert.equal(resolveLedState('IDLE').colorHex, LED_STATUS_COLORS.IDLE_HEALTHY);
  assert.equal(resolveLedState('THINKING').colorHex, LED_STATUS_COLORS.ACTIVE_THINKING);
  assert.equal(resolveLedState('STEP_UP').colorHex, LED_STATUS_COLORS.STEP_UP_REVIEW);
  assert.equal(resolveLedState('ERROR').colorHex, LED_STATUS_COLORS.SECURITY_ALERT);
});

test('HardwareBridge - processes physical kill switch emergency halt signal', () => {
  const killEvent = encodeHardwareMessage({
    deviceType: HARDWARE_DEVICE_TYPES.KILL_SWITCH,
    deviceId: 'switch-red-01',
    seq: 10,
    payload: { state: 'TRIGGERED' }
  });

  const interrupt = processHardwareInterrupt(killEvent);
  assert.equal(interrupt.action, 'EMERGENCY_HALT');
  assert.ok(interrupt.reason.includes('Physical kill switch'));
});

test('HardwareBridge - processes foot pedal step-up confirmation signal', () => {
  const pedalEvent = encodeHardwareMessage({
    deviceType: HARDWARE_DEVICE_TYPES.FOOT_PEDAL,
    deviceId: 'pedal-floor-01',
    seq: 11,
    payload: { press: 'CONFIRM' }
  });

  const interrupt = processHardwareInterrupt(pedalEvent);
  assert.equal(interrupt.action, 'STEP_APPROVED');
});
