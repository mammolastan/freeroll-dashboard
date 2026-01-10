// Temporary test file to verify errorHandler.ts works correctly
// You can delete this file after verification

import { apiGet, apiPost, apiPut, apiDelete } from './errorHandler';

async function testErrorHandler() {
  console.log('Testing errorHandler utility functions...\n');

  // Test 1: Valid GET request
  console.log('Test 1: GET request');
  const getResult = await apiGet<{ message: string }>(
    'https://jsonplaceholder.typicode.com/posts/1'
  );
  console.log('Success:', getResult.success);
  console.log('Has data:', !!getResult.data);
  console.log('');

  // Test 2: Invalid GET request (404)
  console.log('Test 2: GET request with 404');
  const notFoundResult = await apiGet(
    'https://jsonplaceholder.typicode.com/posts/99999999'
  );
  console.log('Success:', notFoundResult.success);
  console.log('Error:', notFoundResult.error);
  console.log('');

  // Test 3: POST request
  console.log('Test 3: POST request');
  const postResult = await apiPost<{ id: number }>(
    'https://jsonplaceholder.typicode.com/posts',
    { title: 'Test', body: 'Test body', userId: 1 }
  );
  console.log('Success:', postResult.success);
  console.log('Has data:', !!postResult.data);
  console.log('');

  // Test 4: Type safety - TypeScript should enforce this
  console.log('Test 4: Type safety validation');
  interface User {
    id: number;
    name: string;
  }

  const userResult = await apiGet<User>('https://jsonplaceholder.typicode.com/users/1');
  if (userResult.success && userResult.data) {
    // TypeScript knows data is User
    console.log('User name:', userResult.data.name);
    // This would be a TypeScript error: userResult.data.invalidProperty
  }
  console.log('');

  console.log('✅ All errorHandler tests completed!');
}

// Only run if executed directly
if (require.main === module) {
  testErrorHandler().catch(console.error);
}

export { testErrorHandler };
