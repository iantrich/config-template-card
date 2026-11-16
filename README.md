# Config Template Card Card

📝 Templatable Configuration Card

[![GitHub Release][releases-shield]][releases]
[![License][license-shield]](LICENSE.md)
[![hacs_badge](https://img.shields.io/badge/HACS-Default-orange.svg?style=for-the-badge)](https://github.com/hacs/integration)

![Project Maintenance][maintenance-shield]
[![GitHub Activity][commits-shield]][commits]

[![Discord][discord-shield]][discord]
[![Community Forum][forum-shield]][forum]

[![Twitter][twitter]][twitter]
[![Github][github]][github]

This card is for [Lovelace](https://www.home-assistant.io/lovelace) on [Home Assistant](https://www.home-assistant.io/) that allows you to use pretty much any valid Javascript on the hass object in your configuration

## Minimum Home Assistant version

Home Assistant version 2026.2.3 or higher is required as of release 2.0.0 of config-template-card

## Installation

Use [HACS](https://hacs.xyz) or follow this [guide](https://github.com/thomasloven/hass-config/wiki/Lovelace-Plugins)

## Options

| Name      | Type   | Requirement  | Description                                                                                                      |
| --------- | ------ | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| type      | string | **Required** | `custom:config-template-card`                                                                                    |
| entities  | list   | **Required** | List of entity strings that should be watched for updates. Templates can be used here, either per item or as one template that returns a list |
| variables | list or object | **Optional** | Variables, which can be templates, that can be used in your templates and indexed using `vars` or by name |
| card      | object | **Optional**\* | Card configuration |
| row       | object | **Optional**\* | Row configuration, for use inside an Entities card |
| element   | object | **Optional**\* | Element configuration, for use inside a Picture elements card or as a badge |
| style     | object | **Optional** | Style configuration for the wrapper (for example `top`/`left` inside a Picture elements card) |

\* One of `card`, `row` or `element` must be provided.

The card re-renders when its own configuration changes or when any entity listed in `entities` changes. Entities that are not listed do not trigger an update, even if a template reads them.

### Defining `variables`

`variables` may be a list:

```yaml
variables:
  - states['input_number.level'].state
  - Number(vars[0]) * 2
```

or an object:

```yaml
variables:
  LEVEL: states['input_number.level'].state
  DOUBLE: Number(LEVEL) * 2
```

Either way, a variable can use the variables defined before it: `vars[0]` in a list, or the earlier name (also `vars['LEVEL']`) in an object.

### Available variables for templating

| Variable    | Description                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hass`      | The [hass](https://developers.home-assistant.io/docs/frontend/data/) object (also available as `this.hass`)                                                                                                                                                                                                                                                                                                                           |
| `states`    | The [states](https://developers.home-assistant.io/docs/frontend/data/#hassstates) object                                                                                                                                                                                                                                                                                                              |
| `user`      | The [user](https://developers.home-assistant.io/docs/frontend/data/#hassuser) object                                                                                                                                                                                                                                                                                                                  |
| `vars`      | Defined by `variables` configuration and accessible in your templates to help clean them up. If `variables` in the configuration is a yaml list, then `vars` is an array starting at the 0th index as your firstly defined variable. If `variables` is an object in the configuration, then `vars` is a string-indexed map and you can also access the variables by name without using `vars` at all. |
## Examples

```yaml
type: custom:config-template-card
variables:
  LIGHT_STATE: states['light.bed_light'].state
  GARAGE_STATE: states['cover.garage_door'].state
entities:
  - light.bed_light
  - cover.garage_door
  - alarm_control_panel.alarm
  - climate.ecobee
card:
  type: "${LIGHT_STATE === 'on' ? 'glance' : 'entities'}"
  entities:
    - entity: alarm_control_panel.alarm
      name: "${GARAGE_STATE === 'open' && states['alarm_control_panel.alarm'].state === 'armed_home' ? 'Close the garage!' : ''}"
    - entity: binary_sensor.basement_floor_wet
    - entity: climate.ecobee
      name: "${states['climate.ecobee'].attributes.current_temperature > 22 ? 'Cozy' : 'Too Hot/Cold'}"
    - entity: cover.garage_door
    - entity: "${LIGHT_STATE === 'on' ? 'light.bed_light' : 'climate.ecobee'}"
      icon: "${GARAGE_STATE === 'open' ? 'mdi:hotel' : '' }"
```

What this example does:

- Uses `variables` as named values (`LIGHT_STATE`, `GARAGE_STATE`) so templates are easier to read.
- Uses `entities` as the watch list; when any listed entity changes, the card re-evaluates templates.
- Uses `card` as the render target, and even templates the `card.type` itself (`glance` vs `entities`).
- Templates specific row properties (`name`, `entity`, `icon`) so content changes live based on state.
- Demonstrates that nearly any string field inside the target card config can be templated.

### Templated entities example

```yaml
type: custom:config-template-card
variables:
  - states['sensor.light']
entities:
  - '${vars[0].entity_id}'
card:
  type: light
  entity: '${vars[0].entity_id}'
  name: "${vars[0].state === 'on' ? 'Light On' : 'Light Off'}"
```

What this example does:

- Uses `variables` in array mode, so values are referenced by index (`vars[0]`).
- Uses a templated item in `entities`, meaning the watched entity itself is dynamic.
- Renders a `card` target (`light` card) whose `entity` and `name` come from templates.
- Shows a common pattern where one sensor (or helper) points to the active entity to display.

### Entities list from a template

The whole `entities` list can also be one template that returns a list, which is handy when the same list is used for the watch list and the card:

```yaml
type: custom:config-template-card
variables:
  LIGHTS: Object.keys(states).filter((id) => id.startsWith('light.'))
entities: ${LIGHTS}
card:
  type: entities
  entities: ${LIGHTS}
```

To match part of an entity id, use `includes`. Lists can be combined with `concat`:

```yaml
type: custom:config-template-card
variables:
  BATTERIES: Object.keys(states).filter((id) => id.startsWith('sensor.') && id.includes('battery'))
  SWITCHES: Object.keys(states).filter((id) => id.startsWith('input_boolean.'))
entities: ${BATTERIES.concat(SWITCHES, ['sun.sun'])}
card:
  type: entities
  entities: ${BATTERIES.concat(SWITCHES, ['sun.sun'])}
```

### Picture-elements card example

```yaml
type: picture-elements
image: https://upload.wikimedia.org/wikipedia/commons/4/49/Koala_climbing_tree.jpg
elements:
  - type: custom:config-template-card
    variables:
      - states['light.bed_light'].state
    entities:
      - light.bed_light
      - sensor.light_icon_color
    element:
      type: icon
      icon: "${vars[0] === 'on' ? 'mdi:home' : 'mdi:circle'}"
      style:
        '--paper-item-icon-color': '${ states[''sensor.light_icon_color''].state }'
    style:
      top: 47%
      left: 75%
```

What this example does:

- Embeds `custom:config-template-card` inside a native `picture-elements` card.
- Uses `element` (not `card`/`row`) as the render target, because picture-elements expects elements.
- Uses wrapper-level `style` (`top`, `left`) to position the template card in the image canvas.
- Uses `element.style` to style the inner rendered element (icon color), independent of wrapper placement.
- Uses `entities` to watch both the light state and color source sensor for live icon updates.

Note: The `style` object on the element configuration is applied to the element itself, the `style` object on the `config-template-card` is applied to the surrounding card, both can contain templated values. For example, in order to place the card properly, the `top` and `left` attributes must always be configured on the `config-template-card`.

Wrap the individual elements that need templates rather than the whole Picture elements card, so only those elements re-render when their entities change.

### Entities card example

```yaml
type: entities
entities:
  - type: custom:config-template-card
    variables:
      - states['light.bed_light'].state
    entities:
      - light.bed_light
    row:
      type: section
      label: "${vars[0] === 'on' ? 'Light On' : 'Light Off'}"
  - entity: light.bed_light
```

What this example does:

- Embeds `custom:config-template-card` as an item inside a native `entities` card list.
- Uses `row` as the render target, which is the correct mode for rows inside entities cards.
- Uses one watched entity and one array variable to keep logic minimal.
- Dynamically changes the section label so the row text reflects live entity state.

### Badge example

```yaml
badges:
  - type: custom:config-template-card
    variables:
      SUN: states['sun.sun'].state
    entities:
      - sun.sun
    element:
      type: custom:hui-entity-badge
      entity: sun.sun
      show_name: true
      name: "${SUN === 'above_horizon' ? 'Day' : 'Night'}"
```

A badge uses `element` with the badge's element name (`custom:hui-entity-badge` for the standard entity badge).

### Markdown card example

JavaScript templates and the Markdown card's own Jinja templates can be combined:

```yaml
type: custom:config-template-card
entities:
  - weather.home
card:
  type: markdown
  content: |
    ### {{ state_attr('weather.home', 'temperature') }}° - ${hass.formatEntityState(states['weather.home'])}
```

`hass.formatEntityState` returns the state as Home Assistant shows it, translated into the user's language (for example `Partly cloudy`).

## Defining global functions in variables

If you find yourself having to rewrite the same logic in multiple locations, you can define global methods inside Config Template Card's variables, which can be called anywhere within the scope of the card:

```yaml
type: custom:config-template-card
variables:
  setTempMessage: |
    temp => {
      if (temp < 20) {
        return 'Quick, get a blanket!';
      }
      if (temp <= 22) {
        return 'Cozy!';
      }
      return "It's getting hot in here...";
    }
  currentTemp: states['climate.ecobee'].attributes.current_temperature
entities:
  - climate.ecobee
card:
  type: entities
  entities:
    - entity: climate.ecobee
      name: '${ setTempMessage(currentTemp) }'
```

What this example does:

- Uses object-style `variables` to define both a reusable function (`setTempMessage`) and data (`currentTemp`).
- Demonstrates that templates can call custom functions, not just simple expressions.
- Uses `entities` to watch only what the template depends on (`climate.ecobee`).
- Keeps card config clean by moving conditional text logic into a reusable variable function.
- Uses double quotes for `"It's getting hot in here..."`, since an apostrophe inside a single-quoted JavaScript string ends the string early.

## Dashboard wide variables

If you need to use the same variable in multiple cards, then instead of defining it in each card's `variables` you can do that once for the entire dashboard.

```yaml
title: My dashboard

config_template_card_vars:
  - states['sensor.light'].state

views:
```

What this example does:

- Defines `config_template_card_vars` at dashboard root so many cards can reuse shared variables.
- Avoids repeating identical variable expressions in every individual card config.
- Supports both array and object forms, same as local `variables`.
- When both dashboard and local variables are arrays, dashboard entries come first in `vars`.

Both arrays and objects are supported, just like in card's local variables. It is allowed to mix the two types, i.e. use an array in dashboard variables and an object in card variables, or the other way around. If both definitions are arrays, then dashboard variables are put first in `vars`. In the mixed mode, `vars` have array indices and as well as variable names.

### Passing text through untouched

Start a value with `$! ` (dollar, exclamation mark, space) to pass it through as plain text, with the prefix removed. Use this when a value contains `${...}` meant for the inner card's own templating, or a variable should hold text rather than run as code:

```yaml
type: custom:config-template-card
variables:
  PATTERN: $! states['sun.sun'].state
entities:
  - sun.sun
card:
  type: custom:some-card
  # The inner card receives the text "${value} items", not an evaluated template
  label: $! ${value} items
```

## When you might not need config-template-card

- **Stacks:** wrap only the cards that use templates, not the whole stack, so the other cards are not re-created on every update:

  ```yaml
  type: vertical-stack
  cards:
    - type: custom:config-template-card
      variables: ...
      entities: ...
      card:
        type: entities
        # ... uses templates
    - type: entities
      # ... no templates needed
  ```

- **Styling only:** if you only need to change CSS based on state, [card-mod](https://github.com/thomasloven/lovelace-card-mod) with Jinja templates can do it without re-creating the card.

## Writing templates

All templates must be enclosed by `${}`. They can be used in three ways:

```yaml
type: custom:config-template-card
variables:
  MODEL: states['input_text.model'].state
entities:
  - sensor.${MODEL}_forecast
card:
  type: entities
  # 1. The whole value is one template: the result keeps its type (number, list, object, ...)
  state_color: ${MODEL !== 'none'}
  # 2. Templates inside a string: each one is evaluated and joined into the string
  title: Forecast (${MODEL}) at ${new Date().toLocaleTimeString()}
  # 3. Several statements: the value of the last statement is used
  entities: |
    ${
      const list = [];
      list.push('sensor.' + MODEL + '_forecast');
      list;
    }
```

The same rules apply to `variables`, so a variable can hold several statements or define a function that uses variables defined before it.

A `custom:config-template-card` nested inside another one (for example inside a `vertical-stack`) evaluates its own templates with its own `variables`; the outer card leaves that part of its config untouched. Use dashboard-wide variables for values both need.

### When a template fails

If a template or variable throws an error (for example reading `.state` of an entity that doesn't exist), the error is logged to the browser console with the template and variables involved, and the card keeps rendering:

- A value that is a single template becomes `null`, so the inner card falls back to its default (for example the entity's own name).
- A template inside a string is replaced by `<error>`.
- A variable that fails becomes `null`.

Use optional chaining to handle entities that may be missing: `${states['sensor.maybe']?.state ?? 'unknown'}`.

## Upgrading from 1.x

- Home Assistant 2026.2.3 or newer is required.
- When dashboard-wide variables (`config_template_card_vars`) and card `variables` are both lists, the dashboard entries now come first in `vars`. If you used `vars[0]` for a card variable while also defining dashboard list variables, update the index or switch to named variables.
- Named card variables now load after dashboard variables, so they can use (and override) dashboard variables.
- Templates inside strings (`sensor.${MODEL}_power`) and several templates in one value are now supported.

[Troubleshooting](https://github.com/thomasloven/hass-config/wiki/Lovelace-Plugins)

## Developers

Fork and then clone the repo to your local machine. Node.js 20.19 or newer is required (`nvm use` picks up the version in `.nvmrc`). From the cloned directory run

`yarn install && yarn build`

Every pull request's **Build** check uploads the built `config-template-card.js` as an artifact. Download it from the check's summary page to test a change before it is released.

[commits-shield]: https://img.shields.io/github/commit-activity/y/custom-cards/config-template-card.svg?style=for-the-badge
[commits]: https://github.com/custom-cards/config-template-card/commits/master
[discord]: https://discord.gg/Qa5fW2R
[discord-shield]: https://img.shields.io/discord/330944238910963714.svg?style=for-the-badge
[forum-shield]: https://img.shields.io/badge/community-forum-brightgreen.svg?style=for-the-badge
[forum]: https://community.home-assistant.io/t/100-templatable-lovelace-configuration-card/105241
[license-shield]: https://img.shields.io/github/license/custom-cards/config-template-card.svg?style=for-the-badge
[maintenance-shield]: https://img.shields.io/badge/maintainer-Ian%20Richardson%20%40iantrich-blue.svg?style=for-the-badge
[releases-shield]: https://img.shields.io/github/release/custom-cards/config-template-card.svg?style=for-the-badge
[releases]: https://github.com/custom-cards/config-template-card/releases
[twitter]: https://img.shields.io/twitter/follow/iantrich.svg?style=social
[github]: https://img.shields.io/github/followers/iantrich.svg?style=social
