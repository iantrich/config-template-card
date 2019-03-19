# Config Template Card Card
📝 Templatable Configuration Card

[![GitHub Release][releases-shield]][releases]
[![GitHub Activity][commits-shield]][commits]
[![custom_updater][customupdaterbadge]][customupdater]
[![License][license-shield]](LICENSE.md)

![Project Maintenance][maintenance-shield]
[![BuyMeCoffee][buymecoffeebadge]][buymecoffee]

[![Discord][discord-shield]][discord]
[![Community Forum][forum-shield]][forum]

This card is for [Lovelace](https://www.home-assistant.io/lovelace) on [Home Assistant](https://www.home-assistant.io/) that allows you to use pretty much any valid Javascript on the hass object in your configuration

## Options

| Name | Type | Requirement | Description
| ---- | ---- | ------- | -----------
| type | string | **Required** | `custom:config-template-card`
| config | object | **Required** | Card object
| entities | list | **Optional** | List of entity strings that should be watched for updates

## Installation

### Step 1

Save [config-template-card](https://github.com/custom-cards/config-template-card/raw/master/dist/config-template-card.js) to `<config directory>/www/config-template-card.js` on your Home Assistant instanse.

**Example:**

```bash
wget https://raw.githubusercontent.com/custom-cards/config-template-card/master/dist/config-template-card.js
mv config-template-card.js /config/www/
```

### Step 2

Link `config-template-card` inside your `ui-lovelace.yaml` or Raw Editor in the UI Editor

```yaml
resources:
  - url: /local/config-template-card.js
    type: module
```

### Step 3

Add a custom element in your `ui-lovelace.yaml` or in the UI Editor as a Manual Card

### Available variables for tempalting
`this.hass` - The [hass](https://developers.home-assistant.io/docs/en/frontend_data.html) object

`states` - The [states](https://developers.home-assistant.io/docs/en/frontend_data.html#hassstates) object

`user` - The [user](https://developers.home-assistant.io/docs/en/frontend_data.html#hassuser) object

```yaml
type: 'custom:config-template-card'
entities:
  - light.bed_light
  - cover.garage_door
  - alarm_control_panel.ha_alarm
  - climate.ecobee
config:
  type: "${states['light.bed_light'].state === 'on' ? 'custom:hui-glance-card' : 'custom:hui-entities-card'}"
  entities:
    - entity: alarm_control_panel.ha_alarm
      name: "${states['cover.garage_door'].state === 'open' && states['alarm_control_panel.ha_alarm'].state === 'armed_home' ? 'Close the garage!' : ''}"
    - entity: binary_sensor.basement_floor_wet
    - entity: climate.ecobee
      name: "${states['climate.ecobee'].attributes.current_temperature > 22 ? 'Cozy' : 'Too Hot/Cold'}"
    - entity: cover.garage_door
    - entity: "${states['light.bed_light'].state === 'on' ? 'light.bed_light' : 'climate.ecobee'}"
      icon: "${states['cover.garage_door'].state === 'open' ? 'mdi:hotel' : '' }"

```

### Note: All templates must be enclosed by `${}` and card type must custom even for core. e.g. custom:hui-shopping-list-card

[Troubleshooting](https://github.com/thomasloven/hass-config/wiki/Lovelace-Plugins)

## Developers
Fork and then clone the repo to your local machine. From the cloned directory run

`npm install && npm run build`

[buymecoffee]: https://www.buymeacoffee.com/iantrich
[buymecoffeebadge]: https://img.shields.io/badge/buy%20me%20a%20coffee-donate-yellow.svg?style=for-the-badge
[commits-shield]: https://img.shields.io/github/commit-activity/y/custom-cards/config-template-card.svg?style=for-the-badge
[commits]: https://github.com/custom-cards/config-template-card/commits/master
[customupdater]: https://github.com/custom-components/custom_updater
[customupdaterbadge]: https://img.shields.io/badge/custom__updater-true-success.svg?style=for-the-badge
[discord]: https://discord.gg/Qa5fW2R
[discord-shield]: https://img.shields.io/discord/330944238910963714.svg?style=for-the-badge
[forum-shield]: https://img.shields.io/badge/community-forum-brightgreen.svg?style=for-the-badge
[forum]: https://community.home-assistant.io/t/100-templatable-lovelace-configuration-card/105241
[license-shield]: https://img.shields.io/github/license/custom-cards/config-template-card.svg?style=for-the-badge
[maintenance-shield]: https://img.shields.io/badge/maintainer-Ian%20Richardson%20%40iantrich-blue.svg?style=for-the-badge
[releases-shield]: https://img.shields.io/github/release/custom-cards/config-template-card.svg?style=for-the-badge
[releases]: https://github.com/custom-cards/config-template-card/releases
