
// No imports, just pure JavaScript
const rootElement = document.getElementById('root');
if (rootElement) {
  rootElement.innerHTML = '<h1>Test Simple - No React</h1><p>If you see this, JavaScript is executing!</p>';
  rootElement.style.padding = '20px';
  rootElement.style.textAlign = 'center';
} else {
// console.error('Root element not found!');
}