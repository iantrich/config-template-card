import { LovelaceCardConfig, EntitiesCardEntityConfig, LovelaceElementConfigBase } from 'custom-card-helpers';

export interface ConfigTemplateConfig {
  type: string;
  entities: string[];
  variables?: string[];
  card?: LovelaceCardConfig;
  row?: EntitiesCardEntityConfig;
  element?: LovelaceElementConfigBase;
}
