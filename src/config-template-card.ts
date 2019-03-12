import {
  LitElement,
  html,
  customElement,
  property,
  CSSResult,
  TemplateResult,
  css
} from "lit-element";

import { ConfigTemplateConfig, HomeAssistant } from "./types";
import { fireEvent } from "./fire-event";

@customElement("config-template-card")
class ConfigTemplateCard extends LitElement {
  @property() public hass?: HomeAssistant;

  @property() private _config?: ConfigTemplateConfig;

  public setConfig(config: ConfigTemplateConfig): void {
    if (!config || !config.config || !config.config.type) {
      throw new Error("Invalid configuration");
    }

    this._config = config;
  }

  protected render(): TemplateResult | void {
    if (!this._config || !this.hass) {
      return html``;
    }

    // this.hass.states
    // this.hass.user.name

    let cardConfig = this._config.config;
    cardConfig = this._evaluateConfig(cardConfig);

    console.log(this._config.config);
    console.log(cardConfig);

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

      if (value !== null && typeof value === "object") {
        config[key] = this._evaluateConfig(entry);
      }

      if (value !== null && typeof value === "string" && value.includes("${")) {
        config[key] = this._evaluateTemplate(value);
      }
    });

    return config;
  }

  private _evaluateTemplate(template: string): string {
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
