import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigTemplateCard } from './config-template-card';

describe('ConfigTemplateCard logic', () => {
  const baseConfig = {
    type: 'custom:config-template-card',
    entities: ['light.kitchen'],
    card: { type: 'entities' },
  };

  let card: ConfigTemplateCard;

  beforeEach(() => {
    card = new ConfigTemplateCard();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as { loadCardHelpers?: unknown }).loadCardHelpers;
  });

  it('setConfig throws for invalid config shapes', () => {
    expect(() => card.setConfig(undefined as unknown as never)).toThrow('Invalid configuration');
    expect(() => card.setConfig({ type: 'x', entities: [] } as never)).toThrow('No card or row or element defined');
    expect(() =>
      card.setConfig({
        type: 'x',
        entities: ['light.kitchen'],
        card: {} as never,
      } as never),
    ).toThrow('No card type defined');
  });

  it('setConfig calls loadCardHelpers on valid config', () => {
    const spy = vi
      .spyOn(card as unknown as { loadCardHelpers: () => void }, 'loadCardHelpers')
      .mockImplementation(() => {
        return undefined;
      });

    card.setConfig(baseConfig as never);

    expect(spy).toHaveBeenCalledOnce();
  });

  it('_asStyleRecord stringifies scalar values and ignores nullish', () => {
    const styleRecord = (
      card as unknown as { _asStyleRecord: (value: unknown) => Record<string, string> | undefined }
    )._asStyleRecord({
      '--x': 10,
      '--y': true,
      '--z': null,
    });

    expect(styleRecord).toEqual({ '--x': '10', '--y': 'true' });
    expect(
      (card as unknown as { _asStyleRecord: (value: unknown) => Record<string, string> | undefined })._asStyleRecord(
        [],
      ),
    ).toBeUndefined();
  });

  it('_evaluateTemplate resolves vars from config array variables', () => {
    card.hass = {
      user: { name: 'Dev' },
      states: {
        'light.kitchen': { state: 'on' },
      },
    } as never;
    (card as unknown as { _config: unknown })._config = {
      ...baseConfig,
      variables: ["states['light.kitchen'].state"],
    };

    const value = (
      card as unknown as {
        _evaluateTemplate: (template: string) => unknown;
      }
    )._evaluateTemplate("${vars[0] === 'on' ? 'Light On' : 'Light Off'}");

    expect(value).toBe('Light On');
  });

  it('_evaluateTemplate works when _config.variables is undefined', () => {
    card.hass = {
      states: {
        'light.kitchen': { state: 'on' },
      },
    } as never;

    (card as unknown as { _config: unknown })._config = {
      ...baseConfig,
      variables: undefined,
    };

    const value = (
      card as unknown as {
        _evaluateTemplate: (template: string) => unknown;
      }
    )._evaluateTemplate("${states['light.kitchen'].state}");

    expect(value).toBe('on');
  });

  it('_evaluateConfig recursively evaluates template strings', () => {
    card.hass = {
      user: { name: 'Dev' },
      states: {
        'light.kitchen': { state: 'on' },
      },
    } as never;
    (card as unknown as { _config: unknown })._config = {
      ...baseConfig,
      variables: ["states['light.kitchen'].state"],
    };

    const evaluated = (
      card as unknown as {
        _evaluateConfig: (config: Record<string, unknown>) => Record<string, unknown>;
      }
    )._evaluateConfig({
      title: "${vars[0] === 'on' ? 'Enabled' : 'Disabled'}",
      nested: {
        array: ['${user.name}', 1],
      },
    });

    expect(evaluated.title).toBe('Enabled');
    expect((evaluated.nested as { array: unknown[] }).array[0]).toBe('Dev');
  });

  it('shouldUpdate returns true when watched entity state changes', () => {
    (card as unknown as { _initialized: boolean })._initialized = true;
    (card as unknown as { _config: unknown })._config = {
      ...baseConfig,
      entities: ['light.kitchen'],
    };

    card.hass = {
      states: {
        'light.kitchen': {
          state: 'on',
          last_changed: '2',
          last_updated: '2',
        },
      },
    } as never;

    const changedProps = new Map([
      [
        'hass',
        {
          states: {
            'light.kitchen': {
              state: 'off',
              last_changed: '1',
              last_updated: '1',
            },
          },
        },
      ],
    ]);

    const result = (
      card as unknown as {
        shouldUpdate: (props: Map<string, unknown>) => boolean;
      }
    ).shouldUpdate(changedProps);

    expect(result).toBe(true);
  });

  it('shouldUpdate returns false when watched entity state is unchanged', () => {
    (card as unknown as { _initialized: boolean })._initialized = true;
    (card as unknown as { _config: unknown })._config = {
      ...baseConfig,
      entities: ['light.kitchen'],
    };

    const state = {
      state: 'on',
      last_changed: '2',
      last_updated: '2',
    };

    card.hass = {
      states: {
        'light.kitchen': state,
      },
    } as never;

    const changedProps = new Map([
      [
        'hass',
        {
          states: {
            'light.kitchen': state,
          },
        },
      ],
    ]);

    const result = (
      card as unknown as {
        shouldUpdate: (props: Map<string, unknown>) => boolean;
      }
    ).shouldUpdate(changedProps);

    expect(result).toBe(false);
  });

  it('shouldUpdate returns true when templated entity id changes across hass snapshots', () => {
    (card as unknown as { _initialized: boolean })._initialized = true;
    (card as unknown as { _config: unknown })._config = {
      ...baseConfig,
      entities: ['${vars.device}'],
      variables: {
        device: "states['sensor.target_light'].state",
      },
    };

    card.hass = {
      states: {
        'sensor.target_light': { state: 'light.beta' },
        'light.alpha': { state: 'on' },
        'light.beta': { state: 'off' },
      },
    } as never;

    const changedProps = new Map([
      [
        'hass',
        {
          states: {
            'sensor.target_light': { state: 'light.alpha' },
            'light.alpha': { state: 'on' },
            'light.beta': { state: 'off' },
          },
        },
      ],
    ]);

    const result = (
      card as unknown as {
        shouldUpdate: (props: Map<string, unknown>) => boolean;
      }
    ).shouldUpdate(changedProps);

    expect(result).toBe(true);
  });

  it('render dispatches to card, row, or element helper based on config type', () => {
    const helperElementFactory = () => document.createElement('div');
    const helpers = {
      createCardElement: vi.fn(helperElementFactory),
      createRowElement: vi.fn(helperElementFactory),
      createHuiElement: vi.fn(helperElementFactory),
    };

    (card as unknown as { _helpers: unknown })._helpers = helpers;
    card.hass = {
      states: {},
    } as never;

    (card as unknown as { _config: unknown })._config = {
      ...baseConfig,
      card: { type: 'entities' },
      row: undefined,
      element: undefined,
    };
    (card as unknown as { render: () => unknown }).render();
    expect(helpers.createCardElement).toHaveBeenCalledTimes(1);
    expect(helpers.createRowElement).toHaveBeenCalledTimes(0);
    expect(helpers.createHuiElement).toHaveBeenCalledTimes(0);

    helpers.createCardElement.mockClear();
    helpers.createRowElement.mockClear();
    helpers.createHuiElement.mockClear();

    (card as unknown as { _config: unknown })._config = {
      ...baseConfig,
      card: undefined,
      row: { type: 'section' },
      element: undefined,
    };
    (card as unknown as { render: () => unknown }).render();
    expect(helpers.createCardElement).toHaveBeenCalledTimes(0);
    expect(helpers.createRowElement).toHaveBeenCalledTimes(1);
    expect(helpers.createHuiElement).toHaveBeenCalledTimes(0);

    helpers.createCardElement.mockClear();
    helpers.createRowElement.mockClear();
    helpers.createHuiElement.mockClear();

    (card as unknown as { _config: unknown })._config = {
      ...baseConfig,
      card: undefined,
      row: undefined,
      element: { type: 'state-icon' },
    };
    (card as unknown as { render: () => unknown }).render();
    expect(helpers.createCardElement).toHaveBeenCalledTimes(0);
    expect(helpers.createRowElement).toHaveBeenCalledTimes(0);
    expect(helpers.createHuiElement).toHaveBeenCalledTimes(1);
  });

  it('_evaluateTemplate merges dashboard-level and local variables', () => {
    card.hass = {
      user: { name: 'Dev' },
      states: {
        'sensor.global': { state: 'GLOBAL' },
        'sensor.local': { state: 'LOCAL' },
      },
    } as never;

    vi.spyOn(card as unknown as { getLovelaceConfig: () => unknown }, 'getLovelaceConfig').mockReturnValue([
      "states['sensor.global'].state",
    ]);

    (card as unknown as { _config: unknown })._config = {
      ...baseConfig,
      variables: ["states['sensor.local'].state"],
    };

    const value = (
      card as unknown as {
        _evaluateTemplate: (template: string) => unknown;
      }
    )._evaluateTemplate("${vars[0] + '-' + vars[1]}");

    expect(value).toBe('GLOBAL-LOCAL');
  });

  it('_evaluateTemplate logs context and returns null when expression evaluation fails', () => {
    card.hass = {
      states: {},
    } as never;

    (card as unknown as { _config: unknown })._config = {
      ...baseConfig,
      variables: {
        room: "'kitchen'",
      },
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      return undefined;
    });

    const value = (
      card as unknown as {
        _evaluateTemplate: (template: string) => unknown;
      }
    )._evaluateTemplate('${missing.value}');

    expect(value).toBeNull();

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to evaluate template expression',
      expect.objectContaining({
        template: '${missing.value}',
        expression: 'missing.value',
        namedVariables: { room: "'kitchen'" },
        arrayVariables: [],
        evaluatedVariables: expect.objectContaining({ room: 'kitchen' }),
        error: expect.any(Error),
      }),
    );
  });

  it('_waitForCardHelpers resolves when loader appears', async () => {
    vi.useFakeTimers();

    const waitPromise = (
      card as unknown as { _waitForCardHelpers: (timeoutMs: number) => Promise<() => Promise<unknown>> }
    )._waitForCardHelpers(1_000);

    setTimeout(() => {
      (window as { loadCardHelpers?: () => Promise<unknown> }).loadCardHelpers = async () => ({
        createCardElement: vi.fn(),
      });
    }, 150);

    await vi.advanceTimersByTimeAsync(200);

    const loader = await waitPromise;
    expect(typeof loader).toBe('function');
  });

  it('_waitForCardHelpers rejects on timeout when loader is missing', async () => {
    vi.useFakeTimers();

    const waitPromise = (
      card as unknown as { _waitForCardHelpers: (timeoutMs: number) => Promise<() => Promise<unknown>> }
    )._waitForCardHelpers(250);

    const rejectionExpectation = expect(waitPromise).rejects.toThrow(
      'window.loadCardHelpers was not available in time',
    );

    await vi.advanceTimersByTimeAsync(400);

    await rejectionExpectation;
  });

  it('loadCardHelpers sets _helpers and requests update on success', async () => {
    vi.useFakeTimers();

    const helpers = {
      createCardElement: vi.fn(),
      createRowElement: vi.fn(),
      createHuiElement: vi.fn(),
    };

    (window as { loadCardHelpers?: () => Promise<unknown> }).loadCardHelpers = async () => helpers;

    const requestUpdateSpy = vi.spyOn(card, 'requestUpdate');

    const promise = (card as unknown as { loadCardHelpers: () => Promise<void> }).loadCardHelpers();
    await vi.runAllTimersAsync();
    await promise;

    expect((card as unknown as { _helpers?: unknown })._helpers).toBe(helpers);
    expect(requestUpdateSpy).toHaveBeenCalled();
  });

  it('loadCardHelpers catches timeout and keeps helpers undefined', async () => {
    vi.useFakeTimers();

    (window as { loadCardHelpers?: () => Promise<unknown> }).loadCardHelpers = async () => {
      return new Promise(() => {
        // Intentionally never resolves
      });
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      return undefined;
    });

    const promise = (card as unknown as { loadCardHelpers: () => Promise<void> }).loadCardHelpers();
    await vi.advanceTimersByTimeAsync(10_100);
    await promise;

    expect((card as unknown as { _helpers?: unknown })._helpers).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});

