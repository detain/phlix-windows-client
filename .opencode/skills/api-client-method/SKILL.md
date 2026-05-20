---
name: api-client-method
description: Adds a new method to the `ApiClient` class in `src/renderer/utils/api.ts`. Defines exported TypeScript request/response interfaces (matching `MediaItem`/`Library`/`AuthResult` style), calls `this.request<T>(method, path, data)` so axios interceptors attach `Authorization: Bearer` and `X-Phlix-Session-ID` headers automatically against `${VITE_PHLIX_SERVER_URL}/api/v1`. Use `URLSearchParams` for GET query strings (see `getLibraryItems`). Use when user says 'add API call', 'new endpoint method', 'call /api/v1/...', or hits a Phlix Media Server route not yet wired. Do NOT use for raw `axios.create` outside `ApiClient` or for bypassing the `request()` helper.
---

# API Client Method

## Critical

- All HTTP traffic to the Phlix Media Server MUST go through `ApiClient.request<T>()` in `src/renderer/utils/api.ts`. Never call `axios.get/post/put/delete` directly from a method — the `request()` helper is what attaches the bearer token, session ID, and base URL via the constructor-installed interceptors.
- Never create a second `axios.create({...})` instance. The single `this.client` instance in `ApiClient` is the only one allowed. New methods reuse it via `this.request()`.
- All public methods MUST be `async` and return `Promise<T>` where `T` is an exported interface. Do NOT return `any` or untyped `AxiosResponse` objects — `request()` already unwraps `response.data`.
- Endpoint paths passed to `this.request()` are RELATIVE to `/api/v1` (the base URL). Pass `/libraries`, NOT `/api/v1/libraries` and NOT a full URL.
- For GET requests with query parameters, build them with `URLSearchParams` and append `?${params.toString()}` to the path — do NOT pass a `params` config object, because `request()` only forwards `data` as the body.
- Export every new request/response interface from `src/renderer/utils/api.ts` so stores (`src/renderer/stores/`) and pages can import them by name.

## Instructions

1. **Read the current `ApiClient` file** at `src/renderer/utils/api.ts` to confirm the existing interface naming, the `request<T>()` signature, and the section ordering (auth methods → libraries → items → playback → search). New methods must be inserted into the matching section, not appended blindly. Verify the file still exposes `export const apiClient = new ApiClient()` at the bottom before proceeding.

2. **Define the response interface(s) above the class.** Match the existing style — `PascalCase`, one field per line, optional fields with `?`, no inline JSDoc unless the field name is genuinely ambiguous. Mirror neighbors like `MediaItem`, `Library`, `AuthResult`. If the endpoint returns a paginated list, model it as `{ items: Thing[]; total: number; offset: number; limit: number }` to match `getLibraryItems`'s return shape. Verify the interface is `export`ed before proceeding.

3. **Define a request interface only if the body has more than 2 fields or any optional fields.** For 1–2 required primitives, accept them as positional method parameters (see `login(username, password)`). For richer payloads, define `export interface FooRequest { ... }` and accept a single `data: FooRequest` parameter (see how complex payloads are passed as `data` to `this.request`). Verify by checking that the resulting method signature matches the verbosity of the nearest existing method.

4. **Add the method inside the `ApiClient` class** in the section matching its concern (auth, libraries, items, playback, search). Use this exact shape — adjust verb, path, generics, and body:

   ```ts
   async getThing(id: string): Promise<Thing> {
     return this.request<Thing>('GET', `/things/${id}`);
   }

   async createThing(data: CreateThingRequest): Promise<Thing> {
     return this.request<Thing>('POST', '/things', data);
   }

   async listThings(libraryId: string, offset = 0, limit = 50): Promise<ThingList> {
     const params = new URLSearchParams({
       library_id: libraryId,
       offset: offset.toString(),
       limit: limit.toString(),
     });
     return this.request<ThingList>('GET', `/things?${params.toString()}`);
   }
   ```

   Verify: the method calls `this.request<T>()` exactly once, the generic `<T>` matches the declared return type, and the path begins with `/` and does NOT include `/api/v1`.

5. **Use `URLSearchParams` for ALL GET query strings**, even single-param ones, to match `getLibraryItems` in `src/renderer/utils/api.ts`. Coerce numbers with `.toString()` and booleans with `String(bool)`. Skip falsy/undefined params with a conditional `if (foo !== undefined) params.append('foo', String(foo));` — do not send empty strings. Verify the final path renders correctly by mentally substituting sample values.

6. **For non-GET requests that take a body**, pass the body as the third argument to `this.request()`. `request()` forwards it as `data` to axios, which JSON-encodes it automatically because the constructor sets `'Content-Type': 'application/json'`. Do NOT `JSON.stringify` the body yourself. Do NOT add headers — the interceptors handle auth.

