import { PlugAddPage, type PlugAddPageProps } from './PlugAddPage.js';

export type PlugAddPageContainerProps = PlugAddPageProps;

export const PlugAddPageContainer = ({ manual, scan }: PlugAddPageContainerProps) => (
  <PlugAddPage manual={manual} scan={scan} />
);