type CardInternals = {
  _config: unknown;
  _helpers: unknown;
  _initialized: boolean;
  _evaluateTemplate: (template: string) => unknown;
  shouldUpdate: (props: Map<string, unknown>) => boolean;
  render: () => unknown;
};

describe('ConfigTemplateCard beta regressions', () => {
  const states = {
    'sun.sun': { state: 'above_horizon' },
    'light.kitchen': { state: 'on' },
    'light.bedroom': { state: 'off' },
  };

  let card: ConfigTemplateCard;
  let internals: CardInternals;

  const configure = (overrides: Record<string, unknown> = {}): void => {
    internals._config = {
      type: 'custom:config-template-card',
      entities: ['sun.sun'],
      card: { type: 'entities' },
      ...overrides,
    };
  };

  const evaluate = (template: string): unknown => internals._evaluateTemplate(template);

  beforeEach(() => {
    card = new ConfigTemplateCard();
    internals = card as unknown as CardInternals;
    card.hass = { states, user: { name: 'Dev' } } as never;
    configure({ variables: { VAR: "states['sun.sun'].state" } });
  });

  describe('Lit reactivity', () => {
    it('keeps _config and _helpers reactive instead of shadowing them with class fields', () => {
      expect(Object.prototype.hasOwnProperty.call(card, '_config')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(card, '_helpers')).toBe(false);

      const requestUpdateSpy = vi.spyOn(card, 'requestUpdate');
      internals._helpers = {};
      expect(requestUpdateSpy).toHaveBeenCalledWith('_helpers', undefined, expect.anything());
    });
  });

  describe('shouldUpdate (#201)', () => {
    const unchangedHass = (): Map<string, unknown> => new Map<string, unknown>([['hass', { states }]]);

    it('renders when card helpers arrive alongside an unchanged hass push', () => {
      const changed = unchangedHass();
      expect(internals.shouldUpdate(changed)).toBe(false);

      changed.set('_helpers', undefined);
      expect(internals.shouldUpdate(changed)).toBe(true);
    });

    it('renders when the config changes alongside an unchanged hass push', () => {
      const changed = unchangedHass();
      changed.set('_config', undefined);
      expect(internals.shouldUpdate(changed)).toBe(true);
    });

    it('ignores a watched entity template that fails instead of throwing', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      configure({ entities: ['${missing.entity}', 'sun.sun'] });
      expect(internals.shouldUpdate(unchangedHass())).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
    });

    it('supports entities given as one template that returns a list (#191)', () => {
      configure({ entities: "${Object.keys(states).filter((id) => id.startsWith('light.'))}" });
      const oldStates = { ...states, 'light.bedroom': { state: 'on' } };
      expect(internals.shouldUpdate(new Map<string, unknown>([['hass', { states: oldStates }]]))).toBe(true);
      expect(internals.shouldUpdate(new Map<string, unknown>([['hass', { states }]]))).toBe(false);
    });
  });

  describe('template evaluation', () => {
    it('keeps object literal results', () => {
      expect(evaluate('${ {color: "red", size: 2} }')).toEqual({ color: 'red', size: 2 });
      expect(evaluate('${ {color: "red"} }')).toEqual({ color: 'red' });
    });

    it('supports multi-statement block templates (#191)', () => {
      expect(
        evaluate("${\n  let result = [];\n  ['a', 'b'].forEach((e) => result.push(e + VAR));\n  result;\n}"),
      ).toEqual(['aabove_horizon', 'babove_horizon']);
    });

    it('supports templates embedded in strings (#190)', () => {
      expect(evaluate('state = ${VAR}')).toBe('state = above_horizon');
      expect(evaluate('sensor.${VAR}_forecast')).toBe('sensor.above_horizon_forecast');
    });

    it('supports several templates in one string (#166)', () => {
      expect(evaluate('${VAR} / ${user.name}')).toBe('above_horizon / Dev');
      expect(evaluate('${VAR}${VAR}')).toBe('above_horizonabove_horizon');
    });

    it('leaves backslashes in literal text alone', () => {
      expect(evaluate('C:\\temp ${user.name}')).toBe('C:\\temp Dev');
    });

    it('supports template literals nested in a template', () => {
      expect(evaluate('${ `x-${VAR}` }')).toBe('x-above_horizon');
    });

    it('preserves non-string types for a single template with surrounding whitespace', () => {
      expect(evaluate('${ 1 + 2 }\n')).toBe(3);
    });

    it('exposes the card as `this`, so this.hass works as documented', () => {
      expect(evaluate("${this.hass.states['sun.sun'].state}")).toBe('above_horizon');
    });

    it('does not mistake runtime SyntaxErrors for multi-statement code', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      expect(evaluate("${JSON.parse('{bad')}")).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to evaluate template expression',
        expect.objectContaining({ error: expect.any(SyntaxError) }),
      );
    });
  });

  describe('variables', () => {
    it('supports multi-statement named variables and functions that use earlier ones (#192)', () => {
      configure({
        variables: {
          child: 'const c = "Use Me";\nc;',
          parent: '(passed) => {\n  const p = "Please " + (passed ? passed : child);\n  return p;\n}',
        },
      });

      expect(evaluate("${parent('xxx')}")).toBe('Please xxx');
      expect(evaluate('${parent()}')).toBe('Please Use Me');
    });

    it('accepts variables wrapped in ${} and non-string variable values', () => {
      configure({ variables: { WRAPPED: "${states['sun.sun'].state}", LIMIT: 5 } });
      expect(evaluate('${WRAPPED + LIMIT}')).toBe('above_horizon5');
    });

    it('keeps variables with non-identifier names reachable through vars', () => {
      configure({ variables: { 'my-var': "'dashed'" } });
      expect(evaluate("${vars['my-var']}")).toBe('dashed');
    });

    it('evaluates variables once per hass update rather than once per template', () => {
      const calls = vi.fn(() => 'x');
      (window as unknown as { ctcCount: () => string }).ctcCount = calls;
      configure({ variables: { V: 'window.ctcCount()' } });

      internals._helpers = { createCardElement: vi.fn(() => document.createElement('div')) };
      configure({
        variables: { V: 'window.ctcCount()' },
        card: { type: 'entities', title: '${V}', entities: ['${V}', 'a.${V}'] },
      });
      internals.render();
      expect(calls).toHaveBeenCalledTimes(1);

      card.hass = { states: { ...states }, user: { name: 'Dev' } } as never;
      internals.render();
      expect(calls).toHaveBeenCalledTimes(2);

      delete (window as unknown as { ctcCount?: unknown }).ctcCount;
    });

    it('does not mutate the stored card config while rendering', () => {
      const helpers = { createCardElement: vi.fn(() => document.createElement('div')) };
      internals._helpers = helpers;
      const cardConfig = { type: 'entities', title: '${VAR}' };
      configure({ variables: { VAR: "states['sun.sun'].state" }, card: cardConfig });

      internals.render();

      expect(cardConfig.title).toBe('${VAR}');
      expect(helpers.createCardElement).toHaveBeenCalledWith({ type: 'entities', title: 'above_horizon' });
    });
  });
});

