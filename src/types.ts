import type {
  HomeAssistant,
  LovelaceCardConfig,
  EntitiesCardEntityConfig,
  LovelaceElementConfigBase,
} from 'custom-card-helpers';

export interface ConfigTemplateConfig {
  type: string;
  /**
   * Entity ids to watch, any of which may be a template, or one template that returns a list.
   * Optional when the dashboard or view sets `config_template_card_entities`.
   */
  entities?: string[] | string;
  variables?: unknown[] | { [key: string]: unknown };
  /** Variables evaluated once when the card loads, available as `svars` and by name. */
  staticVariables?: unknown[] | { [key: string]: unknown };
  card?: LovelaceCardConfig;
  row?: EntitiesCardEntityConfig;
  element?: LovelaceElementConfigBase;
  style?: Record<string, string>;
}

export type TemplateVars = ConfigTemplateConfig['variables'];

/** Static variables, evaluated once per card config. */
export interface StaticVars {
  svars: EvalVars;
  names: string[];
  values: unknown[];
  /** Settles once every static variable that returned a Promise has its value. */
  pending?: Promise<void>;
}
export type ConfigObject = Record<string, unknown>;
export type CreatedElement = HTMLElement & { hass?: HomeAssistant };
export type EvalVars = Array<unknown> & { [key: string]: unknown };
export type CompiledTemplate = (this: unknown, ...args: unknown[]) => unknown;

/** Variables evaluated against one hass snapshot, shared by every template in an update. */
export interface EvalContext {
  hass?: HomeAssistant;
  config?: ConfigTemplateConfig;
  vars: EvalVars;
  svars: EvalVars;
  /** Named variables exposed to templates as bare identifiers, with their values. */
  names: string[];
  values: unknown[];
  arraySources: unknown[];
  namedSources: Record<string, unknown>;
  /** The inner card config being built by the current render, exposed to templates as `output`. */
  output?: unknown;
  /** Settles once every variable that returned a Promise has its value. */
  pending?: Promise<void>;
}

export interface CardHelpers {
  createCardElement(config: unknown): CreatedElement;
  createRowElement(config: unknown): CreatedElement;
  createHuiElement(config: unknown): CreatedElement;
}

/** Keys a dashboard or one of its views can set for every config-template-card on it. */
export interface SharedTemplateConfig {
  config_template_card_vars?: unknown;
  config_template_card_staticVars?: unknown;
  config_template_card_entities?: unknown;
}

export interface LovelaceViewWithVars extends SharedTemplateConfig {
  path?: string;
}

export interface LovelacePanelWithVars extends Element {
  lovelace?: {
    config?: SharedTemplateConfig & {
      views?: LovelaceViewWithVars[];
    };
  };
}

export interface WindowWithCardHelpers extends Window {
  loadCardHelpers?: () => Promise<CardHelpers>;
}

export interface Connection {
  [key: string]: {
    subscribe(cb: (data: Record<string, unknown>) => void): () => void;
    [key: string]: unknown;
  };
}
