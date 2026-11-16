import { LitElement, css, html, type TemplateResult, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { computeCardSize } from 'custom-card-helpers';
import type { HomeAssistant, LovelaceCard } from 'custom-card-helpers';

import type {
  CardHelpers,
  CompiledTemplate,
  ConfigObject,
  ConfigTemplateConfig,
  EvalContext,
  EvalVars,
  LovelacePanelWithVars,
  TemplateVars,
  WindowWithCardHelpers,
} from './types';
import { CARD_VERSION } from './const';
import { singleTemplateCode, splitTemplate } from './template';

/** Named variables that are valid JS identifiers are also exposed as bare names in templates. */
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const CODE_PARAM = '__ctcTemplateCode';
const NESTED_CARD_TYPE = 'custom:config-template-card';

/* eslint no-console: 0 */
console.info(
  `%c  CONFIG-TEMPLATE-CARD  \n%c  Version ${CARD_VERSION}         `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

@customElement('config-template-card')
export class ConfigTemplateCard extends LitElement {
  private static readonly _HELPERS_TIMEOUT_MS = 10000;

  // Let the inner card fill the height a stack, grid or sections layout gives this card (#158).
  // Where the host has no fixed height (rows, picture elements), this resolves to the content height.
  static styles = css`
    #card {
      height: 100%;
    }
  `;
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
  private _contextCache?: EvalContext;
  private _compiled = new Map<string, CompiledTemplate>();

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

    if (!Array.isArray(config.entities) && typeof config.entities !== 'string') {
      throw new Error('entities must be a list of entity ids or a template that returns one');
    }

    this._config = config;
    this._contextCache = undefined;
    this._compiled.clear();

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
      return localVars as unknown[];
    }

    if (localVars && typeof localVars === 'object') {
      return localVars as { [key: string]: unknown };
    }

    return undefined;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this._initialized) {
      this._initialize();
    }

    // A new config or freshly loaded card helpers must always render, even when the same update
    // also carries a hass push with no watched entity changes (#201).
    if (changedProps.has('_config') || changedProps.has('_helpers')) {
      return true;
    }

    const oldHass = changedProps.get('hass') as HomeAssistant | undefined;
    if (!this._config || !this.hass || !oldHass) {
      return true;
    }

    let oldEntities: string[];
    let currentEntities: string[];
    try {
      oldEntities = this._resolveEntities(oldHass);
      currentEntities = this._resolveEntities(this.hass);
    } catch {
      // Let render() evaluate again and surface the error.
      return true;
    }

    if (oldEntities.length !== currentEntities.length) {
      return true;
    }

    return currentEntities.some(
      (entityId, index) => entityId !== oldEntities[index] || this.hass?.states[entityId] !== oldHass.states[entityId],
    );
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

    // Evaluation builds new objects, so the stored config is never mutated.
    const config = this._evaluateConfig(sourceConfig as ConfigObject);
    const styleRecord = this._asStyleRecord(this._config.style ? this._evaluateConfig(this._config.style) : {});

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
      console.error('Unable to load Home Assistant card helpers', error);
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
    return this._evaluateValue(config, this._getContext(this.hass)) as ConfigObject;
  }

  /**
   * Resolves the watched entity ids. `entities` may be a list whose items are templates, or a
   * single template that evaluates to a list; nested lists are flattened.
   */
  private _resolveEntities(hass: HomeAssistant): string[] {
    const entities = this._config?.entities;
    if (entities === undefined) {
      return [];
    }

    const evaluated = this._evaluateValue(entities, this._getContext(hass));
    const list = Array.isArray(evaluated) ? evaluated.flat(Infinity) : [evaluated];

    return list.filter((entity) => entity !== undefined && entity !== null).map((entity) => String(entity));
  }

  private _evaluateTemplate(template: string, hassOverride?: HomeAssistant): unknown {
    if (!template.includes('${')) {
      return template;
    }

    return this._evaluateString(template, this._getContext(hassOverride ?? this.hass));
  }

  private _evaluateValue(value: unknown, context: EvalContext): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this._evaluateValue(item, context));
    }

    if (value && typeof value === 'object') {
      // A nested config-template-card evaluates its own templates with its own variables.
      if ((value as ConfigObject).type === NESTED_CARD_TYPE) {
        return value;
      }

      const result: ConfigObject = {};
      Object.entries(value as ConfigObject).forEach(([key, entry]) => {
        result[key] = this._evaluateValue(entry, context);
      });
      return result;
    }

    if (typeof value === 'string' && value.includes('${')) {
      return this._evaluateString(value, context);
    }

    return value;
  }

  private _evaluateString(template: string, context: EvalContext): unknown {
    const code = singleTemplateCode(template);
    if (code !== undefined) {
      // The whole value is one template: keep the result's type (number, array, object, ...).
      return this._runCode(code, context, template, 'template');
    }

    return splitTemplate(template)
      .map((part) =>
        part.kind === 'text' ? part.value : String(this._runCode(part.value, context, template, 'template')),
      )
      .join('');
  }

  /**
   * Returns the variables evaluated against `hass`. The context is cached for the current hass
   * object so variables run once per update instead of once per template.
   */
  private _getContext(hass: HomeAssistant | undefined): EvalContext {
    const cached = this._contextCache;
    if (cached && cached.hass === hass && cached.config === this._config) {
      return cached;
    }

    const context = this._buildContext(hass);
    this._contextCache = context;
    return context;
  }

  private _buildContext(hass: HomeAssistant | undefined): EvalContext {
    const vars: EvalVars = [] as unknown as EvalVars;
    const arraySources: unknown[] = [];
    const namedSources: Record<string, unknown> = {};

    // Dashboard-wide variables first, so card variables can build on (and override) them.
    for (const source of [this.getLovelaceConfig(), this._config?.variables]) {
      if (Array.isArray(source)) {
        arraySources.push(...source);
      } else if (source && typeof source === 'object') {
        Object.assign(namedSources, source);
      }
    }

    const names = Object.keys(namedSources).filter((name) => IDENTIFIER.test(name));
    const context: EvalContext = {
      hass,
      config: this._config,
      vars,
      names,
      values: names.map(() => undefined),
      arraySources,
      namedSources,
    };

    arraySources.forEach((source, index) => {
      vars.push(this._evaluateVariable(source, context, `variables[${index}]`));
    });

    // Each named variable can use the ones defined before it.
    Object.keys(namedSources).forEach((name) => {
      const value = this._evaluateVariable(namedSources[name], context, name);
      vars[name] = value;
      const position = names.indexOf(name);
      if (position >= 0) {
        context.values[position] = value;
      }
    });

    return context;
  }

  private _evaluateVariable(source: unknown, context: EvalContext, variableName: string): unknown {
    if (typeof source !== 'string') {
      return source;
    }

    // Variables are plain code, but a variable written as `${...}` is accepted too.
    const code = singleTemplateCode(source) ?? source;
    return this._runCode(code, context, source, variableName);
  }

  private _runCode(code: string, context: EvalContext, template: string, variableName: string): unknown {
    const hass = context.hass;

    try {
      return this._compile(code, context.names).apply(this, [
        hass,
        hass?.states,
        hass?.user,
        context.vars,
        ...context.values,
      ]);
    } catch (error) {
      console.error('Failed to evaluate template expression', {
        template,
        expression: code,
        variableName,
        namedVariables: context.namedSources,
        arrayVariables: context.arraySources,
        evaluatedVariables: context.vars,
        error,
      });
      throw error;
    }
  }

  /**
   * Compiles code as an expression when it is one, so object literals like `{ a: 1 }` keep working.
   * Anything else (`let x = ...; x`) runs through eval, which returns the last statement's value.
   * Functions run with the card as `this`, so `this.hass` works as it did in 1.x.
   */
  private _compile(code: string, names: string[]): CompiledTemplate {
    const key = `${names.join(',')}\n${code}`;
    const cached = this._compiled.get(key);
    if (cached) {
      return cached;
    }

    const params = ['hass', 'states', 'user', 'vars', ...names];
    let compiled: CompiledTemplate;

    try {
      compiled = new Function(...params, `return (\n${code}\n);`) as CompiledTemplate;
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        throw error;
      }

      const runner = new Function(...params, CODE_PARAM, `return eval(${CODE_PARAM});`) as CompiledTemplate;
      compiled = function (this: unknown, ...args: unknown[]) {
        return runner.apply(this, [...args, code]);
      };
    }

    this._compiled.set(key, compiled);
    return compiled;
  }
}
