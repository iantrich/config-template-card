import { LitElement, html, type TemplateResult, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { computeCardSize } from 'custom-card-helpers';
import type { HomeAssistant, LovelaceCard } from 'custom-card-helpers';

import type {
  CardHelpers,
  ConfigObject,
  ConfigTemplateConfig,
  EvalVars,
  LovelacePanelWithVars,
  TemplateVars,
  WindowWithCardHelpers,
} from './types';
import { CARD_VERSION } from './const';

const clone = <T>(value: T): T => {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

/* eslint no-console: 0 */
console.info(
  `%c  CONFIG-TEMPLATE-CARD  \n%c  Version ${CARD_VERSION}         `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

@customElement('config-template-card')
export class ConfigTemplateCard extends LitElement {
  private static readonly _HELPERS_TIMEOUT_MS = 10000;
  private _hass?: HomeAssistant;

  @property({ attribute: false })
  public set hass(value: HomeAssistant | undefined) {
    const oldValue = this._hass;
    this._hass = value;
    this.requestUpdate('hass', oldValue);
  }

  public get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  @state() private _config?: ConfigTemplateConfig;
  @state() private _helpers?: CardHelpers;
  private _initialized = false;

  public setConfig(config: ConfigTemplateConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }

    if (!config.card && !config.row && !config.element) {
      throw new Error('No card or row or element defined');
    }

    if (config.card && !config.card.type) {
      throw new Error('No card type defined');
    }

    if (config.card && config.card.type === 'picture-elements') {
      console.warn(
        'WARNING: config-template-card should not be used with the picture-elements card itself. Instead use it as one of the elements. Check the README for details',
      );
    }

    if (config.element && !config.element.type) {
      throw new Error('No element type defined');
    }

    if (!config.entities) {
      throw new Error('No entities defined');
    }

    this._config = config;

    this.loadCardHelpers();
  }

  private getLovelacePanel() {
    const ha = document.querySelector('home-assistant');

    if (ha && ha.shadowRoot) {
      const haMain = ha.shadowRoot.querySelector('home-assistant-main');

      if (haMain && haMain.shadowRoot) {
        return haMain.shadowRoot.querySelector('ha-panel-lovelace');
      }
    }

    return null;
  }

  private getLovelaceConfig(): TemplateVars | undefined {
    const panel = this.getLovelacePanel() as LovelacePanelWithVars | null;
    const localVars = panel?.lovelace?.config?.config_template_card_vars;

    if (Array.isArray(localVars)) {
      return localVars as string[];
    }

    if (localVars && typeof localVars === 'object') {
      return localVars as { [key: string]: string };
    }

    return undefined;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this._initialized) {
      this._initialize();
    }

    if (changedProps.has('_config')) {
      return true;
    }

    if (this._config && this.hass) {
      const oldHass = changedProps.get('hass') as HomeAssistant | undefined;

      if (oldHass) {
        for (const entityTemplate of this._config.entities) {
          const currentEntityId = String(this._evaluateTemplate(entityTemplate));
          const oldEntityId = String(this._evaluateTemplate(entityTemplate, oldHass));

          if (oldEntityId !== currentEntityId) {
            return true;
          }

          const oldState = oldHass.states[oldEntityId];
          const currentState = this.hass.states[currentEntityId];

          if (oldState !== currentState) {
            return true;
          }

          if (
            oldState &&
            currentState &&
            (oldState.state !== currentState.state ||
              oldState.last_changed !== currentState.last_changed ||
              oldState.last_updated !== currentState.last_updated)
          ) {
            return true;
          }
        }
        return false;
      }
    }

    return true;
  }

  public getCardSize(): number | Promise<number> {
    if (this.shadowRoot) {
      const element = this.shadowRoot.querySelector('#card > *') as LovelaceCard;
      if (element) {
        return computeCardSize(element);
      }
    }

    return 1;
  }

  protected render(): TemplateResult | void {
    if (
      !this._config ||
      !this.hass ||
      !this._helpers ||
      (!this._config.card && !this._config.row && !this._config.element)
    ) {
      return html``;
    }

    const sourceConfig = this._config.card ?? this._config.row ?? this._config.element;
    if (!sourceConfig) {
      return html``;
    }

    let config: ConfigObject = clone(sourceConfig as ConfigObject);
    let style: ConfigObject = this._config.style ? clone(this._config.style as ConfigObject) : {};

    config = this._evaluateConfig(config);
    if (style) {
      style = this._evaluateConfig(style);
    }
    const styleRecord = this._asStyleRecord(style);

    const element = this._config.card
      ? this._helpers.createCardElement(config)
      : this._config.row
        ? this._helpers.createRowElement(config)
        : this._helpers.createHuiElement(config);
    element.hass = this.hass;

    if (this._config.element) {
      if (styleRecord) {
        Object.keys(styleRecord).forEach((prop) => {
          this.style.setProperty(prop, styleRecord[prop]);
        });
      }
      const configStyle = this._asStyleRecord(config.style);
      if (configStyle) {
        Object.keys(configStyle).forEach((prop) => {
          element.style.setProperty(prop, configStyle[prop]);
        });
      }
    }

    return html` <div id="card">${element}</div> `;
  }

  private _initialize(): void {
    if (this.hass === undefined) return;
    if (this._config === undefined) return;
    if (this._helpers === undefined) return;
    this._initialized = true;
  }

  private async loadCardHelpers(): Promise<void> {
    try {
      const helpersFactory = await this._waitForCardHelpers(ConfigTemplateCard._HELPERS_TIMEOUT_MS);
      this._helpers = await Promise.race<CardHelpers>([
        helpersFactory(),
        new Promise<CardHelpers>((_, reject) =>
          setTimeout(
            () => reject(new Error('Timed out while resolving card helpers')),
            ConfigTemplateCard._HELPERS_TIMEOUT_MS,
          ),
        ),
      ]);
      this.requestUpdate();
    } catch (error) {
      console.debug('Unable to load Home Assistant card helpers', error);
    }
  }

  private async _waitForCardHelpers(timeoutMs: number): Promise<() => Promise<CardHelpers>> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const maybeLoader = (window as WindowWithCardHelpers).loadCardHelpers;
      if (typeof maybeLoader === 'function') {
        return maybeLoader;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error('window.loadCardHelpers was not available in time');
  }

  private _asStyleRecord(value: unknown): Record<string, string> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    const style: Record<string, string> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      if (entry !== undefined && entry !== null) {
        style[key] = String(entry);
      }
    });

    return style;
  }

  private _evaluateConfig(config: ConfigObject): ConfigObject {
    Object.entries(config).forEach((entry) => {
      const key = entry[0];
      const value = entry[1];

      if (value !== null) {
        if (Array.isArray(value)) {
          config[key] = this._evaluateArray(value);
        } else if (typeof value === 'object') {
          config[key] = this._evaluateConfig(value as ConfigObject);
        } else if (typeof value === 'string' && value.includes('${')) {
          config[key] = this._evaluateTemplate(value);
        }
      }
    });

    return config;
  }

  private _evaluateArray(array: unknown[]): unknown[] {
    for (let i = 0; i < array.length; ++i) {
      const value = array[i];
      if (Array.isArray(value)) {
        array[i] = this._evaluateArray(value);
      } else if (typeof value === 'object') {
        array[i] = this._evaluateConfig(value as ConfigObject);
      } else if (typeof value === 'string' && value.includes('${')) {
        array[i] = this._evaluateTemplate(value);
      }
    }

    return array;
  }

  private _evaluateTemplate(template: string, hassOverride?: HomeAssistant): unknown {
    if (!template.includes('${')) {
      return template;
    }

    const hass = hassOverride ?? this.hass;
    const user = hass ? hass.user : undefined;
    const states = hass ? hass.states : undefined;
    const vars: EvalVars = [] as unknown as EvalVars;
    const namedVars: Record<string, string> = {};
    const arrayVars: string[] = [];

    const evaluateExpression = (expression: unknown): unknown => {
      if (typeof expression !== 'string') {
        return expression;
      }

      const namedVarNames = Object.keys(namedVars);
      const namedVarValues = namedVarNames.map((name) => vars[name]);
      const evaluator = new Function('hass', 'states', 'user', 'vars', ...namedVarNames, `return (${expression});`);

      try {
        return evaluator(hass, states, user, vars, ...namedVarValues);
      } catch (error) {
        console.error('Failed to evaluate template expression', {
          template,
          expression,
          namedVariables: namedVars,
          arrayVariables: arrayVars,
          evaluatedVariables: vars,
          error,
        });
        throw error;
      }
    };

    const localVars = this.getLovelaceConfig();

    if (localVars) {
      if (Array.isArray(localVars)) {
        arrayVars.push(...localVars);
      } else {
        Object.assign(namedVars, localVars);
      }
    }

    if (this._config) {
      const configVars = this._config.variables;
      if (Array.isArray(configVars)) {
        arrayVars.push(...configVars);
      } else if (configVars) {
        Object.assign(namedVars, configVars);
      }
    }

    for (const v in arrayVars) {
      const newV = evaluateExpression(arrayVars[v]);
      vars.push(newV);
    }

    for (const varName in namedVars) {
      const newV = evaluateExpression(namedVars[varName]);
      vars[varName] = newV;
    }

    return evaluateExpression(template.substring(2, template.length - 1));
  }
}
