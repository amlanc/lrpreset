# JavaScript Modules

This directory contains the modular JavaScript files for the LR Preset application. The code has been split into smaller, more manageable modules to improve maintainability and separation of concerns.

## Module Structure

- **auth.js**: Handles user authentication, profile management, and session state.
- **upload.js**: Manages image upload, preview, and related functionality.
- **preset.js**: Handles preset creation, display, and management.
- **utils.js**: Contains utility functions used across the application.
- **main.js**: Initializes the application and coordinates between modules.

## Loading Order

The modules should be loaded in the following order to ensure dependencies are met:

1. utils.js
2. auth.js
3. upload.js
4. preset.js
5. main.js

## Global Namespaces

Each module exposes its functionality through a global namespace:

- `window.utils`: Utility functions
- `window.auth`: Authentication functions
- `window.upload`: Upload functions
- `window.preset`: Preset functions

## Usage

To use a function from another module, access it through its namespace:

```javascript
// Example: Check if user is authenticated
if (window.auth.isAuthenticated()) {
    // Do something
}

// Example: Start AI progress animation
window.utils.startAIProgressAnimation();
```

## Maintenance

When adding new functionality:

1. Determine which module it belongs to
2. Add the function to the appropriate module
3. Export the function by adding it to the module's namespace object
4. If needed, import it in main.js by creating a local reference