describe('nested config-template-cards', () => {
  const states = {
    'input_boolean.switch': { state: 'on' },
    'input_number.level': { state: '80' },
  };

  const inner = {
    type: 'custom:config-template-card',
    variables: { LEVEL: "states['input_number.level'].state" },
    entities: ['input_number.level'],
    card: { type: 'entities', entities: [{ entity: 'input_number.level', name: 'Inner: level ${parseInt(LEVEL)}' }] },
  };

  const renderOuter = (cardConfig: Record<string, unknown>): ReturnType<typeof vi.fn> => {
    const card = new ConfigTemplateCard();
    const internals = card as unknown as {
      _config: unknown;
      _helpers: unknown;
      render: () => unknown;
    };
    const createCardElement = vi.fn(() => document.createElement('div'));
    card.hass = { states, user: { name: 'Dev' } } as never;
    internals._helpers = { createCardElement };
    internals._config = {
      type: 'custom:config-template-card',
      variables: { SWITCH: "states['input_boolean.switch'].state" },
      entities: ['input_boolean.switch'],
      card: cardConfig,
    };
    internals.render();
    return createCardElement;
  };

  it('leaves a nested card config for the inner card to evaluate', () => {
    const createCardElement = renderOuter({
      type: 'vertical-stack',
      cards: [{ type: 'markdown', content: 'Outer: switch is ${SWITCH}' }, inner],
    });

    expect(createCardElement).toHaveBeenCalledWith({
      type: 'vertical-stack',
      cards: [{ type: 'markdown', content: 'Outer: switch is on' }, inner],
    });
  });

  it('lets the inner card render its own templates with its own variables', () => {
    const innerCard = new ConfigTemplateCard();
    const internals = innerCard as unknown as { _config: unknown; _helpers: unknown; render: () => unknown };
    const createCardElement = vi.fn(() => document.createElement('div'));
    innerCard.hass = { states, user: { name: 'Dev' } } as never;
    internals._helpers = { createCardElement };
    internals._config = inner;
    internals.render();

    expect(createCardElement).toHaveBeenCalledWith({
      type: 'entities',
      entities: [{ entity: 'input_number.level', name: 'Inner: level 80' }],
    });
  });
});

