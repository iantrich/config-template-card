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

  it('_evaluateTemplate logs context and rethrows when expression evaluation fails', () => {
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

    expect(() => {
      (
        card as unknown as {
          _evaluateTemplate: (template: string) => unknown;
        }
      )._evaluateTemplate('${missing.value}');
    }).toThrow();

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

    it('renders instead of throwing when a watched entity template fails', () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      configure({ entities: ['${missing.entity}'] });
      expect(internals.shouldUpdate(unchangedHass())).toBe(true);
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
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      expect(() => evaluate("${JSON.parse('{bad')}")).toThrow(SyntaxError);
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
