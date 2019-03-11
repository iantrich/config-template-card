import {
  LitElement,
  html,
  customElement,
  property,
  CSSResult,
  TemplateResult,
  css
} from "lit-element";

import { ConfigTemplateConfig, HomeAssistant } from './types';
import { fireEvent } from "./fire-event";

@customElement("config-template-card")
class ConfigTemplateCard extends LitElement {
  @property() public hass?: HomeAssistant;

  @property() private _config?: ConfigTemplateConfig;

  public setConfig(config: ConfigTemplateConfig): void {
    if (!this._config || !this._config.config || !this._config.config.type) {
      throw new Error('Invalid configuration');
    }

    this._config = config;
  }

  protected render(): TemplateResult | void {
    if (!this._config || !this.hass) {
      return html``;
    }

    // this.hass.states
    // this.hass.user.name

    let config = this._config.config;
    config = this._evaluateConfig(config);

    console.log(this._config.config);
    console.log(config);

    const element = this.createThing(config);
    element.hass = this.hass;

    return html`${element}`;
  }

  private _evaluateConfig(config: any): any {
    Object.entries(config).forEach(entry => {
      let key = entry[0];
      let value = entry[1];

      if (value !== null && typeof value == "object") {
        config[key] = this._evaluateConfig(entry);
      }

      if (value !== null && typeof value == "string" && value.includes("${")) {
        config[key] = this._evaluateTemplate(value);
      }
    });

    return config;
  }

  private _evaluateTemplate(template: string): string {
    return eval(template.substring(2, template.length - 1));
  }

  private createThing(config) {
    const _createThing = (tag, config) => {
      const element = document.createElement(tag);
      try {
        element.setConfig(config);
      } catch (err) {
        console.error(tag, err);
        return _createError(err.message, config);
      }
      return element;
    };

    const _createError = (error, config) => {
      return _createThing("hui-error-card", {
        type: "error",
        error,
        config,
      });
    };

    if (!config || typeof config !== "object" || !config.type || !config.type.startsWith("custom:"))
      return _createError(`No type configured`, config);

    const tag = config.type.substr("custom:".length);

    if (customElements.get(tag))
      return _createThing(tag, config);

    // If element doesn't exist (yet) create an error
    const element = _createError(
      `Custom element doesn't exist: ${config.type}.`,
      config
    );
    element.style.display = "None";
    const timer = setTimeout(() => {
      element.style.display = "";
    }, 2000);
    // Remove error if element is defined later
    customElements.whenDefined(config.type).then(() => {
      clearTimeout(timer);
      fireEvent(this, "ll-rebuild", {}, element);
    });

    return element;
  }
}
