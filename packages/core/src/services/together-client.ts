import { Together } from 'together-ai';
import type { Config } from '@sm-rn/shared/schemas';

const APP_NAME_HELICONE = 'receipthero';

/**
 * Creates a Together AI client with optional Helicone observability.
 * 
 * @param config Application configuration
 * @returns Configured Together AI client
 */
export function createTogetherClient(config: Config): Together {
  const baseSDKOptions: ConstructorParameters<typeof Together>[0] = {
    apiKey: config.togetherAi.apiKey,
  };

  // Add Helicone integration if enabled and configured
  if (
    config.observability?.heliconeEnabled &&
    config.observability?.heliconeApiKey
  ) {
    baseSDKOptions.baseURL = 'https://together.helicone.ai/v1';
    baseSDKOptions.defaultHeaders = {
      'Helicone-Auth': `Bearer ${config.observability.heliconeApiKey}`,
      'Helicone-Property-Appname': APP_NAME_HELICONE,
    };
  }

  return new Together(baseSDKOptions);
}