describe('layout', () => {
  it('lets the inner card fill the height given by stacks and grids (#158)', () => {
    const styles = [ConfigTemplateCard.styles].flat() as { cssText: string }[];
    const cssText = styles
      .map((style) => style.cssText)
      .join('\n')
      .replace(/\s+/g, ' ');
    expect(cssText).toContain('#card { height: 100%; }');
  });
});

describe('literal prefix', () => {
  const renderWith = (config: Record<string, unknown>) => {
    const card = new ConfigTemplateCard();
    const internals = card as unknown as { _config: unknown; _helpers: unknown; render: () => unknown };
    const createCardElement = vi.fn((_config: unknown) => document.createElement('div'));
    card.hass = { states: { 'sun.sun': { state: 'above_horizon' } }, user: { name: 'Dev' } } as never;
    internals._helpers = { createCardElement };
    internals._config = { type: 'custom:config-template-card', entities: ['sun.sun'], ...config };
    internals.render();
    return createCardElement.mock.calls[0][0] as unknown as Record<string, unknown>;
  };

  it('passes `$! ` values through untouched, without the prefix', () => {
    const config = renderWith({
      card: {
        type: 'custom:other-card',
        literal: '$! ${this is for the inner card}',
        plain: '$! no template here',
        evaluated: '${user.name}',
      },
    });

    expect(config).toEqual({
      type: 'custom:other-card',
      literal: '${this is for the inner card}',
      plain: 'no template here',
      evaluated: 'Dev',
    });
  });

  it('keeps `$! ` variables as text instead of running them', () => {
    const config = renderWith({
      variables: { RAW: "$! states['sun.sun'].state", RUN: "states['sun.sun'].state" },
      card: { type: 'entities', title: '${RAW} = ${RUN}' },
    });

    expect(config.title).toBe("states['sun.sun'].state = above_horizon");
  });

  it('only treats the exact prefix at the start as literal', () => {
    const config = renderWith({ card: { type: 'entities', a: 'cost $! ${1 + 1}', b: '$!${1 + 1}' } });
    expect(config).toEqual({ type: 'entities', a: 'cost $! 2', b: '$!2' });
  });
});

