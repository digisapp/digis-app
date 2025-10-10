# Context Tests

This directory contains comprehensive unit and integration tests for the application's React Context providers.

## Test Structure

```
__tests__/
├── AuthContext.test.jsx         # Auth state management tests
├── ModalContext.test.jsx        # Modal management tests
├── SocketContext.test.jsx       # WebSocket connection tests
├── DeviceContext.test.jsx       # Device detection tests
├── integration.test.jsx         # Cross-context integration tests
└── README.md                    # This file
```

## Running Tests

### Run All Tests
```bash
cd frontend
npm test
```

### Run Context Tests Only
```bash
npm test -- contexts/__tests__
```

### Run Specific Test File
```bash
npm test -- AuthContext.test.jsx
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

## Test Coverage Goals

- **AuthContext**: 90%+ coverage
  - User authentication flow
  - Profile syncing and caching
  - Token balance management
  - Role verification (creator/fan/admin)
  - Sign out and session cleanup

- **ModalContext**: 95%+ coverage
  - Opening/closing modals
  - Passing props to modals
  - Multiple modal management
  - Focus management

- **SocketContext**: 85%+ coverage
  - Socket connection lifecycle
  - Incoming call handling
  - Balance update events
  - Connection status tracking

- **DeviceContext**: 90%+ coverage
  - Mobile/tablet/desktop detection
  - Orientation changes
  - Breakpoint utilities

- **Integration Tests**: 80%+ coverage
  - Auth + Socket interaction
  - Auth + Modal interaction
  - Device + Modal interaction
  - Full context stack scenarios

## Key Test Scenarios

### AuthContext Tests

1. **Initial Loading State**: Verifies auth starts in loading state
2. **User Profile Fetch**: Validates profile sync on mount
3. **Creator Status Detection**: Checks `is_creator` flag handling
4. **Admin Status Detection**: Checks role-based admin access
5. **Sign Out Flow**: Ensures proper cleanup on logout
6. **Profile Refresh**: Tests manual profile refresh
7. **Token Balance Update**: Tests optimistic balance updates
8. **Error Handling**: Validates graceful auth error handling

### ModalContext Tests

1. **Initial State**: No modals open by default
2. **Open Modal**: Successfully opens a modal
3. **Close Modal**: Successfully closes a modal
4. **Modal Props**: Props passed correctly to modals
5. **Multiple Modals**: Independent modal state management
6. **All Modal Types**: Tests all 9 modal types
7. **Edge Cases**: Closing unopened modals, re-opening open modals

### SocketContext Tests

1. **Initial State**: Starts disconnected
2. **Connect on Auth**: Socket connects when user authenticates
3. **Disconnect on Logout**: Socket disconnects when user logs out
4. **Incoming Calls**: Handles incoming call notifications
5. **Clear Calls**: Clears call notifications
6. **Respond to Calls**: Emits call responses (accept/decline)
7. **Balance Updates**: Receives balance update events
8. **Cleanup**: Properly cleans up listeners on unmount
9. **Connection Status**: Tracks connection state

### DeviceContext Tests

1. **Default Desktop**: Desktop is default device type
2. **Mobile Portrait**: Detects mobile portrait orientation
3. **Mobile Landscape**: Detects mobile landscape orientation
4. **Tablet Detection**: Identifies tablet devices
5. **Orientation Changes**: Updates on orientation change
6. **Breakpoints**: Provides correct breakpoint values
7. **Window Resize**: Responds to viewport changes
8. **Cleanup**: Removes listeners on unmount

### Integration Tests

1. **Auth + Socket**:
   - Socket connects after successful authentication
   - Socket disconnects after sign out
   - Token balance updates from socket events

2. **Auth + Modal**:
   - Authenticated users can open purchase modals
   - Creator-only modals respect role checks

3. **Device + Modal**:
   - Mobile devices trigger mobile-specific modals
   - Desktop devices trigger desktop modals

4. **Full Stack**:
   - Complete user flow: auth → socket → modal
   - Proper cleanup order on unmount
   - Cross-context communication

## Mocking Strategy

### Supabase Auth
```javascript
jest.mock('../../utils/supabase-auth');
supabase.auth.getSession = jest.fn().mockResolvedValue({...});
```

### Role Verification
```javascript
jest.mock('../../utils/roleVerification');
verifyUserRole.mockResolvedValue({...});
```

### Socket Service
```javascript
jest.mock('../../services/socket');
socketService.connect = jest.fn();
```

### Profile Cache
```javascript
jest.mock('../../utils/profileCache', () => ({
  loadProfileCache: jest.fn(),
  saveProfileCache: jest.fn(),
  clearProfileCache: jest.fn(),
}));
```

## Common Issues

### Issue: Tests timing out
**Solution**: Ensure all async operations use `waitFor()` or `act()`

### Issue: Mock not working
**Solution**: Verify mock is defined before importing the tested module

### Issue: Context not available
**Solution**: Wrap test component with appropriate provider

### Issue: matchMedia errors
**Solution**: Check `setupTests.js` has matchMedia mock

## Best Practices

1. **Use `renderHook` for context testing**: More efficient than rendering full components
2. **Wrap with providers**: Always provide context wrapper in `renderHook`
3. **Use `act()` for state updates**: Wrap state-changing operations in `act()`
4. **Use `waitFor()` for async**: Wait for async operations to complete
5. **Mock external dependencies**: Keep tests isolated and fast
6. **Test error scenarios**: Don't just test happy paths
7. **Clean up after tests**: Use `beforeEach` and `afterEach` for setup/teardown

## Adding New Tests

When adding new context functionality:

1. Add unit tests in the corresponding test file
2. Add integration tests if it involves multiple contexts
3. Update this README with new test scenarios
4. Ensure coverage stays above 80%

## Debugging Tests

### Enable verbose output
```bash
npm test -- --verbose
```

### Run single test
```javascript
it.only('should do something', () => {
  // Only this test runs
});
```

### Skip test temporarily
```javascript
it.skip('should do something', () => {
  // This test is skipped
});
```

### Debug in VS Code
Add breakpoint and run "Jest: Debug" from VS Code

## CI/CD Integration

These tests run automatically on:
- Every commit (pre-commit hook)
- Pull requests (GitHub Actions)
- Before deployment (CI pipeline)

Minimum required coverage: **80%**

## Related Documentation

- [Context System Architecture](/Users/examodels/Desktop/digis-app/ARCHITECTURE.md#context-system)
- [Testing Strategy](/Users/examodels/Desktop/digis-app/ARCHITECTURE.md#testing-strategy)
- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

## Questions?

Check the main ARCHITECTURE.md or ask in team chat.
