import {
  LitElement,
  html,
  customElement,
  property,
  TemplateResult,
  PropertyValues,
  internalProperty,
} from 'lit-element';
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
  @property({ attribute: false }) public hass?: HomeAssistant;
  @internalProperty() private _config?: ConfigTemplateConfig;
  @internalProperty() private _helpers?: any;
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
      console.warn('WARNING: config-template-card should not be used with the picture-elements card itself. Instead use it as one of the elements. Check the README for details'); 
    }

    if (config.element && !config.style) {
      throw new Error('No style defined for element');
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
        for (const entity of this._config.entities) {
          const evaluatedTemplate = this._evaluateTemplate(entity);
          if (Boolean(this.hass && oldHass.states[evaluatedTemplate] !== this.hass.states[evaluatedTemplate])) {
            return true;
          }
        }
        return false;
      }
    }

    return true;
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

    let config = this._config.card
      ? deepClone(this._config.card)
      : this._config.row
      ? deepClone(this._config.row)
      : deepClone(this._config.element);

    config = this._evaluateConfig(config);

    const element = this._config.card
      ? this._helpers.createCardElement(config)
      : this._config.row
      ? this._helpers.createRowElement(config)
      : this._helpers.createHuiElement(config);
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
    let vars: any[] | { [key: string]: any };
    let varDef = '';

    if (this._config) {
      if (Array.isArray(this._config.variables)) {
        // if variables are an array, create vars as an array
        vars = [];
        for (const v in this._config.variables) {
          const newV = eval(this._config.variables[v]);
          vars.push(newV);
        }
      } else {
        // if it is an object, then create a key-value map containing
        // the values
        vars = {};
        for (const varName in this._config.variables) {
          const newV = eval(this._config.variables[varName]);
          vars[varName] = newV;
          // create variable definitions to be injected:
          varDef = varDef + `var ${varName} = vars['${varName}'];\n`;
        }
      }
    }
    return eval(varDef + template.substring(2, template.length - 1));
  }
}
