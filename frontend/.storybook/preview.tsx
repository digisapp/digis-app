/**
 * Storybook preview configuration
 * @module .storybook/preview
 */

import React from 'react';
import type { Preview } from '@storybook/react';
import { BrowserRouter } from 'react-router-dom';
import { themes } from '@storybook/theming';
import '../src/index.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/
      }
    },
    docs: {
      theme: themes.dark
    },
    darkMode: {
      dark: { ...themes.dark },
      light: { ...themes.normal },
      current: 'dark',
      stylePreview: true
    },
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#111827' },
        { name: 'light', value: '#ffffff' },
        { name: 'gray', value: '#1f2937' }
      ]
    },
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: { width: '375px', height: '667px' }
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' }
        },
        desktop: {
          name: 'Desktop',
          styles: { width: '1440px', height: '900px' }
        }
      }
    }
  },
  
  decorators: [
    (Story) => (
      <BrowserRouter>
        <div className="min-h-screen bg-gray-900 p-4">
          <Story />
        </div>
      </BrowserRouter>
    )
  ],
  
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme for components',
      defaultValue: 'dark',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' }
        ],
        showName: true
      }
    },
    locale: {
      name: 'Locale',
      description: 'Internationalization locale',
      defaultValue: 'en',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'en', title: 'English' },
          { value: 'es', title: 'Spanish' },
          { value: 'fr', title: 'French' }
        ],
        showName: true
      }
    }
  },
  
  tags: ['autodocs']
};

export default preview;