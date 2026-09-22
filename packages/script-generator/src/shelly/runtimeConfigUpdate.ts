import { normalizeConfig } from './config.js';
import {
  serializeShellyRuntimeConfig,
  SHELLY_RUNTIME_CONFIG_STORAGE_KEY
} from './runtimeConfig.js';

export const generateShellyRuntimeConfigUpdateEval = (input: unknown): string => {
  const configJson = serializeShellyRuntimeConfig(normalizeConfig(input));
  const storageKey = JSON.stringify(SHELLY_RUNTIME_CONFIG_STORAGE_KEY);
  const storageValue = JSON.stringify(configJson);

  return `(function(){var N=${configJson};if(typeof vc!=="function"||!vc(N))return"iv";if(typeof Script==="undefined"||!Script.storage||!Script.storage.setItem)return"ns";Script.storage.setItem(${storageKey},${storageValue});C=N;R.ls=null;R.l=0;R.t=null;R.h=null;R.tt=null;R.ht=null;R.b=null;R.r=null;R.on=false;R.rs="cu";R.ds="boot";R.lc=nw();R.os=null;R.nh=0;R.fh=0;R.cv=null;R.vp=null;R.eo=null;R.ef=null;R.m=0;R.sa=0;R.u=[];R.fc=0;return C.k;})()`;
};
