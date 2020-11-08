# Config Template Card Card

📝 Templatable Configuration Card

[![GitHub Release][releases-shield]][releases]
[![License][license-shield]](LICENSE.md)
[![hacs_badge](https://img.shields.io/badge/HACS-Default-orange.svg?style=for-the-badge)](https://github.com/custom-components/hacs)

![Project Maintenance][maintenance-shield]
[![GitHub Activity][commits-shield]][commits]

[![Discord][discord-shield]][discord]
[![Community Forum][forum-shield]][forum]

[![Twitter][twitter]][twitter]
[![Github][github]][github]

This card is for [Lovelace](https://www.home-assistant.io/lovelace) on [Home Assistant](https://www.home-assistant.io/) that allows you to use pretty much any valid Javascript on the hass object in your configuration

## Minimum Home Assistant Version

Home Assistant version 0.110.0 or higher is required as of release 1.2.0 of config-template-card

## Support

Hey dude! Help me out for a couple of :beers: or a :coffee:!

[![coffee](https://www.buymeacoffee.com/assets/img/custom_images/black_img.png)](https://www.buymeacoffee.com/zJtVxUAgH)

## Installation

Use [HACS](https://hacs.xyz) or follow this [guide](https://github.com/thomasloven/hass-config/wiki/Lovelace-Plugins)

```yaml
resources:
  - url: /local/config-template-card.js
    type: module
```

## Options

| Name      | Type   | Requirement  | Description                                                                                           |
| --------- | ------ | ------------ | ----------------------------------------------------------------------------------------------------- |
| type      | string | **Required** | `custom:config-template-card`                                                                         |
| entities  | list   | **Required** | List of entity strings that should be watched for updates. Templates can be used here                 |
| variables | list   | **Optional** | List of variables, which can be templates, that can be used in your `config` and indexed using `vars` |
| card      | object | **Optional** | Card configuration. (A card, row, or element configuaration must be provided)                         |
| row       | object | **Optional** | Row configuration. (A card, row, or element configuaration must be provided)                          |
| element   | object | **Optional** | Element configuration. (A card, row, or element configuaration must be provided)                      |
| card      | object | **Optional** | Style configuration. (Required if you use an element)                                                 |

### Available variables for templating

| Variable    | Description                                                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `this.hass` | The [hass](https://developers.home-assistant.io/docs/en/frontend_data.html) object                                                                               |
| `states`    | The [states](https://developers.home-assistant.io/docs/en/frontend_data.html#hassstates) object                                                                  |
| `user`      | The [user](https://developers.home-assistant.io/docs/en/frontend_data.html#hassuser) object                                                                      |
| `vars`      | Defined by `variables` configuration and accessible in your templates starting at the 0th index as your firstly defined variable to help clean up your templates |

```yaml
type: 'custom:config-template-card'
variables:
  - states['light.bed_light'].state
  - states['cover.garage_door'].state
entities:
  - light.bed_light
  - cover.garage_door
  - alarm_control_panel.alarm
  - climate.ecobee
card:
  type: "${vars[0] === 'on' ? 'glance' : 'entities'}"
  entities:
    - entity: alarm_control_panel.alarm
      name: "${vars[1] === 'open' && states['alarm_control_panel.alarm'].state === 'armed_home' ? 'Close the garage!' : ''}"
    - entity: binary_sensor.basement_floor_wet
    - entity: climate.ecobee
      name: "${states['climate.ecobee'].attributes.current_temperature > 22 ? 'Cozy' : 'Too Hot/Cold'}"
    - entity: cover.garage_door
    - entity: "${vars[0] === 'on' ? 'light.bed_light' : 'climate.ecobee'}"
      icon: "${vars[1] === 'open' ? 'mdi:hotel' : '' }"
```

Templated entities example

```yaml
type: 'custom:config-template-card'
variables:
  - states['sensor.light'].state
entities:
  - '${vars[0]}'
card:
  type: light
  entity: '${vars[0]}'
  name: "${states[vars[0]].state === 'on' ? 'Light On' : 'Light Off'}"
```

Picture-elements card example

```yaml
type: picture-elements
image: http://hs.sbcounty.gov/CN/Photo%20Gallery/_t/Sample%20Picture%20-%20Koala_jpg.jpg?Mobile=0
elements:
  - type: 'custom:config-template-card'
    variables:
      - states['light.bed_light'].state
    entities:
      - light.bed_light
    element:
      type: icon
      icon: "${vars[0] === 'on' ? 'mdi:home' : 'mdi:circle'}"
    style:
      top: 47%
      left: 75%
```

\*\*Note how the `style` object is on the config-template-card itself and not within the element configuration.

Entities card example

```yaml
type: entities
entities:
  - type: 'custom:config-template-card'
    variables:
      - states['light.bed_light'].state
    entities:
      - light.bed_light
    row:
      type: section
      label: "${vars[0] === 'on' ? 'Light On' : 'Light Off'}"
  - entity: light.bed_light
```

### Note: All templates must be enclosed by `${}`

[Troubleshooting](https://github.com/thomasloven/hass-config/wiki/Lovelace-Plugins)

## Developers

Fork and then clone the repo to your local machine. From the cloned directory run

`npm install && npm run build`

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
