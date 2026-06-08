# EitherWay — TypeScript Guide

**Errors as values, not exceptions.**

EitherWay is a functional error-handling library for TypeScript that eliminates try-catch sprawl and makes failure paths explicit in your type signatures. Built on the Either monad pattern, it brings Railway-Oriented Programming to TypeScript with zero dependencies.

```
npm install eitherway
yarn add eitherway
```

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Core Types](#core-types)
3. [Either — Sync API](#either--sync-api)
4. [EitherAsync — Async API](#eitherasync--async-api)
5. [Pattern Comparison](#pattern-comparison)
6. [Migration Guide](#migration-guide)
7. [FAQ](#faq)
8. [API Reference](#api-reference)

---

## Philosophy

Exceptions are invisible control flow. They jump across callbacks, bubble up unexpectedly, and hide in places you don't expect. EitherWay flips that:

- **Errors are values.** A function that can fail says so in its return type: `Either<Error, Result>`.
- **No try-catch noise.** Business logic stays clean; error handling stays explicit.
- **Short-circuit by design.** Once something fails, the pipeline stops. You don't check `if (error)` at every step.
- **TypeScript is your safety net.** If you don't handle the error case, it won't compile.

### Types vs Exceptions

| | Exceptions | EitherWay |
|---|---|---|
| **Signature** | `function get(): Result` | `function get(): Either<Err, Result>` |
| **Control flow** | Invisible — jumps up the call stack | Visible — follows the pipeline |
| **Composition** | try-catch nesting | map, flatMap, fold |
| **Error handling** | Optional — can be missed | Mandatory — compiler forces match |
| **Async** | try-catch in every async fn | EitherAsync composes like sync |

---

## Core Types

### `Either<L, R>`

A discriminated union representing a value that can be one of two types:

- **`Left<L>`** — error, holds a value of type `L`
- **`Right<R>`** — success, holds a value of type `R`

```ts
type Either<L, R> = Left<L, R> | Right<L, R>
```

The naming comes from the mathematical tradition: the **Right** value is the correct one, the **Left** value is wrong.

### `EitherAsync<L, R>`

A lazy wrapper around `Promise<Either<L, R>>`. The wrapped function is NOT executed until `.run()` or `.fold()` is called. This makes it safe to compose pipelines without triggering side effects early.

```ts
class EitherAsync<L, R> {
  // Lazy: nothing executes until you await
  run(): Promise<Either<L, R>>
  fold<T>(leftFn, rightFn): Promise<T>
}
```

---

## Either — Sync API

### Construction

```ts
// Success
const ok: Either<never, number> = Either.right(42)

// Error
const err: Either<string, never> = Either.left("something went wrong")

// Alias for right
const result = Either.of(42)

// From a function that might throw
const parsed = Either.try(() => JSON.parse(input))
```

### Discriminating

Each variant has a `_tag` property and type guards:

```ts
if (result._tag === "Right") {
  result.value  // TypeScript knows this is R
}

if (result.isRight()) { /* ... */ }
if (result.isLeft()) { /* ... */ }
```

### `fold(leftFn, rightFn)` — Pattern matching

The ONLY way to extract the value. The compiler forces you to handle both cases.

```ts
const message = result.fold(
  err => `Error: ${err}`,
  val => `Success: ${val}`,
)
```

### `map(fn)` — Transform success

```ts
Either.right(21).map(x => x * 2)        // Right(42)
Either.left("err").map(x => x * 2)      // Left("err") — unchanged
```

### `flatMap(fn)` — Chain computations

```ts
Either.right(10).flatMap(x =>
  x > 5
    ? Either.right(`big: ${x}`)
    : Either.left("too small")
)
// Right("big: 10")
```

### `mapLeft(fn)` — Transform error

```ts
Either.left(404).mapLeft(code => `HTTP ${code}`)      // Left("HTTP 404")
Either.right(42).mapLeft(code => `HTTP ${code}`)       // Right(42) — unchanged
```

### `flatMapLeft(fn)` — Recover from error

```ts
Either.left("err")
  .flatMapLeft(() => Either.right(42))   // Right(42) — recovered!
```

### `bimap(leftFn, rightFn)` — Map both sides

```ts
Either.right("hello").bimap(
  l => (l as string).length,
  r => r.length,
)  // Right(5)

Either.left("err").bimap(
  l => l.length,
  r => (r as string).length,
)  // Right(5) — only the Right value matters
```

Wait — `bimap` maps each side independently. Only one branch is active at a time.

### `ensure(predicate, error)` — Guard clause

If the predicate fails, the pipeline switches to Left with the given error.

```ts
// Direct error value (recommended when error is known upfront)
Either.right(150)
  .ensure(n => n < 100, "too large")
// Left("too large")

// Lazy factory (no parameters)
Either.right(150)
  .ensure(n => n < 100, () => "too large")

// Lazy factory (receives the value)
Either.right(-5)
  .ensure(x => x > 0, x => `value ${x} is invalid`)
// Left("value -5 is invalid")

// On Left — ensure is skipped, Left passes through unchanged
Either.left("already error")
  .ensure(n => n < 100, "too large")
// Left("already error")
```

### `tap(fn)` — Side effects

```ts
Either.right(42)
  .tap(x => console.log("Got:", x))
// Still Right(42), side effect executed
```

### `tapLeft(fn)` — Error side effects

```ts
Either.left("err")
  .tapLeft(err => console.error("Oops:", err))
// Still Left("err"), side effect executed
```

### `getOrElse(default)` — Extract with fallback

```ts
Either.right(42).getOrElse(0)    // 42
Either.left("err").getOrElse(0)  // 0
```

### `getOrThrow()` — Extract or throw

```ts
Either.right(42).getOrThrow()        // 42
Either.left("err").getOrThrow()      // throws "err"
```

### `orElse(fn)` — Alternative on Left

```ts
Either.left("err").orElse(() => Either.right(99))  // Right(99)
Either.right(42).orElse(() => Either.right(0))      // Right(42) — unchanged
```

---

## EitherAsync — Async API

EitherAsync mirrors the entire Either API but for async operations. Every method returns a new EitherAsync without executing — call `.run()` or `.fold()` at the end.

### Construction

```ts
EitherAsync.fromEither(Either.right(42))        // from an Either value
EitherAsync.fromPromise(Promise.resolve(Either.right(42)))  // from Promise<Either>
EitherAsync.right(42)                           // async Right
EitherAsync.left("err")                         // async Left
```

### `EitherAsync.try(fn)` — Wrap async function

Safely executes an async function. If it throws, the raw exception becomes the Left value.

```ts
const result = await EitherAsync
  .try(async () => {
    const res = await fetch("/api/data")
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  })
  .mapLeft(err => `Failed: ${(err as Error).message}`)
  .run()
```

### `EitherAsync.try(fn, error)` — With direct error value

If the function throws, the exception is discarded and your error value is used directly.

```ts
const result = await EitherAsync
  .try(() => fetch("/api/users").then(r => r.json()), "Network error")
  .ensure(u => Array.isArray(u), "Invalid response")
  .run()
```

### `EitherAsync.try(fn, handler)` — With error handler

The handler maps the caught exception to your error type.

```ts
const result = await EitherAsync
  .try(
    () => fetch("/api/users").then(r => r.json()),
    err => `Request failed: ${(err as Error).message}`,
  )
  .run()
```

### 🚨 Static vs continuation — clave para entender

En TypeScript, **todos** los overloads de `try` son estáticos y **arrancan** pipelines. No hay un `try` de instancia/extensión como en C#.

Para **continuar** un pipeline con una operación que puede fallar, se usa `.flatMap()`:

```ts
const createUser = (request: CreateUserDto) =>
  EitherAsync
    // ⬇️ try estático: arranca, NO recibe valor previo
    .try(() => repo.getByUsername(request.username))
    .mapLeft(err => new AppError(err.message))
    .ensure(user => user === null, new AppError("username already exists"))
    .map(() => request.project())
    // ⬇️ flatMap: continúa, SÍ recibe el valor previo
    .flatMap(async user => {
      user.passwordHash = hashPassword(request.password)
      await repo.addUser(user)
      await repo.commit()
      return Either.right(user)
    })
    .map(user => user.mapTo<UserDto>())
```

| | `EitherAsync.try(...)` (estático) | `.flatMap(...)` (instancia) |
|---|---|---|
| **Rol** | Arrancar un pipeline | Continuar un pipeline |
| **Recibe valor previo?** | ❌ No | ✅ Sí |
| **Ataja excepciones?** | ✅ Automáticamente | ❌ No (usá Either.try adentro si es necesario) |
| **Handler?** | Opcional (según overload) | ❌ No aplica |

**Diferencia con C#:** En C# existe `EitherAsync.Try()` estático (arranca) y `.Try()` extensión (continúa con handler obligatorio). En TypeScript solo tenés el estático, y para continuar usás `.flatMap()`.

### `map(fn)` — Transform success

```ts
const result = await EitherAsync.right(21)
  .map(x => x * 2)
  .run()
// Right(42)
```

### `flatMap(fn)` — Chain async operations

```ts
const result = await getUser(id)
  .flatMap(user => saveAuditLog(user))
  .run()
```

`flatMap` accepts both `(r: R) => Promise<Either<L, T>>` and `(r: R) => Either<L, T>`.

### `ensure(predicate, error)` — Async guard clause

Same three overloads as sync Either:

```ts
// Direct error value
await EitherAsync.right(150)
  .ensure(n => n < 100, "too large")
  .run()

// Lazy factory (no params)
await EitherAsync.right(150)
  .ensure(n => n < 100, () => "too large")
  .run()

// Factory that receives the value
await EitherAsync.right(-5)
  .ensure(x => x > 0, x => `value ${x} is invalid`)
  .run()
```

### `mapLeft(fn)` — Transform error in async pipeline

```ts
const result = await EitherAsync.left(404)
  .mapLeft(code => `HTTP ${code}`)
  .run()
// Left("HTTP 404")
```

### `bimap(leftFn, rightFn)` — Map both sides

```ts
const result = await EitherAsync.right(21)
  .bimap(
    error => `err: ${error}`,
    value => value * 2,
  )
  .run()
// Right(42)
```

### `tap(fn)` / `tapLeft(fn)` — Side effects

```ts
await EitherAsync.right(42)
  .tap(x => console.log("Processing:", x))
  .run()
// Still Right(42), side effect executed
```

### `run()` — Execute pipeline

```ts
const either: Either<L, R> = await pipeline.run()
```

### `fold(leftFn, rightFn)` — Execute and match

```ts
const message = await pipeline.fold(
  err => `Error: ${err}`,
  val => `Success: ${val}`,
)
```

### `getOrElse(default)` / `getOrThrow()` — Extract

```ts
const value = await pipeline.getOrElse(defaultValue)
const value = await pipeline.getOrThrow()  // throws if Left
```

---

## Pattern Comparison

### Option 1: `Try(fn)` + `mapLeft` (recommended for new code)

```ts
const result = await EitherAsync
  .try(() => repo.getUserById(id))
  .mapLeft(_ => "Database error")
  .ensure(u => u !== null, "User not found")
  .run()
```

**Pros:** Single `mapLeft` projects the raw exception once. Clean pipeline. Error type is clear from `mapLeft`.

**Cons:** Requires chaining `mapLeft` even for simple cases.

### Option 2: `Try(fn, handler)` — inline error mapping

```ts
const result = await EitherAsync
  .try(
    () => repo.getUserById(id),
    err => `Database error: ${(err as Error).message}`,
  )
  .ensure(u => u !== null, "User not found")
  .run()
```

**Pros:** Error is resolved immediately. Good when you need the exception message.

**Cons:** Lambda for the handler can feel verbose with types.

### Option 3: `Try(fn, error)` — direct value (cleanest when you don't need the exception)

```ts
const result = await EitherAsync
  .try(() => repo.getUserById(id), "Database error")
  .ensure(u => u !== null, "User not found")
  .run()
```

**Pros:** Most concise. No handler, no mapLeft. Perfect for "I don't care why it failed, only that it failed."

**Cons:** The error is fixed — you can't include exception details.

### Summary

| Pattern | Error includes exception details? | Lines of boilerplate |
|---------|----------------------------------|---------------------|
| `Try(fn)` + `mapLeft` | ✅ Yes (via exception reference) | Medium |
| `Try(fn, handler)` | ✅ Yes (via handler parameter) | Medium |
| `Try(fn, error)` | ❌ No (exception discarded) | Low |

---

## Migration Guide

### From try-catch to Either

**Before:**
```ts
async function getUser(id: string) {
  try {
    const res = await fetch(`/api/users/${id}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (!data.active) throw new Error("Inactive user")
    return data
  } catch (err) {
    console.error("Failed:", err)
    throw err
  }
}
```

**After:**
```ts
function getUser(id: string): EitherAsync<string, User> {
  return EitherAsync
    .try(() => fetch(`/api/users/${id}`).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    }))
    .mapLeft(err => `API error: ${(err as Error).message}`)
    .ensure((u): u is User => u.active, "Inactive user")
}
```

### From callback hell to pipelines

**Before:**
```ts
function process(id: string) {
  validate(id, (err1, valid) => {
    if (err1) return handleError(err1)
    lookup(valid, (err2, data) => {
      if (err2) return handleError(err2)
      transform(data, (err3, result) => {
        if (err3) return handleError(err3)
        return handleSuccess(result)
      })
    })
  })
}
```

**After:**
```ts
function process(id: string): EitherAsync<string, Result> {
  return EitherAsync
    .fromEither(validate(id))
    .flatMap(valid => lookup(valid))
    .map(data => transform(data))
}
```

### From null checks to ensure

**Before:**
```ts
const user = await repo.getById(id)
if (!user) return null
if (!user.active) return null
return user
```

**After:**
```ts
return await EitherAsync
  .try(() => repo.getById(id))
  .mapLeft(_ => "Database error")
  .ensure(u => u !== null, "User not found")
  .ensure(u => u.active, "Inactive user")
  .run()
```

---

## FAQ

### When should I use `Either` vs `EitherAsync`?

- **`Either`**: when you have the value right now (sync computation, validation, transformation).
- **`EitherAsync`**: when the value comes from an async source (fetch, database, file read).

If you have an `EitherAsync` but need to call a sync function, just use `.map()` or `.flatMap()`. If you have an `Either` but need an `EitherAsync`, use `EitherAsync.fromEither()`.

### What's the difference between the three `ensure` overloads?

```ts
// 1. Direct value — error is known upfront
ensure(n => n > 0, "must be positive")

// 2. Factory with value — error depends on the Right value
ensure(x => x > 0, x => `value ${x} is invalid`)

// 3. Factory without value — lazy but doesn't depend on value
ensure(x => x > 0, () => "must be positive")
```

Use #1 when possible — it's the most concise. Use #2 when the error message includes the value. Use #3 when the error is expensive to create and you want it lazy.

### What happens to the exception in `Try(fn, error)`?

**It's discarded.** The `catch` block catches it but never stores it. This is intentional — when you pass a direct error value, you're saying "I don't care about the exception details."

### Can I mix error types in a pipeline?

```ts
const result = await EitherAsync
  .try(() => fetch("/api/data"), "Network error")     // L = string
  .ensure(d => d.length > 0, { code: "EMPTY" })       // L = string | { code: string }
  .run()
```

Yes! The `L` type accumulates: `Either<string | { code: string }, Data[]>`.

### Why `fold` instead of `match`?

`fold` is the standard name in TypeScript/functional programming for pattern matching on a value. `match` is the C# convention.

### Is Either lazy or eager?

**Either** (sync) is eager — it holds a value. **EitherAsync** is lazy — it holds a `() => Promise<Either>` that only executes when `.run()` or `.fold()` is called. You can compose EitherAsync pipelines without triggering any side effects.

### How do I debug Either pipelines?

Use `.tap()` for logging:

```ts
const result = await pipeline
  .tap(x => console.log("before:", x))
  .map(x => transform(x))
  .tap(x => console.log("after:", x))
  .run()
```

### Does the library have any dependencies?

Zero. EitherWay has no dependencies — it's pure TypeScript with only dev dependencies for testing (vitest).

---

## API Reference

### `Either` factories

| Method | Returns | Description |
|--------|---------|-------------|
| `Either.right(value)` | `Either<never, R>` | Success |
| `Either.left(value)` | `Either<L, never>` | Error |
| `Either.of(value)` | `Either<never, R>` | Alias for right |
| `Either.try(fn)` | `Either<unknown, T>` | Wrap sync function that might throw |

### `Either` instance methods

| Method | Returns | Description |
|--------|---------|-------------|
| `fold(leftFn, rightFn)` | `T` | Pattern match |
| `map(fn)` | `Either<L, T>` | Transform Right |
| `flatMap(fn)` | `Either<L, T>` | Chain Either-returning fn |
| `mapLeft(fn)` | `Either<T, R>` | Transform Left |
| `flatMapLeft(fn)` | `Either<T, R>` | Chain from Left (recovery) |
| `bimap(leftFn, rightFn)` | `Either<T, U>` | Map both sides |
| `ensure(predicate, error)` | `Either<L\|T, R>` | Guard clause (3 overloads) |
| `tap(fn)` | `Either<L, R>` | Side effect on Right |
| `tapLeft(fn)` | `Either<L, R>` | Side effect on Left |
| `getOrElse(default)` | `R` | Extract with default |
| `getOrThrow()` | `R` | Extract or throw |
| `orElse(fn)` | `Either<L, R>` | Alternative on Left |
| `isRight()` | `boolean` | Type guard |
| `isLeft()` | `boolean` | Type guard |

### `EitherAsync` static methods

| Method | Returns | Description |
|--------|---------|-------------|
| `fromEither(either)` | `EitherAsync<L, R>` | Wrap an Either |
| `fromPromise(promise)` | `EitherAsync<L, R>` | Wrap a Promise<Either> |
| `right(value)` | `EitherAsync<never, R>` | Async Right |
| `left(value)` | `EitherAsync<L, never>` | Async Left |
| `try(fn)` | `EitherAsync<unknown, T>` | Wrap async fn (no handler) |
| `try(fn, error)` | `EitherAsync<E, T>` | Wrap async fn (direct error) |
| `try(fn, handler)` | `EitherAsync<E, T>` | Wrap async fn (with handler) |

### `EitherAsync` instance methods

| Method | Returns | Description |
|--------|---------|-------------|
| `map(fn)` | `EitherAsync<L, T>` | Transform Right |
| `flatMap(fn)` | `EitherAsync<L, T>` | Chain async Either fn |
| `mapLeft(fn)` | `EitherAsync<T, R>` | Transform Left |
| `flatMapLeft(fn)` | `EitherAsync<T, R>` | Chain from Left |
| `bimap(leftFn, rightFn)` | `EitherAsync<T, U>` | Map both sides |
| `ensure(predicate, error)` | `EitherAsync<L\|T, R>` | Guard clause (3 overloads) |
| `tap(fn)` | `EitherAsync<L, R>` | Side effect on Right |
| `tapLeft(fn)` | `EitherAsync<L, R>` | Side effect on Left |
| `run()` | `Promise<Either<L, R>>` | Execute pipeline |
| `fold(leftFn, rightFn)` | `Promise<T>` | Execute and match |
| `getOrElse(default)` | `Promise<R>` | Extract with default |
| `getOrThrow()` | `Promise<R>` | Extract or throw |

---

## License

MIT
