import { LitElement, html, TemplateResult, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { computeCardSize, HomeAssistant, LovelaceCard } from 'custom-card-helpers';

import { ConfigTemplateConfig, ConfigTemplateVars } from './types';
import { VERSION } from './version';
import { isString } from './util';

console.info(
  `%c  CONFIG-TEMPLATE-CARD  \n%c  Version ${VERSION}         `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

@customElement('config-template-card')
export class ConfigTemplateCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: ConfigTemplateConfig;
  private _curVars?: ConfigTemplateVars;
  @state() private _helpers?: any;
  private _initialized = false;

  public setConfig(config?: ConfigTemplateConfig): void {
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

    if (this.getLovelacePanelEntities().length == 0 && this.getLovelaceViewEntities().length == 0 && !config.entities) {
      throw new Error('No entities defined');
    }

    this._config = config;

    void this.loadCardHelpers();
  }

  private getLovelace(): any {
    const ha = document.querySelector('home-assistant');
    if (ha?.shadowRoot) {
      const haMain = ha.shadowRoot.querySelector('home-assistant-main');
      if (haMain?.shadowRoot) {
        const haPanel = haMain.shadowRoot.querySelector('ha-panel-lovelace');
        if (haPanel?.shadowRoot) {
          const huiRoot : any = haPanel.shadowRoot.querySelector('hui-root');
          if (huiRoot) {
            const ll = huiRoot.lovelace;
            ll.current_view = huiRoot.___curView;
            return ll;
          }
        }
      }
    }
    return null;
  }

  private getLovelacePanelConfig(): any {
    const lovelace = this.getLovelace();

    if (lovelace?.config?.config_template_card_vars) {
      return lovelace.config.config_template_card_vars;
    }

    return {};
  }

  private getLovelaceViewConfig(): any {
    const lovelace = this.getLovelace();

    if (lovelace?.config?.views[lovelace.current_view]?.config_template_card_vars) {
      return lovelace.config.views[lovelace.current_view].config_template_card_vars;
    }

    return {};
  }

  private getLovelacePanelEntities() : any {
    const lovelace = this.getLovelace();

    if (lovelace?.config?.config_template_card_entities) {
      return lovelace.config.config_template_card_entities;
    }

    return [];
  }

  private getLovelaceViewEntities() : any {
    const lovelace = this.getLovelace();

    if (lovelace?.current_view && lovelace?.config?.views[lovelace.current_view]?.config_template_card_entities) {
      return lovelace.config.views[lovelace.current_view].config_template_card_entities;
    }

    return [];
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
        this._evaluateVars();

        const entities: string[] = [];
        const panelEntities = this._evaluateStructure(structuredClone(this.getLovelacePanelEntities()));
        if (Array.isArray(panelEntities)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          entities.push(...panelEntities);
        }
        const viewEntities = this._evaluateStructure(structuredClone(this.getLovelaceViewEntities()));
        if (Array.isArray(viewEntities)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          entities.push(...viewEntities);
        }
        const localEntities = this._evaluateStructure(structuredClone(this._config.entities));
        if (Array.isArray(localEntities)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          entities.push(...localEntities);
        }

        for (const entity of entities) {
          if (this.hass && oldHass.states[entity] !== this.hass.states[entity]) {
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
      // eslint detects this assertion as unnecessary, but typescript requires it.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const element = this.shadowRoot.querySelector('#card > *') as LovelaceCard | null;
      if (element) {
        Promise.resolve(computeCardSize(element)).then((size) => {
          console.log('computeCardSize is ' + size.toString());
        }, () => undefined);
        return computeCardSize(element);
      }
    }
    return 1;
  }

  protected render(): TemplateResult {
    if (
      !this._config ||
      !this.hass ||
      !this._helpers ||
      (!this._config.card && !this._config.row && !this._config.element)
    ) {
      return html``;
    }

    let configSection = this._config.card
      ? structuredClone(this._config.card)
      : this._config.row
        ? structuredClone(this._config.row)
        : structuredClone(this._config.element);

    let style = this._config.style ? structuredClone(this._config.style) : {};

    // render() is usually called shortly after shouldUpdate(), in which case we probably don't need
    // to re-evaluate variables.
    if (!this._curVars) { this._evaluateVars(); }

    configSection = this._evaluateStructure(configSection);
    style = this._evaluateStructure(style);

    // In case the next call to render() is not preceded by a call to shouldUpdate(), force the next
    // render() call to re-evaluate variables.
    this._curVars = undefined;

    const element = this._config.card
      ? this._helpers.createCardElement(configSection)
      : this._config.row
        ? this._helpers.createRowElement(configSection)
        : this._helpers.createHuiElement(configSection);
    element.hass = this.hass;

    if (this._config.element) {
      Object.keys(style).forEach((prop) => {
        this.style.setProperty(prop, style[prop]);
      });
      if (configSection?.style) {
        Object.keys(configSection.style).forEach((prop) => {
          if (configSection.style) {  // TypeScript requires a redundant check here, not sure why
            element.style.setProperty(prop, configSection.style[prop]);
          }
        });
      }
    }

    return html`<div id="card">${element}</div>`;
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

  private _evaluateStructure(struct: any): any {
    if (struct instanceof Array) {
      for (let i = 0; i < struct.length; ++i) {
        const value = struct[i];
        struct[i] = this._evaluateStructure(value);
      }
    } else if (typeof struct === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      Object.entries(struct).forEach(entry => {
        const key = entry[0];
        const value = entry[1];
        struct[key] = this._evaluateStructure(value);
      });
    } else if (isString(struct) && struct.includes('${')) {
      return this._evaluateTemplate(struct);
    }
    return struct;
  }

  private _evaluateTemplate(template: string): any {
    if (template.startsWith('${') && template.endsWith('}')) {
      // The entire property is a template, return eval's result directly
      // to preserve types other than string (eg. numbers)
      return this._evalWithVars(template.substring(2, template.length - 1));
    }

    /\${[^}]+}/.exec(template)?.forEach(m => {
      const repl = this._evalWithVars(m.substring(2, m.length - 1)).toString() as string;
      template = template.replace(m, repl);
    });
    return template;
  }

  private _evaluateVars(): void {
    const vars: Record<string, any> & any[] = [];
    const namedVars: Record<string, any> = {};
    const arrayVars: any[] = [];

    const cv = this._curVars = {
      hass: this.hass, states: this.hass?.states, user: this.hass?.user, vars: vars,
      _evalInit: '',
    }
    cv._evalInit += "var hass = this._curVars.hass;\n";
    cv._evalInit += "var states = this._curVars.states;\n";
    cv._evalInit += "var user = this._curVars.user;\n";
    cv._evalInit += "var vars = this._curVars.vars;\n";

    const panelVars = this.getLovelacePanelConfig();
    if (panelVars) {
      if (Array.isArray(panelVars)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        arrayVars.push(...panelVars);
      } else {
        Object.assign(namedVars, panelVars);
      }
    }

    const viewVars = this.getLovelaceViewConfig();
    if (viewVars) {
      if (Array.isArray(viewVars)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        arrayVars.push(...viewVars);
      } else {
        Object.assign(namedVars, viewVars);
      }
    }

    if (this._config?.variables) {
      if (Array.isArray(this._config.variables)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        arrayVars.push(...this._config.variables);
      } else {
        Object.assign(namedVars, this._config.variables);
      }
    }

    for (let v of arrayVars) {
      if (isString(v)) { v = this._evalWithVars(v); }
      else { v = structuredClone(v); }
      vars.push(v);
    }

    for (const varName in namedVars) {
      let v = namedVars[varName];
      if (isString(v)) { v = this._evalWithVars(v); }
      else { v = structuredClone(v); }
      vars[varName] = v;
      cv._evalInit += `var ${varName} = vars['${varName}'];\n`;
    }
  }

  private _evalWithVars(template: string): any {
    // Be aware that `this.hass` must be available to evaluated templates for backward compatibility
    // with old config-template-card configs.

    const init = (this._curVars?._evalInit ? this._curVars._evalInit : '');

    // "direct" eval() is considered insecure and generates warnings, so use "indirect" eval(),
    // which uses global scope as local scope (this === window, so this.hass should work).
    const tsWindow: any = window;  // Silence typescript errors about setting variables on window
    const origCurVars = tsWindow._curVars;  // Just in case there is a conflicting global variable
    tsWindow._curVars = this._curVars;
    const indirectEval = eval;

    const ret = indirectEval(init + template);

    if (origCurVars) { tsWindow._curVars = origCurVars; } else { delete tsWindow._curVars; }
    return ret;
  }
}
