import { LitElement, css, html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';
import { computeCardSize } from 'custom-card-helpers';
import type { HomeAssistant, LovelaceCard } from 'custom-card-helpers';

import type {
  CardHelpers,
  CompiledTemplate,
  ConfigObject,
  ConfigTemplateConfig,
  CreatedElement,
  EvalContext,
  EvalVars,
  LovelacePanelWithVars,
  LovelaceViewWithVars,
  SharedTemplateConfig,
  StaticVars,
  TemplateVars,
  WindowWithCardHelpers,
} from './types';
import { CARD_VERSION } from './const';
import { singleTemplateCode, splitTemplate } from './template';
import { AsyncFunction, containsThenable, isThenable, resolveDeep } from './async';
import { expandWildcards } from './wildcard';

/** Named variables that are valid JS identifiers are also exposed as bare names in templates. */
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const CODE_PARAM = '__ctcTemplateCode';
const NESTED_CARD_TYPE = 'custom:config-template-card';
/** A value starting with this prefix is passed through as text, with the prefix removed (from #159). */
const LITERAL_PREFIX = '$! ';
/** Shown in place of a template inside a string when that template fails. */
const EMBEDDED_ERROR_TEXT = '<error>';

/** Compiles a function body, or returns undefined when it isn't valid JavaScript. */
const tryCompile = (constructor: FunctionConstructor, params: string[], body: string): CompiledTemplate | undefined => {
  try {
    return new constructor(...params, body) as CompiledTemplate;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined;
    }
    throw error;
  }
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
    const element = this.shadowRoot?.querySelector('#card > *') as LovelaceCard | null | undefined;
    if (element) element.hass = value;
  }

  public get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  @state() private _config?: ConfigTemplateConfig;
  @state() private _helpers?: CardHelpers;
  private _initialized = false;
  private _contextCache?: EvalContext;
  private _statics?: StaticVars;
  /** The last finished render, shown while an async render is pending. */
  private _lastRendered?: TemplateResult;
  private _compiled = new Map<string, CompiledTemplate>();
  /** Settles once `loadCardHelpers` has finished, whether or not it found the helpers. */
  private _helpersLoading?: Promise<void>;
  /** An inner card built by `getCardSize` before the first render, which that render reuses (#45). */
  private _measured?: { hass: HomeAssistant; config: ConfigTemplateConfig; element: Promise<CreatedElement> };
  private _updateTimer?: number;

  private _handleResize = () => {
    if (this._updateTimer) {
      window.clearTimeout(this._updateTimer);
    }
    this._updateTimer = window.setTimeout(() => {
      requestAnimationFrame(() => {
        this.requestUpdate('_resize', true);
      });
    }, 500);
  };

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

    if (!config.entities && this.getLovelaceEntities().length === 0) {
      throw new Error('No entities defined');
    }

    if (config.entities !== undefined && !Array.isArray(config.entities) && typeof config.entities !== 'string') {
      throw new Error('entities must be a list of entity ids or a template that returns one');
    }

    const start = Date.now();
    const hassPresent = (resolve: (value: void | PromiseLike<void>) => void) => {
      if (this.hass !== undefined) resolve();
      else if (Date.now() - start > 5000) resolve();
      else
        setTimeout(() => {
          hassPresent(resolve);
        }, 100);
    };

    new Promise<void>(hassPresent)
      .then(() => {
        if (!this.hass) return;

        let entities: string[];
        try {
          entities = this._resolveEntities(this.hass);
        } catch {
          entities = [];
        }

        for (const entity of entities) {
          if (entity === '_resize') window.addEventListener('resize', this._handleResize);
          else if (entity.startsWith('_energy')) {
            const energyPresent = (resolve: (value: void | PromiseLike<void>) => void) => {
              if ((this.hass?.connection as unknown as Record<string, unknown>)[entity] !== undefined) resolve();
              else if (Date.now() - start > 5000) resolve();
              else
                setTimeout(() => {
                  energyPresent(resolve);
                }, 100);
            };
            new Promise<void>(energyPresent)
              .then(() => {
                if (
                  (this.hass?.connection as unknown as Record<string, Record<string, unknown>>)[entity]?.subscribe ===
                  undefined
                )
                  return;
                // eslint-disable-next-line
                (this.hass?.connection as unknown as Record<string, Record<string, any>>)[entity].subscribe(
                  (data: Record<string, unknown>) => {
                    if ((this.hass?.connection as unknown as Record<string, unknown>)[entity]) {
                      for (const key of ['start', 'end', 'compare'])
                        if (data[key] !== undefined)
                          (this.hass?.connection as unknown as Record<string, Record<string, unknown>>)[entity][key] =
                            data[key];
                      this._contextCache = undefined;
                    }
                    this.requestUpdate(entity, true);
                  },
                );
              })
              .catch((err: unknown) => {
                console.error('Error in Promise: ', err);
              });
          }
        }
      })
      .catch((err: unknown) => {
        console.error('Error in Promise: ', err);
      });

    this._config = config;
    this._contextCache = undefined;
    this._statics = undefined;
    this._lastRendered = undefined;
    this._compiled.clear();
    this._measured = undefined;

    this._helpersLoading = this.loadCardHelpers();
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

  private _getDashboardConfig(): (SharedTemplateConfig & { views?: LovelaceViewWithVars[] }) | undefined {
    const panel = this.getLovelacePanel() as LovelacePanelWithVars | null;
    return panel?.lovelace?.config;
  }

  /**
   * The view this card is on, found the way Home Assistant routes views: the URL's view segment
   * matches a view's `path`, or is its index; no segment means the first view (from #171).
   */
  private _getViewConfig(): LovelaceViewWithVars | undefined {
    const views = this._getDashboardConfig()?.views;
    if (!Array.isArray(views) || views.length === 0) {
      return undefined;
    }

    const segment = decodeURIComponent(window.location.pathname.split('/')[2] ?? '');
    const byPath = views.find((view) => view.path === segment);
    if (byPath) {
      return byPath;
    }

    const index = segment === '' ? 0 : Number(segment);
    return Number.isInteger(index) ? views[index] : undefined;
  }

  private getLovelaceConfig(): TemplateVars | undefined {
    return this._asVariables(this._getDashboardConfig()?.config_template_card_vars);
  }

  private getLovelaceViewVars(): TemplateVars | undefined {
    return this._asVariables(this._getViewConfig()?.config_template_card_vars);
  }

  private getLovelaceStaticVars(): TemplateVars | undefined {
    return this._asVariables(this._getDashboardConfig()?.config_template_card_staticVars);
  }

  private getLovelaceViewStaticVars(): TemplateVars | undefined {
    return this._asVariables(this._getViewConfig()?.config_template_card_staticVars);
  }

  /** Entities every config-template-card on this dashboard and view watches (from #171). */
  private getLovelaceEntities(): unknown[] {
    return [
      this._getDashboardConfig()?.config_template_card_entities,
      this._getViewConfig()?.config_template_card_entities,
    ].filter((entities) => entities !== undefined && entities !== null);
  }

  private _asVariables(localVars: unknown): TemplateVars | undefined {
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
      // Template errors are already logged and replaced; anything else unexpected re-renders.
      return true;
    }

    if (oldEntities.length !== currentEntities.length) {
      return true;
    }

    if (currentEntities.some((entityId) => entityId.startsWith('_') && changedProps.has(entityId))) {
      return true;
    }

    return currentEntities.some(
      (entityId, index) =>
        !entityId.startsWith('_') &&
        (entityId !== oldEntities[index] || this.hass?.states[entityId] !== oldHass.states[entityId]),
    );
  }

  public getCardSize(): number | Promise<number> {
    const element = this.shadowRoot?.querySelector('#card > *') as LovelaceCard | null | undefined;
    if (element) {
      return computeCardSize(element);
    }

    // A masonry view sizes each card before adding it to the page, so before this card has
    // rendered: measure the inner card off the page instead of reporting 1 (#45).
    if (this._config?.card) {
      return this._measureUnrendered();
    }

    return 1;
  }

  private async _measureUnrendered(): Promise<number> {
    if (!this._helpers) {
      await this._helpersLoading;
    }
    const hass = this.hass;
    const config = this._config;
    if (!this._helpers || !hass || !config) {
      return 1;
    }

    try {
      if (this._measured?.hass !== hass || this._measured.config !== config) {
        this._measured = { hass, config, element: Promise.resolve(this._buildElement()) };
      }
      return await computeCardSize((await this._measured.element) as unknown as LovelaceCard);
    } catch (error) {
      console.error('config-template-card: unable to measure the card', error);
      return 1;
    }
  }

  /** The element `getCardSize` built, when it still matches the current hass and config. */
  private _takeMeasured(): Promise<CreatedElement> | undefined {
    const measured = this._measured;
    this._measured = undefined;
    return measured?.hass === this.hass && measured?.config === this._config ? measured?.element : undefined;
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

    const element = this._takeMeasured() ?? this._buildElement();
    if (!isThenable(element)) {
      this._lastRendered = this._wrapElement(element);
      return this._lastRendered;
    }

    // Keep showing the previous render until the async templates settle.
    const settled = element.then((resolved) => {
      this._lastRendered = this._wrapElement(resolved);
      return this._lastRendered;
    });
    return html`${until(settled, this._lastRendered ?? nothing)}`;
  }

  private _wrapElement(element: CreatedElement): TemplateResult {
    return html` <div id="card">${element}</div> `;
  }

  /** Evaluates the config's templates and creates the inner card, row or element from the result. */
  private _buildElement(): CreatedElement | Promise<CreatedElement> {
    // Static variables that return Promises settle first; regular variables are then rebuilt.
    const statics = this._getStatics(this.hass);
    if (statics.pending) {
      return statics.pending.then(() => this._buildElement());
    }
    return this._buildWithContext(this._getContext(this.hass));
  }

  private _buildWithContext(context: EvalContext): CreatedElement | Promise<CreatedElement> {
    if (context.pending) {
      // Every render using this context waits for the same async variables to settle.
      return context.pending.then(() => this._buildWithContext({ ...context, pending: undefined }));
    }

    const sourceConfig = this._config?.card ?? this._config?.row ?? this._config?.element;
    // Evaluation builds new objects, so the stored config is never mutated.
    context.output = undefined;
    const config = this._evaluateValue(sourceConfig, context, true) as ConfigObject;
    context.output = undefined;
    const style = this._config?.style ? this._evaluateValue(this._config.style, context) : {};

    if (containsThenable(config) || containsThenable(style)) {
      return Promise.all([resolveDeep(config), resolveDeep(style)]).then(([resolvedConfig, resolvedStyle]) =>
        this._createElement(resolvedConfig as ConfigObject, resolvedStyle),
      );
    }

    return this._createElement(config, style);
  }

  private _createElement(config: ConfigObject, style: unknown): CreatedElement {
    const helpers = this._helpers as CardHelpers;
    const styleRecord = this._asStyleRecord(style);

    const element = this._config?.card
      ? helpers.createCardElement(config)
      : this._config?.row
        ? helpers.createRowElement(config)
        : helpers.createHuiElement(config);
    element.hass = this.hass;

    if (this._config?.element) {
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

    return element;
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

  /**
   * Evaluates a config object. With `asOutput`, the result is exposed to its own templates as
   * `output` while it is built, so a template can read keys evaluated before it (from #159).
   */
  private _evaluateConfig(config: ConfigObject, asOutput = false): ConfigObject {
    const context = this._getContext(this.hass);
    context.output = undefined;
    return this._evaluateValue(config, context, asOutput) as ConfigObject;
  }

  /**
   * Resolves the watched entity ids. `entities` may be a list whose items are templates, or a
   * single template that evaluates to a list; nested lists are flattened. Ids containing `*` are
   * expanded to the matching entities in `hass` (#95).
   */
  private _resolveEntities(hass: HomeAssistant): string[] {
    // Dashboard and view entities are watched by every card, in addition to the card's own.
    const entities = [...this.getLovelaceEntities(), this._config?.entities].filter((source) => source !== undefined);
    if (entities.length === 0) {
      return [];
    }

    const context = this._getContext(hass);
    context.output = undefined;
    const evaluated = this._evaluateValue(entities, context);
    const list = Array.isArray(evaluated) ? evaluated.flat(Infinity) : [evaluated];

    if (list.some(isThenable)) {
      console.warn(
        'config-template-card: async templates are ignored in `entities`, which must be known synchronously',
      );
    }

    const ids = list
      .filter((entity) => entity !== undefined && entity !== null && !isThenable(entity))
      .map((entity) => String(entity));
    return expandWildcards(ids, Object.keys(hass.states));
  }

  private _evaluateTemplate(template: string, hassOverride?: HomeAssistant): unknown {
    if (!template.includes('${')) {
      return template;
    }

    return this._evaluateString(template, this._getContext(hassOverride ?? this.hass));
  }

  private _evaluateValue(value: unknown, context: EvalContext, isOutputRoot = false): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this._evaluateValue(item, context));
    }

    if (value && typeof value === 'object') {
      // A nested config-template-card evaluates its own templates with its own variables.
      if ((value as ConfigObject).type === NESTED_CARD_TYPE) {
        return value;
      }

      const result: ConfigObject = {};
      if (isOutputRoot) {
        context.output = result;
      }
      Object.entries(value as ConfigObject).forEach(([key, entry]) => {
        result[key] = this._evaluateValue(entry, context);
      });
      return result;
    }

    if (typeof value === 'string') {
      if (value.startsWith(LITERAL_PREFIX)) {
        return value.slice(LITERAL_PREFIX.length);
      }
      if (value.includes('${')) {
        return this._evaluateString(value, context);
      }
    }

    return value;
  }

  private _evaluateString(template: string, context: EvalContext): unknown {
    const code = singleTemplateCode(template);
    if (code !== undefined) {
      // The whole value is one template: keep the result's type (number, array, object, ...).
      return this._runCode(code, context, template, 'template', null);
    }

    const parts = splitTemplate(template).map((part) =>
      part.kind === 'text' ? part.value : this._runCode(part.value, context, template, 'template', EMBEDDED_ERROR_TEXT),
    );
    if (parts.some(isThenable)) {
      return Promise.all(parts).then((values) => values.map((value) => String(value)).join(''));
    }
    return parts.map((value) => String(value)).join('');
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
    const statics = this._getStatics(hass);
    // Dashboard, then view, then card variables: each level can build on (and override) the one before.
    const { arraySources, namedSources } = this._collectSources([
      this.getLovelaceConfig(),
      this.getLovelaceViewVars(),
      this._config?.variables,
    ]);

    // Bare names cover static and regular variables; a regular variable overrides a static one.
    const names = [
      ...new Set([...statics.names, ...Object.keys(namedSources).filter((name) => IDENTIFIER.test(name))]),
    ];
    const context: EvalContext = {
      hass,
      config: this._config,
      vars: [] as unknown as EvalVars,
      svars: statics.svars,
      names,
      values: names.map((name) => statics.values[statics.names.indexOf(name)]),
      arraySources,
      namedSources,
    };

    context.pending = this._evaluateSources(context, context.vars, 'variables');
    return context;
  }

  /**
   * Static variables are evaluated once, the first time hass is available after `setConfig`, and
   * reused until the config changes (from #159).
   */
  private _getStatics(hass: HomeAssistant | undefined): StaticVars {
    if (this._statics) {
      return this._statics;
    }

    const { arraySources, namedSources } = this._collectSources([
      this.getLovelaceStaticVars(),
      this.getLovelaceViewStaticVars(),
      this._config?.staticVariables,
    ]);
    const names = Object.keys(namedSources).filter((name) => IDENTIFIER.test(name));
    const svars = [] as unknown as EvalVars;
    const context: EvalContext = {
      hass,
      config: this._config,
      vars: [] as unknown as EvalVars,
      svars,
      names,
      values: names.map(() => undefined),
      arraySources,
      namedSources,
    };

    const pending = this._evaluateSources(context, svars, 'staticVariables');
    const statics: StaticVars = { svars, names, values: context.values };
    if (pending) {
      statics.pending = pending.then(() => {
        statics.pending = undefined;
        // Regular variables built while static ones were pending saw Promises; rebuild them.
        this._contextCache = undefined;
      });
    }
    if (hass) {
      this._statics = statics;
    }
    return statics;
  }

  private _collectSources(sources: unknown[]): { arraySources: unknown[]; namedSources: Record<string, unknown> } {
    const arraySources: unknown[] = [];
    const namedSources: Record<string, unknown> = {};
    for (const source of sources) {
      if (Array.isArray(source)) {
        arraySources.push(...source);
      } else if (source && typeof source === 'object') {
        Object.assign(namedSources, source);
      }
    }
    return { arraySources, namedSources };
  }

  /**
   * Evaluates the context's variable sources into `target`; each can use the ones before it.
   * Variables that return a Promise are filled in once it settles, and the returned Promise settles
   * when all of them have (undefined when none are async).
   */
  private _evaluateSources(context: EvalContext, target: EvalVars, label: string): Promise<void> | undefined {
    const pending: Promise<void>[] = [];
    const assign = (value: unknown, set: (resolved: unknown) => void): void => {
      set(value);
      if (isThenable(value)) {
        pending.push(Promise.resolve(value).then(set));
      }
    };

    context.arraySources.forEach((source, index) => {
      target.push(undefined);
      assign(this._evaluateVariable(source, context, `${label}[${index}]`), (value) => {
        target[index] = value;
      });
    });

    Object.keys(context.namedSources).forEach((name) => {
      const position = context.names.indexOf(name);
      assign(this._evaluateVariable(context.namedSources[name], context, name), (value) => {
        target[name] = value;
        if (position >= 0) {
          context.values[position] = value;
        }
      });
    });

    return pending.length > 0 ? Promise.all(pending).then(() => undefined) : undefined;
  }

  private _evaluateVariable(source: unknown, context: EvalContext, variableName: string): unknown {
    if (typeof source !== 'string') {
      return source;
    }

    if (source.startsWith(LITERAL_PREFIX)) {
      return source.slice(LITERAL_PREFIX.length);
    }

    // Variables are plain code, but a variable written as `${...}` is accepted too.
    const code = singleTemplateCode(source) ?? source;
    return this._runCode(code, context, source, variableName, null);
  }

  /**
   * Runs one template or variable. A failure is logged and replaced by `fallback`, so one broken
   * template doesn't blank the whole card (from #159).
   */
  private _runCode(
    code: string,
    context: EvalContext,
    template: string,
    variableName: string,
    fallback: unknown,
  ): unknown {
    const hass = context.hass;
    const logError = (error: unknown): void => {
      console.error('Failed to evaluate template expression', {
        template,
        expression: code,
        variableName,
        namedVariables: context.namedSources,
        arrayVariables: context.arraySources,
        evaluatedVariables: context.vars,
        error,
      });
    };

    try {
      const result = this._compile(code, context.names).apply(this, [
        hass,
        hass?.states,
        hass?.user,
        context.vars,
        context.svars,
        context.config,
        context.output,
        ...context.values,
      ]);
      if (isThenable(result)) {
        // A rejected async template is logged and replaced, like a synchronous failure.
        return Promise.resolve(result).catch((error: unknown) => {
          logError(error);
          return fallback;
        });
      }
      return result;
    } catch (error) {
      logError(error);
      return fallback;
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

    const params = ['hass', 'states', 'user', 'vars', 'svars', 'config', 'output', ...names];
    const usesAwait = /\bawait\b/.test(code);
    const evalRunner = (): CompiledTemplate => {
      const runner = new Function(...params, CODE_PARAM, `return eval(${CODE_PARAM});`) as CompiledTemplate;
      return function (this: unknown, ...args: unknown[]) {
        return runner.apply(this, [...args, code]);
      };
    };

    const compiled =
      tryCompile(Function, params, `return (\n${code}\n);`) ??
      // `${(await fetchThings()).map(...)}`: an expression that awaits (from #149).
      (usesAwait ? tryCompile(AsyncFunction, params, `return (\n${code}\n);`) : undefined) ??
      // Statements: eval returns the last statement's value, so no `return` is needed.
      (tryCompile(Function, params, code) ? evalRunner() : undefined) ??
      // Statements that await need an explicit `return`, since eval can't await.
      (usesAwait ? tryCompile(AsyncFunction, params, code) : undefined) ??
      // Not valid JavaScript: let eval report the SyntaxError when it runs.
      evalRunner();

    this._compiled.set(key, compiled);
    return compiled;
  }
}
