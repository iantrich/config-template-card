import { LovelaceCardConfig } from 'custom-card-helpers';

export interface ConfigTemplateConfig {
  type: string;
  entities: string[];
  variables?: string[];
  card?: LovelaceCardConfig;
}