7. **Do NOT add try/catch inside the method.** The axios response interceptor in the constructor already handles 401 by clearing the token, emitting `auth:logout`, and rejecting. Callers (stores, pages) are responsible for their own error handling — let the promise reject so they can `catch` it. Adding a local try/catch swallows errors that stores rely on.

8. **Update the consuming store or page.** Find the zustand store in `src/renderer/stores/` that owns this domain (e.g. `playbackStore.ts` for playback endpoints) and add an action that calls `apiClient.yourNewMethod(...)`. Import the response interface from `../utils/api`. If no store fits, call `apiClient` directly from the page component in `src/renderer/pages/`. Verify the store/page compiles by running step 9.

9. **Type-check and test.** Run these and confirm both pass before claiming completion:

   ```bash
   npx tsc --noEmit
   npm test -- tests/unit/api.test.ts
   ```

   If a relevant test exists in `tests/unit/api.test.ts`, extend it with a case for the new method that mocks the underlying axios client and asserts the URL, method, and body. If no matching test pattern exists for this domain yet, add one following the existing test's mocking style.

## Examples

### Example 1: "Add an API call to mark an item as watched"

**Endpoint:** `POST /api/v1/items/:id/watched` returning the updated `MediaItem`.

**Actions taken:**

1. Confirmed `MediaItem` already exists in `src/renderer/utils/api.ts` — no new response interface needed.
2. Added to the items section of `ApiClient`:

   ```ts
   async markItemWatched(itemId: string): Promise<MediaItem> {
     return this.request<MediaItem>('POST', `/items/${itemId}/watched`);
   }
   ```

3. Added a `markWatched` action to `src/renderer/stores/playbackStore.ts` (or the items store if present) that calls `apiClient.markItemWatched(id)` and updates local state with the returned `MediaItem`.
4. Ran `npx tsc --noEmit` — clean.

**Result:** A single new method, no new axios instances, auth headers attached automatically, callers handle errors.

### Example 2: "Add a search endpoint with filters"

**Endpoint:** `GET /api/v1/search?q=...&type=...&library_id=...&limit=...` returning `{ items: MediaItem[]; total: number }`.

**Actions taken:**

1. Added a response interface above the class:

   ```ts
   export interface SearchResults {
     items: MediaItem[];
     total: number;
   }
   ```

2. Added to the search section of `ApiClient`:

   ```ts
   async search(
     query: string,
     opts: { type?: string; libraryId?: string; limit?: number } = {},
   ): Promise<SearchResults> {
     const params = new URLSearchParams({ q: query });
     if (opts.type) params.append('type', opts.type);
     if (opts.libraryId) params.append('library_id', opts.libraryId);
     if (opts.limit !== undefined) params.append('limit', opts.limit.toString());
     return this.request<SearchResults>('GET', `/search?${params.toString()}`);
   }
   ```

3. `npx tsc --noEmit` clean; extended `tests/unit/api.test.ts` to assert the URL composition for a sample call.

**Result:** Optional filters skipped cleanly, query string built via `URLSearchParams`, single typed return.

## Common Issues

- **`Property 'request' is private` or `is protected`** when calling `this.request()`. The helper is declared `private` in `ApiClient` — that's fine inside class methods. If you see this error you're calling it from OUTSIDE the class (e.g. from a store). Fix: move the call into a new `ApiClient` method and have the store call `apiClient.yourMethod(...)` instead.
- **`401 Unauthorized` followed by an immediate logout** even though the user is signed in. The response interceptor clears the token on any 401. Verify: (a) the path you passed does not double up `/api/v1` (the base URL already includes it, so `/api/v1/foo` becomes `/api/v1/api/v1/foo`), and (b) `localStorage.getItem('phlix_auth_token')` is non-null at call time. Open DevTools → Network and inspect the actual request URL.
- **Query parameters arrive as `undefined` on the server.** You passed them via a third-arg object (`this.request('GET', '/foo', { id })`) — but `request()` sends the third argument as the body, not as params. Fix: build the query string with `URLSearchParams` and append it to the path, as shown in `getLibraryItems`.
- **`TypeError: response.data is undefined`** in the caller. You returned the raw `AxiosResponse` instead of letting `request()` unwrap it. Fix: ensure your method body is `return this.request<T>(...)` with no `.then(r => r)` or manual `await` + `.data` access.
- **Body sent as `[object Object]` string.** You called `JSON.stringify(body)` before passing it. Remove the stringify — axios + the configured `'Content-Type': 'application/json'` header does it for you.
- **`Cannot find name 'VITE_PHLIX_SERVER_URL'`** when editing the base URL. The constant is read from `import.meta.env.VITE_PHLIX_SERVER_URL` in the constructor — don't reference it directly inside methods. Configure it via `.env` / `.env.local` at the project root and restart Vite.
- **Test fails with `apiClient.request is not a function` after mocking.** The test is mocking `apiClient` instead of the underlying axios client. Mirror the existing pattern in `tests/unit/api.test.ts` — mock at the axios layer so the real `ApiClient` logic (URL composition, headers) is exercised.