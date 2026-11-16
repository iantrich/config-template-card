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
| staticVariables | list or object | **Optional** | Like `variables`, but evaluated once when the card loads (see [Static variables](#static-variables)) |
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
| `svars`     | Static variables from `staticVariables` and `config_template_card_staticVars`, indexed like `vars`. Named static variables are also available by name |
| `config`    | This card's own configuration, before templates are evaluated. For example `config.card.entity` is the inner card's entity, and custom top-level keys are available too |
| `output`    | The inner card's configuration built so far. Keys are evaluated in order, so a template can read keys above it, for example `output.entities.length` |
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

## Recipes

Short examples for common needs. Replace the entity ids with your own.

### Icon and color that follow a state

`config.card.entity` reads the entity from the card's own options, so the same card can be copied for another door by changing one line:

```yaml
type: custom:config-template-card
entities:
  - binary_sensor.front_door
card:
  type: tile
  entity: binary_sensor.front_door
  icon: "${states[config.card.entity].state === 'on' ? 'mdi:door-open' : 'mdi:door-closed'}"
  color: "${states[config.card.entity].state === 'on' ? 'red' : 'green'}"
```

### Greeting by time of day

```yaml
type: custom:config-template-card
variables:
  HOUR: new Date().getHours()
entities:
  - sun.sun
card:
  type: markdown
  content: "## Good ${HOUR < 12 ? 'morning' : HOUR < 18 ? 'afternoon' : 'evening'}, ${user.name}"
```

The card only re-renders when an entity in `entities` changes, so the greeting updates as `sun.sun` changes during the day.

### A formatted attribute

```yaml
type: custom:config-template-card
variables:
  TEMP: Number(states['climate.living_room'].attributes.current_temperature).toFixed(1)
entities:
  - climate.living_room
card:
  type: entities
  entities:
    - entity: climate.living_room
      name: Living room ${TEMP}°
```

### Batteries that need charging

```yaml
type: custom:config-template-card
variables:
  BATTERIES: Object.keys(states).filter((id) => states[id].attributes.device_class === 'battery')
  LOW: BATTERIES.filter((id) => Number(states[id].state) < 20)
entities: ${BATTERIES}
card:
  type: entities
  title: "${LOW.length ? 'Low batteries: ' + LOW.length : 'All batteries OK'}"
  entities: "${LOW.length ? LOW : [{ type: 'section', label: 'Nothing to charge' }]}"
```

The list of battery sensors rarely changes, so `BATTERIES` could also be a [static variable](#static-variables).

### Total power from several sensors

```yaml
type: custom:config-template-card
variables:
  POWER_SENSORS: Object.keys(states).filter((id) => states[id].attributes.device_class === 'power')
  TOTAL: POWER_SENSORS.reduce((sum, id) => sum + (Number(states[id].state) || 0), 0)
entities: ${POWER_SENSORS}
card:
  type: markdown
  content: Using **${Math.round(TOTAL)} W** right now
```

### Who's home

The card type, title and rows all come from the same variables:

```yaml
type: custom:config-template-card
variables:
  PEOPLE: Object.keys(states).filter((id) => id.startsWith('person.'))
  HOME: PEOPLE.filter((id) => states[id].state === 'home')
entities: ${PEOPLE}
card:
  type: "${HOME.length ? 'glance' : 'entities'}"
  title: "${HOME.length ? HOME.length + ' home' : 'Nobody home'}"
  entities: ${PEOPLE}
```

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

## Static variables

`staticVariables` work like `variables`, but are evaluated only once: the first time Home Assistant data is available after the card loads, and again only when the card's configuration changes. Use them for values that don't change, or are expensive to compute, so they aren't recalculated on every update:

```yaml
type: custom:config-template-card
staticVariables:
  BATTERIES: Object.keys(states).filter((id) => id.includes('battery'))
variables:
  LOW: BATTERIES.filter((id) => Number(states[id].state) < 20)
entities: ${BATTERIES}
card:
  type: entities
  title: "${LOW.length} of ${BATTERIES.length} batteries low"
  entities: ${BATTERIES}
```

Static variables are available as `svars` (`svars[0]` for a list, `svars.NAME` for an object) and by name. Regular variables can use them, and a regular variable with the same name takes precedence. Dashboard-wide static variables go under `config_template_card_staticVars`, next to `config_template_card_vars`, and are evaluated before the card's own.

Because they don't update, a static variable that reads `states` keeps the value from when the card loaded. In the example above the list of battery entities is static, while their states are read on every update.

## Asynchronous templates

A template or variable can return a Promise, for example to fetch data with `hass.callWS`. The card waits for it to settle before building the inner card, and keeps showing the previous version meanwhile. `await` works in a template expression, and statements that `await` need an explicit `return`:

```yaml
type: custom:config-template-card
variables:
  getFavorites: >-
    async () => (await hass.callWS({
      type: 'media_player/browse_media',
      entity_id: 'media_player.kitchen',
      media_content_id: 'object.item.audioItem.audioBroadcast',
      media_content_type: 'favorites_folder',
    })).children.filter((fav) => fav.can_play)
entities:
  - media_player.kitchen
card:
  type: grid
  cards: "${(await getFavorites()).map((fav) => ({ type: 'button', name: fav.title }))}"
```

- A variable that returns a Promise is filled in before templates run, so templates can use its value directly. A variable that uses another async variable should `await` it.
- A Promise that rejects is logged to the browser console and its value becomes `null`.
- Static variables can be async too. They are awaited once, before regular variables run.
- `entities` must be known right away, so async results there are ignored with a warning.
- Templates that don't return a Promise behave exactly as before.

## Dashboard and view wide variables

If you need the same variables in multiple cards, define them once for the whole dashboard, or for one view, instead of in each card. The same works for entities every card should watch:

```yaml
title: My dashboard

config_template_card_vars:
  HOME: states['zone.home'].attributes.friendly_name

views:
  - title: Kitchen
    path: kitchen
    config_template_card_vars:
      ROOM: HOME + ' / Kitchen'
    config_template_card_entities:
      - light.kitchen
    cards:
      - type: custom:config-template-card
        card:
          type: entities
          title: ${ROOM}
          entities:
            - light.kitchen
```

- `config_template_card_vars` at the dashboard root applies to every card on the dashboard. On a view, it applies only to cards on that view.
- Variables load dashboard first, then view, then card, so each level can use the ones before it, and a later level overrides an earlier variable with the same name.
- `config_template_card_staticVars` works the same way for [static variables](#static-variables).
- `config_template_card_entities`, at the dashboard root or on a view, is added to every card's watch list. A card can then leave out its own `entities`.
- Both lists and objects are supported, just like a card's `variables`. You can mix the two. If more than one level uses a list, they are joined in the same order in `vars`. In mixed mode, `vars` has both list indices and variable names.

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

### Using `config` and `output`

`config` lets a template refer to the card's own options instead of repeating them, which helps when the same card is copied for several entities:

```yaml
type: custom:config-template-card
entities:
  - binary_sensor.door
card:
  type: entity
  entity: binary_sensor.door
  name: "${states[config.card.entity].state === 'on' ? 'Open' : 'Closed'}"
```

`output` reads values that were already evaluated earlier in the same card:

```yaml
type: custom:config-template-card
variables:
  BATTERIES: Object.keys(states).filter((id) => id.includes('battery'))
entities: ${BATTERIES}
card:
  type: entities
  entities: ${BATTERIES}
  title: "Batteries: ${output.entities.length}"
```

In a YAML-mode dashboard, `!secret` values can be passed in through a custom top-level key and read with `config`:

```yaml
type: custom:config-template-card
secret_option: !secret some_secret
entities:
  - sun.sun
card:
  type: entities
  entities:
    - entity: sun.sun
      name: ${config.secret_option}
```
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
