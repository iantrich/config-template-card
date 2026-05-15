import type {
  HomeAssistant,
  LovelaceCardConfig,
  EntitiesCardEntityConfig,
  LovelaceElementConfigBase,
} from 'custom-card-helpers';

export interface ConfigTemplateConfig {
  type: string;
  entities: string[];
  variables?: string[] | { [key: string]: string };
  card?: LovelaceCardConfig;
  row?: EntitiesCardEntityConfig;
  element?: LovelaceElementConfigBase;
  style?: Record<string, string>;
}

export type TemplateVars = ConfigTemplateConfig['variables'];
export type ConfigObject = Record<string, unknown>;
export type CreatedElement = HTMLElement & { hass?: HomeAssistant };
export type EvalVars = Array<unknown> & { [key: string]: unknown };

export interface CardHelpers {
  createCardElement(config: unknown): CreatedElement;
  createRowElement(config: unknown): CreatedElement;
  createHuiElement(config: unknown): CreatedElement;
}

export interface LovelacePanelWithVars extends Element {
  lovelace?: {
    config?: {
      config_template_card_vars?: unknown;
    };
  };
}

export interface WindowWithCardHelpers extends Window {
  loadCardHelpers?: () => Promise<CardHelpers>;
}
