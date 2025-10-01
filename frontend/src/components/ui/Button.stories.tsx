/**
 * Button component stories
 * @module stories/Button
 */

import type { Meta, StoryObj } from '@storybook/react';
import Button from './Button';

const meta = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Base button component with multiple variants and states'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger', 'ghost', 'link'],
      description: 'Visual style variant'
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
      description: 'Button size'
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state'
    },
    loading: {
      control: 'boolean',
      description: 'Loading state with spinner'
    },
    fullWidth: {
      control: 'boolean',
      description: 'Full width button'
    },
    icon: {
      control: 'text',
      description: 'Icon component'
    },
    children: {
      control: 'text',
      description: 'Button content'
    },
    onClick: {
      action: 'clicked',
      description: 'Click event handler'
    }
  }
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Primary button
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button'
  }
};

// Secondary button
export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button'
  }
};

// Danger button
export const Danger: Story = {
  args: {
    variant: 'danger',
    children: 'Delete Account'
  }
};

// Ghost button
export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost Button'
  }
};

// Link button
export const Link: Story = {
  args: {
    variant: 'link',
    children: 'Learn More →'
  }
};

// Button sizes
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra Large</Button>
    </div>
  )
};

// Loading state
export const Loading: Story = {
  args: {
    loading: true,
    children: 'Processing...'
  }
};

// Disabled state
export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled Button'
  }
};

// With icon
export const WithIcon: Story = {
  render: () => (
    <div className="flex gap-4">
      <Button icon="🎬">Start Recording</Button>
      <Button icon="💰" variant="secondary">Purchase Tokens</Button>
      <Button icon="❌" variant="danger">End Call</Button>
    </div>
  )
};

// Full width
export const FullWidth: Story = {
  args: {
    fullWidth: true,
    children: 'Full Width Button'
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    )
  ]
};

// Button group
export const ButtonGroup: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button variant="secondary">Cancel</Button>
      <Button variant="primary">Save Changes</Button>
    </div>
  )
};

// Interactive states
export const InteractiveStates: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-white mb-2">Hover me:</h3>
        <Button>Hover Effect</Button>
      </div>
      <div>
        <h3 className="text-white mb-2">Click me:</h3>
        <Button onClick={() => alert('Clicked!')}>Click Effect</Button>
      </div>
      <div>
        <h3 className="text-white mb-2">Focus me (Tab):</h3>
        <Button>Focus Effect</Button>
      </div>
    </div>
  )
};

// Real-world examples
export const RealWorldExamples: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="p-4 bg-gray-800 rounded-lg">
        <h3 className="text-white font-semibold mb-4">Authentication</h3>
        <div className="flex gap-3">
          <Button variant="primary" fullWidth>Sign In</Button>
          <Button variant="secondary" fullWidth>Sign Up</Button>
        </div>
      </div>
      
      <div className="p-4 bg-gray-800 rounded-lg">
        <h3 className="text-white font-semibold mb-4">Video Call Controls</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon="🎤">Mute</Button>
          <Button size="sm" variant="secondary" icon="📹">Camera</Button>
          <Button size="sm" variant="secondary" icon="🖥">Share</Button>
          <Button size="sm" variant="danger" icon="📞">End Call</Button>
        </div>
      </div>
      
      <div className="p-4 bg-gray-800 rounded-lg">
        <h3 className="text-white font-semibold mb-4">Token Purchase</h3>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="ghost">100 💰</Button>
          <Button variant="primary">500 💰</Button>
          <Button variant="ghost">1000 💰</Button>
        </div>
      </div>
    </div>
  )
};