describe('template errors keep the card rendering', () => {
  const renderWith = (config: Record<string, unknown>) => {
    const card = new ConfigTemplateCard();
    const internals = card as unknown as { _config: unknown; _helpers: unknown; render: () => unknown };
    const createCardElement = vi.fn((_config: unknown) => document.createElement('div'));
    card.hass = { states: { 'sun.sun': { state: 'above_horizon' } }, user: { name: 'Dev' } } as never;
    internals._helpers = { createCardElement };
    internals._config = { type: 'custom:config-template-card', entities: ['sun.sun'], ...config };
    const result = internals.render();
    return { result, config: createCardElement.mock.calls[0]?.[0] as unknown as Record<string, unknown> };
  };

  it('replaces a failing whole-value template with null and a failing embedded one with <error>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result, config } = renderWith({
      card: {
        type: 'entities',
        title: "${states['sensor.missing'].state}",
        entities: [{ entity: 'sun.sun', name: "Sun is ${states['sun.sun'].state}, ${states['sensor.missing'].state}" }],
      },
    });

    expect(result).toBeDefined();
    expect(config).toEqual({
      type: 'entities',
      title: null,
      entities: [{ entity: 'sun.sun', name: 'Sun is above_horizon, <error>' }],
    });
  });

  it('keeps rendering when a variable fails, with the variable set to null', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { config } = renderWith({
      variables: { BROKEN: "states['sensor.missing'].state", OK: "states['sun.sun'].state" },
      card: { type: 'entities', title: '${BROKEN === null ? "fallback" : BROKEN} / ${OK}' },
    });

    expect(config.title).toBe('fallback / above_horizon');
  });
});

