/**
 * Storybook main configuration
 * @module .storybook/main
 */

import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: [
    '../src/**/*.stories.@(js|jsx|ts|tsx|mdx)',
    '../src/**/*.story.@(js|jsx|ts|tsx|mdx)'
  ],
  
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-links',
    '@storybook/addon-a11y',
    '@storybook/addon-coverage',
    '@chromatic-com/storybook',
    'storybook-dark-mode'
  ],
  
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  
  core: {
    builder: '@storybook/builder-vite'
  },
  
  viteFinal: async (config) => {
    return mergeConfig(config, {
      resolve: {
        alias: {
          '@': '/src',
          '@components': '/src/components',
          '@hooks': '/src/hooks',
          '@utils': '/src/utils',
          '@services': '/src/services',
          '@types': '/src/types'
        }
      }
    });
  },
  
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript'
  },
  
  docs: {
    autodocs: 'tag',
    defaultName: 'Documentation'
  },
  
  staticDirs: ['../public']
};

export default config;