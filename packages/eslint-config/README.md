# @workspace/eslint-config

Shared ESLint configurations for the monorepo.

## Available Configurations

### Base Configuration
```js
import { config } from "@workspace/eslint-config/base";
export default config;
```

### React Internal Configuration
For React libraries and components:
```js
import { config } from "@workspace/eslint-config/react-internal";
export default config;
```

### Frontend Configuration (React)
For React applications:
```js
import { config } from "@workspace/eslint-config/frontend";
export default config;
```

### Server Configuration
For Node.js server applications:
```js
import { config } from "@workspace/eslint-config/server";
export default config;
```

## Features

- TypeScript support
- React and React Hooks rules
- Prettier integration
- Turbo monorepo support
- Only warnings mode for development
- Comprehensive ignore patterns