describe('config and output template variables', () => {
  const states = {
    'binary_sensor.door': { state: 'on' },
    'sensor.phone_battery': { state: '80' },
    'sensor.tablet_battery': { state: '40' },
    'sun.sun': { state: 'above_horizon' },
  };

  const setup = (config: Record<string, unknown>) => {
    const card = new ConfigTemplateCard();
    const internals = card as unknown as {
      _config: unknown;
      _helpers: unknown;
      render: () => unknown;
      _resolveEntities: (hass: unknown) => string[];
    };
    const createCardElement = vi.fn((_config: unknown) => document.createElement('div'));
    const hass = { states, user: { name: 'Dev' } };
    card.hass = hass as never;
    internals._helpers = { createCardElement };
    internals._config = { type: 'custom:config-template-card', entities: ['sun.sun'], ...config };
    const render = () => {
      internals.render();
      return createCardElement.mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>;
    };
    return { render, resolveEntities: () => internals._resolveEntities(hass) };
  };

  it('exposes the card config as `config` (#160: abstract the entity)', () => {
    const { render } = setup({
      card: {
        type: 'entity',
        entity: 'binary_sensor.door',
        name: "${states[config.card.entity].state === 'on' ? 'Activated' : 'Deactivated'}",
      },
    });

    expect(render().name).toBe('Activated');
  });

  it('reads other card options and custom top-level keys from `config` (#169, #168)', () => {
    const { render } = setup({
      secret_option: 'from a top-level key',
      card: {
        type: 'history-graph',
        title: "${Number(config.card.hours_to_show) >= 24 ? 'day or more' : 'less than a day'}",
        hours_to_show: 4,
        name: '${config.secret_option}',
      },
    });

    const config = render();
    expect(config.title).toBe('less than a day');
    expect(config.name).toBe('from a top-level key');
  });

  it('exposes the card config built so far as `output` (#169)', () => {
    const { render } = setup({
      variables: { ENTITIES: "Object.keys(states).filter((id) => id.includes('battery'))" },
      card: { type: 'entities', entities: '${ENTITIES}', title: 'total: ${output.entities.length}' },
    });

    expect(render()).toEqual({
      type: 'entities',
      entities: ['sensor.phone_battery', 'sensor.tablet_battery'],
      title: 'total: 2',
    });
  });

  it('does not leak a previous render’s `output` into the watched entities', () => {
    const { render, resolveEntities } = setup({
      entities: ["${output === undefined ? 'sun.sun' : 'sensor.stale'}"],
      card: { type: 'entities', title: 'x' },
    });

    render();
    expect(resolveEntities()).toEqual(['sun.sun']);
  });
});

