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

    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {
      return undefined;
    });

    const promise = (card as unknown as { loadCardHelpers: () => Promise<void> }).loadCardHelpers();
    await vi.advanceTimersByTimeAsync(10_100);
    await promise;

    expect((card as unknown as { _helpers?: unknown })._helpers).toBeUndefined();
    expect(debugSpy).toHaveBeenCalled();
  });
});
