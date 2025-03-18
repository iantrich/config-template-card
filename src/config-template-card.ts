import { LitElement, html, TemplateResult, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';
import { computeCardSize, HomeAssistant, LovelaceCard } from 'custom-card-helpers';

import { Config, SVarMgr, VarMgr, Vars, ObjMap } from './types';
import { VERSION } from './version';
import { assertNotNull, isString, isPromise, somePromise } from './util';

console.info(
  `%c  CONFIG-TEMPLATE-CARD  \n%c  Version ${VERSION}         `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

@customElement('config-template-card')
export class ConfigTemplateCard extends LitElement {

  // External interactions:
  //
  // Lit updates are triggered by changing any "property" or "state" variables, or by explicitly
  // calling `this.requestUpdate()`.
  //
  // After a Lit update has been triggered, Lit will call `shouldUpdate(changedProps)`, and if that
  // returns `true` then Lit will call `render()`.
  // When performing async Lit rendering using `until()`, Lit should not begin a new update until
  // the prior async update has completed.  However, this code is designed to be able to handle
  // parallel updates anyway.
  //
  // When HA state changes, HA will set `hass`.
  // When HA config changes, HA will call `setConfig(config)`.
  // When the global (dashboard wide) 'config_template_card_*' config changes, nothing happens;
  // Users should reload their browser after changing the global config.
  //
  // After construction, the following will be triggered in an unspecified order:
  // * Lit will trigger an update
  // * HA will call `setConfig(config)` (which will trigger another update)
  // * HA will set `hass` (which will trigger another update)
  //
  // It is not clear whether the global config is available at construction time, and it is only
  // used here in combination with the local config, so we don't retrieve it until `setConfig()` is
  // called.

  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: Config;
  @state() private _helpers?: any;

  private _globalConfig: { svars: any, vars: any } = { svars: undefined, vars: undefined };
  private _svarMgr?: SVarMgr;
  private _initialized = false;
  private _tmpVarMgr?: VarMgr;

  public constructor() {
    super();
    void this.loadCardHelpers();
  }

  public setConfig(config?: Config): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    if (!config.card && !config.row && !config.element) {
      throw new Error('No card or row or element defined');
    }
    if ([config.card, config.row, config.element].filter(v => v).length > 1) {
      throw new Error('Only one of card/row/element can be defined');
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
    if (!config.element && config.style) {
      throw new Error('style can only be used with element');
    }
    this._config = config;

    this._globalConfig = this.getLovelaceConfig();

    // Force re-evaluation of staticVariables
    this._svarMgr = undefined;
    this._initialized = false;
    this._initialize();
  }

  private async loadCardHelpers(): Promise<void> {
    this._helpers = await (window as any).loadCardHelpers();
  }

  private getLovelacePanel(): any {
    const ha = document.querySelector('home-assistant');
    if (ha?.shadowRoot) {
      const haMain = ha.shadowRoot.querySelector('home-assistant-main');
      if (haMain?.shadowRoot) {
        return haMain.shadowRoot.querySelector('ha-panel-lovelace');
      }
    }
    return null;
  }

  private getLovelaceConfig(): any {
    const panel = this.getLovelacePanel();
    return {
      svars: panel?.lovelace?.config?.config_template_card_staticVars,
      vars: panel?.lovelace?.config?.config_template_card_vars,
    };
  }

  public getCardSize(): number | Promise<number> {
    if (this.shadowRoot) {
      // eslint improperly parses this assertion, but typescript handles it properly
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const element = this.shadowRoot.querySelector('#card > *') as LovelaceCard | null;
      if (element) {
        Promise.resolve(computeCardSize(element)).then((size) => {
          console.log('config-template-card computeCardSize is ' + String(size));
        }, () => undefined);
        return computeCardSize(element);
      }
    }
    return 1;
  }

  private _initialize(): boolean {
    // _initSVars() requires hass and _config
    if (!this.hass || !this._config) { return false; }

    // shouldUpdate() requires _svarMgr to be settled
    if (!this._svarMgr) {
      this._svarMgr = this._evaluateVars(true);
      if (this._svarMgr._svarsPromise) {
        void this._svarMgr._svarsPromise.then((v) => {
          // Explicitly trigger an update after svars has settled
          this.requestUpdate();
          return v;
        });
        return false;
      }
    } else {
      if (this._svarMgr._svarsPromise) { return false; }
    }

    // render() requires hass, _config, and _helpers
    if (!this._helpers) { return false; }

    this._initialized = true;
    return true;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this._initialized) { return this._initialize(); }
    assertNotNull(this._config);  // TypeScript can't detect the gate in _initialize()
    assertNotNull(this.hass);  // TypeScript can't detect the gate in _initialize()

    if (changedProps.has('_config')) { return true; }

    const oldHass = changedProps.get('hass') as HomeAssistant | undefined;
    if (oldHass) {
      if (!this._config.entities) { return false; }
      const varMgr = this._evaluateVars(false);
      // Cache the evaluated variables to avoid requiring render() to evaluate them again
      this._tmpVarMgr = varMgr;
      const entities = this._evaluateStructureSimple(varMgr, this._config.entities, false);
      if (entities instanceof Array) {
        for (const entity of entities) {
          if (isPromise(entity)) {
            console.warn("Ignoring asynchronous function in config-template-card 'entities'. Asynchronous functions are not permitted in 'entities'.");
            continue;
          }
          if (!isString(entity)) {
            console.warn("Ignoring non-string value in config-template-card 'entities'. Only string values are permitted in 'entities'.");
            continue;
          }
          if (oldHass.states[entity] !== this.hass.states[entity]) {
            return true;
          }
        }
      } else {
        console.error("config-template-card 'entities' must be an array or a template that returns an array");
      }
      return false;
    }

    // If anything else changed then re-render
    return true;
  }

  protected render(): TemplateResult {
    if (!this._initialized) { return html``; }  // Shouldn't happen

    let varMgr = this._tmpVarMgr;
    this._tmpVarMgr = undefined;
    if (!varMgr) { varMgr = this._evaluateVars(false); }  // Shouldn't happen

    return html`${until(this._getElement(varMgr))}`;
  }

  private async _getElement(varMgr: VarMgr): Promise<TemplateResult> {
    assertNotNull(this._config);  // TypeScript can't detect the gate in _initialize()

    if (varMgr._varsPromise) { await varMgr._varsPromise; }

    let configSection: ObjMap | undefined
      = (this._config.card ?? this._config.row ?? this._config.element);
    const csPromises = [];
    this._evaluateStructure(varMgr, configSection, ((r) => { varMgr.output = r; }), csPromises);
    if (csPromises.length > 0) { await Promise.all(csPromises); }
    configSection = varMgr.output;
    if (typeof configSection !== 'object') {
      console.error('config-template-card card/row/element must be an object');
      return html``;
    }

    const element = this._config.card
      ? this._helpers.createCardElement(configSection)
      : this._config.row
        ? this._helpers.createRowElement(configSection)
        : this._helpers.createHuiElement(configSection);
    element.hass = this.hass;

    if (this._config.element) {
      if (this._config.style) {
        let style = this._config.style;
        style = await this._evaluateStructureSimple(varMgr, style);
        Object.keys(style).forEach((prop) => {
          this.style.setProperty(prop, style[prop]);
        });
      }
      if ('style' in configSection && typeof configSection.style === 'object') {
        Object.keys(configSection.style as object).forEach((prop) => {
          assertNotNull(configSection.style);  // TypeScript can't detect the enclosing if()
          element.style.setProperty(prop, configSection.style[prop]);
        });
      }
    }

    return html`<div id="card">${element}</div>`;
  }

  private _evaluateVars(doStatic: false): VarMgr;
  private _evaluateVars(doStatic: true): SVarMgr;
  private _evaluateVars(doStatic) {
    assertNotNull(this.hass);  // TypeScript can't detect the gate in _initialize()
    assertNotNull(this._config);  // TypeScript can't detect the gate in _initialize()

    let globalVars: Vars | undefined;
    let localVars: Vars | undefined;
    if (doStatic) {
      globalVars = this._globalConfig.svars;
      localVars = this._config.staticVariables;
    } else {
      globalVars = this._globalConfig.vars;
      localVars = this._config.variables;
    }

    const arrayVars: any[] = [];
    const namedVars: ObjMap = {};
    if (globalVars) {
      if (Array.isArray(globalVars)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        arrayVars.push(...globalVars);
      } else {
        Object.assign(namedVars, globalVars);
      }
    }
    if (localVars) {
      if (Array.isArray(localVars)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        arrayVars.push(...localVars);
      } else {
        Object.assign(namedVars, localVars);
      }
    }

    const varMgr: VarMgr = {
      hass: this.hass, states: this.hass.states, user: this.hass.user, config: this._config,
      svars: this._svarMgr?.svars ?? [], _evalInitSVars: this._svarMgr?._evalInitSVars ?? '',
      vars: (doStatic ? undefined : []), _evalInitVars: '',
      output: undefined,
    };
    const vars: Vars = (doStatic ? varMgr.svars : (varMgr.vars as Vars));
    const promises: Promise<any>[] = [];
    const initKey = (doStatic ? '_evalInitSVars' : '_evalInitVars');
    const initRef = (doStatic ? 'svars' : 'vars');

    arrayVars.forEach((v, i) => {
      if (isString(v)) {
        let out = this._evaluateTemplate(varMgr, v, true);
        if (isPromise(out)) {
          out = out.then((r) => { vars[i] = r; });
          promises.push(out as Promise<any>);
        }
        vars[i] = out;
      } else {
        this._evaluateStructure(varMgr, v, ((r) => { vars[i] = r; }), promises);
      }
    });
    Object.entries(namedVars).forEach(([k, v], _i) => {
      if (isString(v)) {
        let out = this._evaluateTemplate(varMgr, v, true);
        if (isPromise(out)) {
          out = out.then((r) => { vars[k] = r; });
          promises.push(out as Promise<any>);
        }
        vars[k] = out;
      } else {
        this._evaluateStructure(varMgr, v, ((r) => { vars[k] = r; }), promises);
      }
      // Note that if `staticVariables` and `variables` both contain a variable with the same name
      // then `_evalInitSVars + _evalInitVars` will end up defining the variable twice.  This
      // shouldn't be a problem, since the second definition will simply override the first.
      // However, if browsers/JavaScript are changed so that re-defining a variable causes a warning
      // or error then we may need to explicitly remove duplicates from `_evalInitSVars`.
      varMgr[initKey] += `var ${k} = ${initRef}['${k}'];\n`;
    });

    if (doStatic) {
      const svarMgr: SVarMgr = {
        svars: vars, _evalInitSVars: varMgr._evalInitSVars,
      };
      if (promises.length > 0) {
        svarMgr._svarsPromise = Promise.all(promises).then((_a) => {
          svarMgr._svarsPromise = undefined;
        });
      }
      return svarMgr;
    } else {
      if (promises.length > 0) {
        varMgr._varsPromise = Promise.all(promises).then((_a) => {
          varMgr._varsPromise = undefined;
        });
      }
      return varMgr;
    }
  }

  // If `promise` is `true` (the default) then this returns either the complete evaluated structure,
  // or a Promise that will settle with the complete evaluated structure when all Promises returned
  // by all nested templates have settled.
  //
  // If `promise` is `false` then this returns the complete evaluated structure with any Promises
  // returned by templates stored in that structure.  This is intended to support cases where
  // Promises are not supported and will be ignored by the caller.
  //
  private _evaluateStructureSimple(varMgr: VarMgr, struct: any, promise = true): any {
    let ret; const promises = [];
    this._evaluateStructure(varMgr, struct, ((r) => { ret = r; }), promises);
    if (promise && promises.length > 0) {
      return Promise.all(promises).then((_a) => ret);
    }
    return ret;
  }

  // To facilitate both access to the incomplete structure as it is being built and efficient
  // aggregation of Promises, this function does not return any values and instead provides output
  // via `immediateAssign` and `promises`.
  //
  // The `immediateAssign` callback will be called with the new top-level object as soon as it is
  // created (before it is populated). That object will then be populated depth-first. Any Promises
  // returned by templates will be stored nested within that object, and will replace themselves
  // with the settled value as soon as they settle.  If the top-level object is a template that
  // returns a Promise then `immediateAssign` will be called a second time when the Promise settles.
  //
  // `promises` must be an array, which will have all nested Promises added to it before this
  // function returns.  The caller may then `await Promise.all(promises)` to wait for all Promises
  // to settle.
  //
  private _evaluateStructure(
    varMgr: VarMgr, struct: any,
    immediateAssign: ((ret: any) => void), promises: Promise<any>[],
  ): any {
    if (struct instanceof Array) {
      const out: any[] = [];
      immediateAssign(out);
      struct.forEach((v, i) => {
        this._evaluateStructure(varMgr, v, ((r) => { out[i] = r; }), promises);
      });

    } else if (typeof struct === 'object') {
      const out: ObjMap = {};
      immediateAssign(out);
      Object.entries(struct as ObjMap).forEach(([k, v], _i) => {
        this._evaluateStructure(varMgr, v, ((r) => { out[k] = r; }), promises);
      });

    } else if (isString(struct)) {
      let out = this._evaluateTemplate(varMgr, struct);
      if (isPromise(out)) {
        out = out.then((r) => { immediateAssign(r); });
        promises.push(out as Promise<any>);
      }
      immediateAssign(out);

    } else {
      const out = structuredClone(struct);
      immediateAssign(out);

    }
  }

  private _evaluateTemplate(varMgr: VarMgr, template: string, withoutDelim = false): any {
    // Disable template evaluation if `$! ` prefix is present.
    if (template.startsWith('$! ')) {
      return template.substring(3, template.length);
    }

    // Old (deprecated) `${...}` template syntax.
    if (template.startsWith('${') && template.endsWith('}')) {
      // Entire value is a template, partial or multiple template values are not supported.
      // Return eval result directly to preserve types other than string (eg. numbers).
      return this._evalWithVars(varMgr, template.substring(2, template.length - 1));
    }

    // New `<$...$>` template syntax.
    const matches = template.match(/<\$.*?\$>/g);
    if (matches) {
      if (matches.length == 1 && matches[0].length == template.length) {
        // Return eval result directly to preserve types other than string (eg. numbers).
        return this._evalWithVars(varMgr, template.substring(2, template.length - 2));
      }
      const repls = matches.map((m, _i) => {
        return [m, this._evalWithVars(varMgr, m.substring(2, m.length - 2), '<error>')]
      });
      if (somePromise(repls.map(([_m, r], _i) => r))) {
        return Promise.all(repls.map(([m, p]) =>
          Promise.resolve(p).then((r) => [m, r])
        )).then((a) => {
          let t = template;
          a.forEach(([m, r]) => t = t.replace(m as string, String(r)));
          return t;
        });
      } else {
        repls.forEach(([m, r]) => template = template.replace(m as string, String(r)));
        return template;
      }
    }

    if (withoutDelim) {
      return this._evalWithVars(varMgr, template);
    }

    return template;
  }

  private _evalInitBase = (
    "'use strict'; undefined;\n" +
    'var hass = globalThis._varMgr.hass;\n' +
    'var states = globalThis._varMgr.states;\n' +
    'var user = globalThis._varMgr.user;\n' +
    'var config = globalThis._varMgr.config;\n' +
    'var svars = globalThis._varMgr.svars;\n' +
    'var vars = globalThis._varMgr.vars;\n' +
    'var output = globalThis._varMgr.output;\n' +
  '');

  private _evalWithVars(varMgr: VarMgr, template: string, exceptRet: any = null): any {
    // "direct" eval() is considered insecure and generates warnings, so use "indirect" eval().
    //
    // "indirect" eval() sets `this` to `globalThis`/`window`, and does not support changing `this`
    // except by calling a function or class within the eval() (which would break the implicit
    // return semantics that we rely on for most use cases).
    //
    // Variables can only be passed between this code and "indirect" eval() code via the global
    // scope (`globalThis`).
    //
    // For backward compatibility, `this.hass` must be available to evaluated templates.
    //
    // "indirect" eval() runs in non-strict mode by default, which causes new local variables to be
    // added to `this` and pollute the global scope.  Explicitly switching to strict mode within the
    // eval() disables adding local variables to `this` and avoids polluting the global scope.
    //
    // In addition to switching to strict mode, the `'use strict';` statement also sets the implicit
    // return value to 'use strict', which isn't what we want if the template is empty.  Therefore
    // we explicitly follow it with `undefined;` to reset the implicit return value.

    // In case there are conflicting global variables
    const origVarMgr = globalThis._varMgr;
    const origHass = globalThis.hass;

    try {
      globalThis._varMgr = varMgr;
      globalThis.hass = this.hass;
      const initBase = this._evalInitBase;
      const initSVars = varMgr._evalInitSVars;
      const initVars = varMgr._evalInitVars;
      const indirectEval = eval;

      const ret = indirectEval(initBase + initSVars + initVars + template);

      if (isPromise(ret)) {
        return ret.catch((e: unknown) => {
          console.error('config-template-card template error:', e);
          return exceptRet;
        });
      }
      return ret;
    } catch(e) {
      console.error('config-template-card template error:', e);
      return exceptRet;
    } finally {
      if (origVarMgr) { globalThis._varMgr = origVarMgr; } else { delete globalThis._varMgr; }
      if (origHass) { globalThis.hass = origHass; } else { delete globalThis.hass; }
    }
  }
}
