import { LovelaceCardConfig, EntitiesCardEntityConfig, LovelaceElementConfigBase } from 'custom-card-helpers';
import { HomeAssistant, CurrentUser } from 'custom-card-helpers';
import { HassEntities } from 'home-assistant-js-websocket';

export type ObjMap = Record<string, any>;
export type Vars = ObjMap | any[];

export interface Config {
  type: string;
  entities?: string[];
  variables?: Vars;
  staticVariables?: Vars;
  card?: LovelaceCardConfig;
  row?: EntitiesCardEntityConfig;
  element?: LovelaceElementConfigBase;
  style?: Record<string, string>;
}

export interface SVarMgr {
  svars: Vars;
  _evalInitSVars: string;
  _svarsPromise?: Promise<any>;
}

export interface VarMgr {
  hass: HomeAssistant;
  states: HassEntities;
  user: CurrentUser;
  config: Config;
  svars: Vars;
  _evalInitSVars: string;
  vars?: Vars;
  _evalInitVars: string;
  _varsPromise?: Promise<any>;
  output?: ObjMap;
}
