import {
  LitElement,
  html,
  customElement,
  property,
  TemplateResult,
  PropertyValues
} from "lit-element";
import deepClone from "deep-clone-simple";

import { ConfigTemplateConfig, HomeAssistant } from "./types";
import { fireEvent } from "./fire-event";

@customElement("config-template-card")
class ConfigTemplateCard extends LitElement {
  @property() public hass?: HomeAssistant;

  @property() private _config?: ConfigTemplateConfig;

  public setConfig(config: ConfigTemplateConfig): void {
    if (!config || !config.card || !config.card.type) {
      throw new Error("Invalid configuration");
    }

    this._config = config;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has("_config") || !this._config!.entities) {
      return true;
    }

    const oldHass = changedProps.get("hass") as HomeAssistant | undefined;

    if (oldHass) {
      let changed = false;
      this._config!.entities.forEach(entity => {
        changed = changed || oldHass.states[entity] !== this.hass!.states[entity]
      });
      
      return changed;
    }

    return true;
  }

  protected render(): TemplateResult | void {
    if (!this._config || !this.hass) {
      return html``;
    }

    // this.hass.states
    // this.hass.user.name

    let cardConfig = deepClone(this._config.card);
    cardConfig = this._evaluateConfig(cardConfig);

    // console.log(this._config.config);
    // console.log(cardConfig);

    const element = this.createThing(cardConfig);
    element.hass = this.hass;

    return html`
      ${element}
    `;
  }

  private _evaluateConfig(config: any): any {
    Object.entries(config).forEach(entry => {
      const key = entry[0];
      const value = entry[1];

      if (value !== null) {
        if (value instanceof Array) {
          config[key] = this._evaluateArray(value);
        } else if (typeof value === "object") {
          config[key] = this._evaluateConfig(value);
        } else if (typeof value === "string" && value.includes("${")) {
          config[key] = this._evaluateTemplate(value);
        }
      }
    });

    return config;
  }

  private _evaluateArray(array: any): any {
    for (let i = 0; i < array.length; ++i) {
      let value = array[i];
      if (value instanceof Array) {
        array[i] = this._evaluateArray(value);
      } else if (typeof value === "object") {
        array[i] = this._evaluateConfig(value);
      } else if (typeof value === "string" && value.includes("${")) {
        array[i] = this._evaluateTemplate(value);
      }
    }

    return array;
  }

  private _evaluateTemplate(template: string): string {
    const user = this.hass!.user;
    const states = this.hass!.states;
    const vars: any[] = []
    
    for (const v in this._config!.variables) {
      const newV = eval(this._config!.variables[v]);
      vars.push(newV);
    }
    
    return eval(template.substring(2, template.length - 1));
  }

  private createThing(cardConfig) {
    const _createError = (error, config) => {
      return _createThing("hui-error-card", {
        type: "error",
        error,
        config
      });
    };

    const _createThing = (tag, config) => {
      const element = window.document.createElement(tag);
      try {
        element.setConfig(config);
      } catch (err) {
        console.error(tag, err);
        return _createError(err.message, config);
      }
      return element;
    };

    if (
      !cardConfig ||
      typeof cardConfig !== "object" ||
      !cardConfig.type ||
      !cardConfig.type.startsWith("custom:")
    )
      return _createError("No type configured", cardConfig);

    const tag = cardConfig.type.substr("custom:".length);

    if (customElements.get(tag)) return _createThing(tag, cardConfig);

    // If element doesn't exist (yet) create an error
    const element = _createError(
      `Custom element doesn't exist: ${cardConfig.type}.`,
      cardConfig
    );
    element.style.display = "None";
    const timer = setTimeout(() => {
      element.style.display = "";
    }, 2000);
    // Remove error if element is defined later
    customElements.whenDefined(cardConfig.type).then(() => {
      clearTimeout(timer);
      fireEvent(this, "ll-rebuild", {}, element);
    });

    return element;
  }
}
