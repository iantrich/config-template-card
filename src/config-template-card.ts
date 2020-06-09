/* eslint-disable @typescript-eslint/no-explicit-any */
import { LitElement, html, customElement, property, TemplateResult, PropertyValues } from 'lit-element';
import deepClone from 'deep-clone-simple';
import { HomeAssistant } from 'custom-card-helpers';

import { ConfigTemplateConfig } from './types';
import { CARD_VERSION } from './const';

/* eslint no-console: 0 */
console.info(
  `%c  CONFIG-TEMPLATE-CARD  \n%c  Version ${CARD_VERSION}         `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

@customElement('config-template-card')
export class ConfigTemplateCard extends LitElement {
  @property() public hass?: HomeAssistant;
  @property() private _config?: ConfigTemplateConfig;
  @property() private _helpers?: any;
  private _initialized = false;

  public setConfig(config: ConfigTemplateConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }

    if (!config.card) {
      throw new Error('No card defined');
    }

    if (!config.card.type) {
      throw new Error('No card type defined');
    }

    if (!config.entities) {
      throw new Error('No entities defined');
    }

    this._config = config;

    this.loadCardHelpers();
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this._initialized) {
      this._initialize();
    }

    if (changedProps.has('_config')) {
      return true;
    }

    if (this._config) {
      const oldHass = changedProps.get('hass') as HomeAssistant | undefined;

      if (oldHass) {
        let changed = false;
        this._config.entities.forEach(entity => {
          changed =
            changed ||
            Boolean(
              this.hass &&
                oldHass.states[this._evaluateTemplate(entity)] !== this.hass.states[this._evaluateTemplate(entity)],
            );
        });

        return changed;
      }
    }

    return true;
  }

  protected render(): TemplateResult | void {
    if (!this._config || !this.hass || !this._helpers) {
      return html``;
    }

    let cardConfig = deepClone(this._config.card);
    cardConfig = this._evaluateConfig(cardConfig);

    const element = this._helpers.createCardElement(cardConfig);
    element.hass = this.hass;

    return html`
      ${element}
    `;
  }

  private _initialize(): void {
    if (this.hass === undefined) return;
    if (this._config === undefined) return;
    if (this._helpers === undefined) return;
    this._initialized = true;
  }

  private async loadCardHelpers(): Promise<void> {
    this._helpers = await (window as any).loadCardHelpers();
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private _evaluateConfig(config: any): any {
    Object.entries(config).forEach(entry => {
      const key = entry[0];
      const value = entry[1];

      if (value !== null) {
        if (value instanceof Array) {
          config[key] = this._evaluateArray(value);
        } else if (typeof value === 'object') {
          config[key] = this._evaluateConfig(value);
        } else if (typeof value === 'string' && value.includes('${')) {
          config[key] = this._evaluateTemplate(value);
        }
      }
    });

    return config;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private _evaluateArray(array: any): any {
    for (let i = 0; i < array.length; ++i) {
      const value = array[i];
      if (value instanceof Array) {
        array[i] = this._evaluateArray(value);
      } else if (typeof value === 'object') {
        array[i] = this._evaluateConfig(value);
      } else if (typeof value === 'string' && value.includes('${')) {
        array[i] = this._evaluateTemplate(value);
      }
    }

    return array;
  }

  private _evaluateTemplate(template: string): string {
    if (!template.includes('${')) {
      return template;
    }

    /* eslint-disable @typescript-eslint/no-unused-vars */
    const user = this.hass ? this.hass.user : undefined;
    const states = this.hass ? this.hass.states : undefined;
    const vars: any[] = [];

    if (this._config) {
      for (const v in this._config.variables) {
        const newV = eval(this._config.variables[v]);
        vars.push(newV);
      }
    }

    return eval(template.substring(2, template.length - 1));
  }
}
