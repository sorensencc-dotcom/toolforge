/**
 * Environment validation for Cowork Gateway.
 * Ensures all required config exists before runtime.
 */

interface CoworkEnv {
  COWORK_API_URL: string;
  COWORK_API_KEY: string;
  COWORK_GATEWAY_ID: string;
  COWORK_SYNC_INTERVAL: number;
  TOOLFORGE_SKILLS_PATH: string;
}

function loadEnv(): CoworkEnv {
  const missing: string[] = [];
  const required = [
    'COWORK_API_URL',
    'COWORK_API_KEY',
    'COWORK_GATEWAY_ID',
    'TOOLFORGE_SKILLS_PATH',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  return {
    COWORK_API_URL: process.env.COWORK_API_URL!,
    COWORK_API_KEY: process.env.COWORK_API_KEY!,
    COWORK_GATEWAY_ID: process.env.COWORK_GATEWAY_ID!,
    COWORK_SYNC_INTERVAL: parseInt(process.env.COWORK_SYNC_INTERVAL || '300', 10),
    TOOLFORGE_SKILLS_PATH: process.env.TOOLFORGE_SKILLS_PATH!,
  };
}

export { CoworkEnv, loadEnv };
