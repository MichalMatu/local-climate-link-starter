import { expect, type Page } from '@playwright/test';

export const canonicalVisualViewport = { width: 412, height: 915 } as const;
export const canonicalVisualPlatform = 'darwin' as const;

export const visualScreenNames = [
  '01-plugs-dashboard',
  '02-climate-automation',
  '03-climate-ble',
  '04-plug-ble-discovery',
  '05-climate-device',
  '06-climate-script',
  '07-climate-info',
  '08-automation-intent',
  '09-time-setup',
  '10-time-dashboard',
  '11-time-detail',
  '12-thermometers-dashboard',
  '13-add-thermometer',
  '14-settings',
  '15-add-plug',
  '16-climate-setup',
  '17-plain-plug-settings',
  '18-settings-diagnostics-open',
  '19-climate-advanced-open'
] as const;

export type VisualScreenName = (typeof visualScreenNames)[number];

export const expectVisualScreen = async (page: Page, name: VisualScreenName) => {
  if (process.platform !== canonicalVisualPlatform) {
    if (process.env.LCL_VISUAL_CONTRACT === '1') {
      throw new Error(
        `Canonical UX visual regression requires ${canonicalVisualPlatform}; current platform is ${process.platform}`
      );
    }
    return;
  }

  await page.mouse.move(1, 1);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixels: 64,
    scale: 'css',
    threshold: 0.1
  });
};
