import type {
  HomeAssistant,
  LovelaceCardConfig,
  EntitiesCardEntityConfig,
  LovelaceElementConfigBase,
} from 'custom-card-helpers';

export interface ConfigTemplateConfig {
  type: string;
  /** Entity ids to watch, any of which may be a template, or one template that returns a list. */
  entities: string[] | string;
  variables?: unknown[] | { [key: string]: unknown };
  card?: LovelaceCardConfig;
  row?: EntitiesCardEntityConfig;
  element?: LovelaceElementConfigBase;
  style?: Record<string, string>;
}

export type TemplateVars = ConfigTemplateConfig['variables'];
export type ConfigObject = Record<string, unknown>;
export type CreatedElement = HTMLElement & { hass?: HomeAssistant };
export type EvalVars = Array<unknown> & { [key: string]: unknown };
export type CompiledTemplate = (this: unknown, ...args: unknown[]) => unknown;

/** Variables evaluated against one hass snapshot, shared by every template in an update. */
export interface EvalContext {
  hass?: HomeAssistant;
  config?: ConfigTemplateConfig;
  vars: EvalVars;
  /** Named variables exposed to templates as bare identifiers, with their values. */
  names: string[];
  values: unknown[];
  arraySources: unknown[];
  namedSources: Record<string, unknown>;
}

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
