# Type Definitions

This directory contains all global TypeScript type definitions for the Freeroll Dashboard application.

## Structure

- **`api.ts`** - API request/response types, error handling, and route types
- **`database.ts`** - Database models, Prisma types, and query utilities
- **`socket.ts`** - Socket.IO event types and real-time communication
- **`components.ts`** - React component props and UI-related types
- **`index.ts`** - Central export file for all types

## Usage

### Importing Types

Import from the central index file:

```typescript
import { ApiResponse, TournamentPlayer, RealtimePlayer } from '@/types';
```

Or import from specific files:

```typescript
import { ApiResponse } from '@/types/api';
import { TournamentPlayer } from '@/types/components';
```

### API Routes

Use proper typing for API routes instead of `any`:

```typescript
import { RouteContext, IdRouteParams, ApiResponse, CatchError } from '@/types';

export async function GET(
  request: Request,
  context: RouteContext<IdRouteParams>
) {
  try {
    const params = await context.params;
    const tournament = await prisma.tournamentDraft.findUnique({
      where: { id: parseInt(params.id) }
    });

    return Response.json<ApiResponse>({
      success: true,
      data: tournament
    });
  } catch (error: CatchError) {
    return handleError(error);
  }
}
```

### Error Handling

Replace `any` with `CatchError` (which is `unknown`) in catch blocks:

```typescript
import { CatchError, isError, getErrorMessage } from '@/types';

try {
  // ... your code
} catch (error: CatchError) {
  // Type-safe error handling
  const message = getErrorMessage(error);
  console.error(message);

  // Or use type guards
  if (isError(error)) {
    console.error(error.message);
  }
}
```

### Database Queries

Use Prisma-generated types instead of recreating them:

```typescript
import { TournamentDraftWithPlayers, PlayerWhereInput } from '@/types';

// Get tournament with players
const tournament: TournamentDraftWithPlayers = await prisma.tournamentDraft.findUnique({
  where: { id: tournamentId },
  include: { players: true }
});

// Use where clause types
const where: PlayerWhereInput = {
  name: { contains: searchQuery },
  email: { not: null }
};
```

### Socket.IO

Use typed Socket.IO events:

```typescript
import {
  ServerToClientEvents,
  ClientToServerEvents,
  PlayerUpdatePayload,
  SocketRooms
} from '@/types';
import { Server } from 'socket.io';

const io = new Server<ClientToServerEvents, ServerToClientEvents>();

// Emit events with type safety
const payload: PlayerUpdatePayload = {
  tournament_id: 1,
  player: { /* ... */ },
  action: 'added'
};

io.to(SocketRooms.tournament(1)).emit('player:added', payload);
```

### Components

Use component prop types:

```typescript
import { TournamentPlayer, PlayerRowProps } from '@/types';

export function PlayerRow(props: PlayerRowProps) {
  // Component implementation
}
```

## Best Practices

### 1. Never Use `any`

Replace all instances of `any` with proper types:

```typescript
// ❌ Bad
catch (error: any) {
  console.log(error.message);
}

// ✅ Good
import { CatchError, getErrorMessage } from '@/types';

catch (error: CatchError) {
  const message = getErrorMessage(error);
  console.log(message);
}
```

### 2. Use Prisma Types

Don't recreate types that Prisma already generates:

```typescript
// ❌ Bad - Manually defining
interface Player {
  uid: string;
  name: string;
  // ...
}

// ✅ Good - Using Prisma types
import { Player } from '@/types';
```

### 3. Use Utility Types

For partial selections or extensions:

```typescript
import { PlayerBasicInfo, Nullable } from '@/types';

// Only includes uid, name, nickname, email, photo_url
const player: PlayerBasicInfo = await getPlayerBasic(uid);

// Explicitly nullable
const maybePlayer: Nullable<PlayerBasicInfo> = null;
```

### 4. Type Dynamic Data

For JSON columns or dynamic objects:

```typescript
import { JsonValue, DynamicObject } from '@/types';

// For JSON database columns
const jsonData: JsonValue = await prisma.someTable.findUnique(...);

// For dynamic objects with unknown keys
const dynamicData: DynamicObject = {
  someKey: 'value',
  anotherKey: 123
};
```

### 5. API Response Consistency

Always use `ApiResponse` wrapper:

```typescript
import { ApiResponse } from '@/types';

return Response.json<ApiResponse<Player>>({
  success: true,
  data: player
});
```

## Migration Guide

### Fixing ESLint `no-explicit-any` Errors

1. **Catch blocks**: Use `CatchError` (which is `unknown`)
2. **API route params**: Use `RouteContext<T>`
3. **Database queries**: Use Prisma types from `@/types/database`
4. **Socket events**: Use typed events from `@/types/socket`
5. **Component props**: Define interfaces in `@/types/components`
6. **JSON data**: Use `JsonValue` or `DynamicObject`

### Example Migration

**Before:**
```typescript
export async function POST(request: Request, context: any) {
  try {
    const params: any = await context.params;
    const body: any = await request.json();
    const player: any = await prisma.player.findUnique({
      where: { uid: params.uid }
    });
    return Response.json({ success: true, data: player });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message });
  }
}
```

**After:**
```typescript
import {
  RouteContext,
  UidRouteParams,
  ApiResponse,
  CatchError,
  getErrorMessage,
  Player
} from '@/types';

export async function POST(
  request: Request,
  context: RouteContext<UidRouteParams>
) {
  try {
    const params = await context.params;
    const body = await request.json();

    const player: Player | null = await prisma.player.findUnique({
      where: { uid: params.uid }
    });

    return Response.json<ApiResponse<Player | null>>({
      success: true,
      data: player
    });
  } catch (error: CatchError) {
    return Response.json<ApiResponse>({
      success: false,
      error: getErrorMessage(error)
    });
  }
}
```

## TypeScript Configuration

Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "paths": {
      "@/types": ["./types"],
      "@/types/*": ["./types/*"]
    }
  }
}
```

This allows importing with `@/types` instead of relative paths.