describe('static variables', () => {
  const states = { 'sun.sun': { state: 'above_horizon' }, 'input_number.level': { state: '40' } };

  const setup = (config: Record<string, unknown>, dashboardStatics?: unknown) => {
    const card = new ConfigTemplateCard();
    const internals = card as unknown as {
      _helpers: unknown;
      render: () => unknown;
      getLovelaceStaticVars: () => unknown;
    };
    vi.spyOn(card as unknown as { loadCardHelpers: () => void }, 'loadCardHelpers').mockImplementation(() => undefined);
    vi.spyOn(internals, 'getLovelaceStaticVars').mockReturnValue(dashboardStatics);
    const createCardElement = vi.fn((_config: unknown) => document.createElement('div'));
    internals._helpers = { createCardElement };
    card.setConfig({ type: 'custom:config-template-card', entities: ['sun.sun'], ...config } as never);
    const render = (hassStates: Record<string, unknown> = states) => {
      card.hass = { states: { ...hassStates }, user: { name: 'Dev' } } as never;
      internals.render();
      return createCardElement.mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>;
    };
    return { card, render };
  };

  afterEach(() => {
    delete (window as unknown as { ctcCount?: unknown }).ctcCount;
  });

  it('evaluates static variables once, while regular variables run on every update', () => {
    const counts = { static: 0, regular: 0 };
    (window as unknown as { ctcCount: (kind: 'static' | 'regular') => number }).ctcCount = (kind) => ++counts[kind];
    const { render } = setup({
      staticVariables: { S: "window.ctcCount('static')" },
      variables: { R: "window.ctcCount('regular')" },
      card: { type: 'entities', title: '${S}/${R}' },
    });

    expect(render().title).toBe('1/1');
    expect(render().title).toBe('1/2');
    expect(render().title).toBe('1/3');
    expect(counts.static).toBe(1);
  });

  it('exposes static variables as svars, by name, and to regular variables', () => {
    const { render } = setup({
      staticVariables: ["'list'", 'svars[0] + "!"'],
      variables: { FROM_STATIC: 'svars[1] + " via vars"' },
      card: { type: 'entities', title: '${svars[0]} ${svars[1]} ${FROM_STATIC}' },
    });
    expect(render().title).toBe('list list! list! via vars');

    const named = setup({
      staticVariables: { UNIT: "'°C'", LABEL: "'Temp ' + UNIT" },
      variables: { LEVEL: "states['input_number.level'].state" },
      card: { type: 'entities', title: '${LABEL}: ${LEVEL}${svars.UNIT}' },
    });
    expect(named.render().title).toBe('Temp °C: 40°C');
  });

  it('puts dashboard-wide static variables before card ones, and lets a regular variable override a static name', () => {
    const { render } = setup(
      {
        staticVariables: { CARD: "DASH + '+card'", SHADOWED: "'static'" },
        variables: { SHADOWED: "'regular'" },
        card: { type: 'entities', title: '${CARD} ${SHADOWED} ${svars.SHADOWED}' },
      },
      { DASH: "'dash'" },
    );
    expect(render().title).toBe('dash+card regular static');
  });

  it('re-evaluates static variables when the config changes', () => {
    let calls = 0;
    (window as unknown as { ctcCount: () => number }).ctcCount = () => ++calls;
    const config = { staticVariables: { S: 'window.ctcCount()' }, card: { type: 'entities', title: '${S}' } };
    const { card, render } = setup(config);

    expect(render().title).toBe(1);
    card.setConfig({ type: 'custom:config-template-card', entities: ['sun.sun'], ...config } as never);
    expect(render().title).toBe(2);
  });
});

