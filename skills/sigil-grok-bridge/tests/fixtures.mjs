export const MOCK_SENDER = {
  owner_id: "usr_system",
  endpoint_id: "ep_grokbot",
  kind: "agent"
};

export const MOCK_RECIPIENT = {
  owner_id: "usr_operator",
  endpoint_id: "ep_relay"
};

export const CAPABILITY_SETS = {
  READ_ONLY: ["sigil.core/read_shared_context"],
  TASK_SUBMIT: ["sigil.core/read_shared_context", "sigil.task/submit"],
  ELEVATED_MUTATION: [
    "sigil.core/read_shared_context",
    "sigil.task/submit",
    "sigil.workspace/arbitrary_write"
  ]
};

export function createBaseEnvelope(overrides = {}) {
  return {
    protocol: "sigil/1",
    message_id: `msg_${Date.now()}_test`,
    conversation_id: "conv_trm_sync_001",
    message_type: "task.request",
    sender: { ...MOCK_SENDER },
    recipient: { ...MOCK_RECIPIENT },
    body: {
      instruction: "Process staging gap triage",
      task_id: "task_trm_01"
    },
    context_refs: [
      {
        kind: "research_doc",
        uri: "wiki/research/open-contradictions.md",
        sha256: "a058c0bd0ac1d03a580d43e0911f82738334f8a492f9d47b61a0994eafc4cb88"
      }
    ],
    capabilities: [...CAPABILITY_SETS.READ_ONLY],
    approval: {
      required: false,
      status: "none"
    },
    correlation_id: "corr_trm_01",
    idempotency_key: "idem_grok_uuid_123",
    created_at: "2026-09-06T12:00:00Z",
    expires_at: "2026-09-07T12:00:00Z",
    ...overrides
  };
}
