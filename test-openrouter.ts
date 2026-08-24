import { runTorqueQueryOpenRouter } from './openrouter-client';

async function main() {
  const result = await runTorqueQueryOpenRouter({
    model: 'stealth/ox-alpha',
    messages: [
      { role: 'system', content: 'You are a concise research engine.' },
      { role: 'user', content: 'Confirm connection and return status: ready.' },
    ],
  });

  console.log('Model response:', result.choices[0].message.content);
}

main().catch(console.error);