describe('async templates', () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  const favorites = [
    { title: 'Jazz', can_play: true },
    { title: 'News', can_play: false },
    { title: 'Rock', can_play: true },
  ];

  const setup = (config: Record<string, unknown>) => {
    const card = new ConfigTemplateCard();
    const internals = card as unknown as {
      _config: unknown;
      _helpers: unknown;
      render: () => unknown;
      _resolveEntities: (hass: unknown) => string[];
    };
    const createCardElement = vi.fn((_config: unknown) => document.createElement('div'));
    const callWS = vi.fn(async () => ({ children: favorites }));
    const hass = { states: { 'sun.sun': { state: 'above_horizon' } }, user: { name: 'Dev' }, callWS };
    card.hass = hass as never;
    internals._helpers = { createCardElement };
    internals._config = { type: 'custom:config-template-card', entities: ['sun.sun'], ...config };
    const lastConfig = () => createCardElement.mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>;
    return { internals, createCardElement, lastConfig, hass };
  };

  it('waits for a template that returns a Promise', async () => {
    const { internals, createCardElement, lastConfig } = setup({
      card: {
        type: 'grid',
        cards: "${hass.callWS({ type: 'media_player/browse_media' }).then((r) => r.children.length)}",
      },
    });

    internals.render();
    expect(createCardElement).not.toHaveBeenCalled();
    await flush();
    expect(lastConfig()).toEqual({ type: 'grid', cards: 3 });
  });

  it('supports `await` in an expression, as in malmeloo’s #149 example', async () => {
    const { internals, lastConfig } = setup({
      variables: {
        getFavorites:
          'async () => (await hass.callWS({ type: "media_player/browse_media" })).children.filter((f) => f.can_play)',
        getCard: "(fav) => ({ type: 'button', name: fav.title })",
      },
      card: { type: 'grid', cards: '${(await getFavorites()).map(getCard)}' },
    });

    internals.render();
    await flush();
    expect(lastConfig()).toEqual({
      type: 'grid',
      cards: [
        { type: 'button', name: 'Jazz' },
        { type: 'button', name: 'Rock' },
      ],
    });
  });

  it('supports awaiting statements with an explicit return', async () => {
    const { internals, lastConfig } = setup({
      card: {
        type: 'entities',
        title: "${\n  const r = await hass.callWS({ type: 'x' });\n  return r.children.length + ' favorites';\n}",
      },
    });

    internals.render();
    await flush();
    expect(lastConfig().title).toBe('3 favorites');
  });

  it('fills in variables that return a Promise before evaluating templates, including embedded ones', async () => {
    const { internals, lastConfig } = setup({
      variables: { FAVS: "hass.callWS({ type: 'x' }).then((r) => r.children)" },
      card: { type: 'entities', title: '${FAVS.length} favorites, first: ${FAVS[0].title}', count: '${FAVS.length}' },
    });

    internals.render();
    await flush();
    expect(lastConfig()).toEqual({ type: 'entities', title: '3 favorites, first: Jazz', count: 3 });
  });

  it('logs a rejected Promise and uses null', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { internals, lastConfig } = setup({
      card: { type: 'entities', title: "${Promise.reject(new Error('offline'))}", name: 'ok' },
    });

    internals.render();
    await flush();
    expect(lastConfig()).toEqual({ type: 'entities', title: null, name: 'ok' });
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to evaluate template expression',
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  it('ignores async results in `entities` with a warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { internals, hass } = setup({
      entities: ['sun.sun', "${Promise.resolve('light.a')}"],
      card: { type: 'entities' },
    });

    expect(internals._resolveEntities(hass)).toEqual(['sun.sun']);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('keeps synchronous templates synchronous, even when a string mentions await', () => {
    const { internals, createCardElement, lastConfig } = setup({
      card: { type: 'entities', title: "${ let s = 'please await'; s }", name: "${'await' + '!'}" },
    });

    internals.render();
    expect(createCardElement).toHaveBeenCalledTimes(1);
    expect(lastConfig()).toEqual({ type: 'entities', title: 'please await', name: 'await!' });
  });

  it('shows the async result once mounted', async () => {
    const { internals } = setup({
      card: { type: 'entities', title: "${hass.callWS({ type: 'x' }).then((r) => r.children[0].title)}" },
    });
    const card = internals as unknown as ConfigTemplateCard;
    document.body.appendChild(card);
    await card.updateComplete;
    await flush();
    await flush();

    expect(card.shadowRoot?.querySelector('#card > div')).not.toBeNull();
    card.remove();
  });
});

describe('async templates with static variables and error fallbacks', () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  const setup = (config: Record<string, unknown>) => {
    const card = new ConfigTemplateCard();
    vi.spyOn(card as unknown as { loadCardHelpers: () => void }, 'loadCardHelpers').mockImplementation(() => undefined);
    card.setConfig({ type: 'custom:config-template-card', entities: ['sun.sun'], ...config } as never);
    const internals = card as unknown as { _helpers: unknown; render: () => unknown };
    const createCardElement = vi.fn((_config: unknown) => document.createElement('div'));
    internals._helpers = { createCardElement };
    const callWS = vi.fn(async () => ({ children: ['a', 'b', 'c'] }));
    const render = () => {
      card.hass = { states: { 'sun.sun': { state: 'x' } }, callWS } as never;
      internals.render();
    };
    const lastConfig = () => createCardElement.mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>;
    return { render, lastConfig, callWS, createCardElement };
  };

  it('waits for async static variables, then rebuilds regular variables that use them', async () => {
    const { render, lastConfig } = setup({
      staticVariables: { ITEMS: "hass.callWS({ type: 'x' }).then((r) => r.children)" },
      variables: { COUNT: 'ITEMS.length' },
      card: { type: 'entities', title: '${COUNT} items: ${svars.ITEMS.join(",")}' },
    });

    render();
    await flush();
    await flush();
    expect(lastConfig().title).toBe('3 items: a,b,c');
  });

  it('still evaluates async static variables only once', async () => {
    const { render, lastConfig, callWS } = setup({
      staticVariables: { ITEMS: "hass.callWS({ type: 'x' }).then((r) => r.children)" },
      card: { type: 'entities', title: '${ITEMS.length}' },
    });

    render();
    await flush();
    await flush();
    render();
    render();
    expect(lastConfig().title).toBe(3);
    expect(callWS).toHaveBeenCalledTimes(1);
  });

  it('replaces a rejected Promise inside a string with <error>', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { render, lastConfig } = setup({
      card: { type: 'entities', title: "Result: ${Promise.reject(new Error('offline'))}" },
    });

    render();
    await flush();
    expect(lastConfig().title).toBe('Result: <error>');
  });
});
