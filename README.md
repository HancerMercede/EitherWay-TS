# EitherWay

Functional error handling with the **Either monad** for TypeScript.

```
npm install eitherway
yarn add eitherway
```

## Philosophy

**Either** is a discriminated union that represents a value that can be one of two types:

- **`Right<R>`** — success, holds a value of type `R`
- **`Left<L>`** — error, holds a value of type `L`

Instead of throwing exceptions or dealing with unpredictable `try/catch`, you model fallible operations as `Either<L, R>` and compose them with `map`, `flatMap`, `fold`, and friends. The **Left** propagates automatically through the pipeline — no if/else soup, no forgotten error handling.

## Quickstart

```ts
import { Either, EitherAsync } from "eitherway"

// Sync pipeline
const parse = (json: string) =>
  Either.try(() => JSON.parse(json))
    .mapLeft(err => `Invalid JSON: ${(err as Error).message}`)
    .ensure((obj): obj is Record<string, unknown> => typeof obj === "object", () => "Not an object")

const result = parse('{"name":"EitherWay"}')
result.fold(
  err => console.error("Failed:", err),
  obj => console.log("Parsed:", obj),
)

// Async pipeline
const fetchUser = (id: string) =>
  EitherAsync.try(async () => {
    const res = await fetch(`/api/users/${id}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  })
    .mapLeft(err => `Request failed: ${(err as Error).message}`)
    .ensure((u): u is { name: string } => typeof u.name === "string", () => "Missing name")

const user = await fetchUser("123").fold(
  err => console.error(err),
  u => u,
)
```

## API

---

### `Either.right(value)` / `Either.left(value)`

Constructors for the two variants.

```ts
const ok  = Either.right(42)        // Either<never, number>
const err = Either.left("fail")     // Either<string, never>
```

---

### `Either.of(value)`

Alias for `Either.right`. Useful at the end of a pipeline.

```ts
const result = Either.of(42)  // Either<never, number>
```

---

### `Either.try(fn)`

Wraps a **sync** function that might throw. Returns `Either<unknown, T>`.

```ts
const result = Either.try(() => JSON.parse(input))
  .mapLeft(err => `Parse error: ${(err as Error).message}`)
```

---

### `fold(leftFn, rightFn)`

Pattern match: unwraps the value by running one of the two functions.

```ts
const msg = result.fold(
  err => `Error: ${err}`,
  val => `Success: ${val}`,
)
```

---

### `map(fn)`

Transform the Right value. Left passes through unchanged.

```ts
Either.right(21).map(x => x * 2)   // Right(42)
Either.left("err").map(x => x * 2)  // Left("err") — unchanged
```

---

### `flatMap(fn)`

Chain a computation that returns an Either. Great for sequential operations.

```ts
Either.right(21)
  .flatMap(x => Either.right(x * 2))  // Right(42)
```

---

### `mapLeft(fn)`

Transform the Left value. Right passes through unchanged.

```ts
Either.left(10).mapLeft(x => x * 2)      // Left(20)
Either.right(42).mapLeft(x => x * 2)      // Right(42) — unchanged
```

---

### `flatMapLeft(fn)`

Chain a computation from the Left value. Useful for error recovery.

```ts
Either.left("err")
  .flatMapLeft(() => Either.right(42))  // Right(42) — recovered!

Either.left("too small")
  .flatMapLeft(err => Either.left(err.toUpperCase())) // Left("TOO SMALL")
```

---

### `bimap(leftFn, rightFn)`

Map both sides simultaneously.

```ts
Either.right("hello").bimap(
  l => (l as string).length,
  r => r.toUpperCase(),
)  // Right("HELLO")

Either.left("err").bimap(
  l => l.length,
  r => (r as string).toUpperCase(),
)  // Left(3)
```

---

### `tap(fn)`

Run a side effect on the Right value. Returns the original Either unchanged.

```ts
const result = Either.right(42)
  .tap(x => console.log("Got:", x))
// logs: Got: 42
```

---

### `tapLeft(fn)`

Run a side effect on the Left value.

```ts
Either.left("err")
  .tapLeft(err => console.error("Oops:", err))
```

---

### `ensure(predicate, errorFn)`

Validate the Right value. If the predicate fails, turns into a Left with the error from `errorFn`.

```ts
Either.right(150)
  .ensure(n => n < 100, () => "too large")
// Left("too large")

Either.right(50)
  .ensure(n => n < 100, () => "too large")
// Right(50) — passes
```

---

### `getOrElse(defaultValue)`

Extract the Right value or return a default.

```ts
Either.right(42).getOrElse(0)   // 42
Either.left("err").getOrElse(0)  // 0
```

---

### `getOrThrow()`

Extract the Right value or throw the Left value.

```ts
Either.right(42).getOrThrow()    // 42
Either.left("err").getOrThrow()  // throws "err"
```

---

### `orElse(fn)`

Recover from a Left by providing an alternative Either.

```ts
Either.left("err").orElse(() => Either.right(99))  // Right(99)
Either.right(42).orElse(() => Either.right(0))      // Right(42) — unchanged
```

---

## EitherAsync

The async version of Either. Every operation returns a new `EitherAsync` without executing immediately — call `.run()` or `.fold()` at the end.

### Construction

```ts
EitherAsync.fromEither(Either.right(42))  // from a resolved Either
EitherAsync.fromPromise(Promise.resolve(Either.right(42)))  // from a Promise<Either>
EitherAsync.right(42)   // async Right
EitherAsync.left("err")  // async Left
```

### `EitherAsync.try(fn)`

Wraps an **async** function that might throw.

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

### Composition

All the methods from `Either` are mirrored in `EitherAsync`:

| Method         | Returns               |
| -------------- | --------------------- |
| `map`          | `EitherAsync<L, T>`   |
| `flatMap`      | `EitherAsync<L, T>`   |
| `mapLeft`      | `EitherAsync<T, R>`   |
| `flatMapLeft`  | `EitherAsync<T, R>`   |
| `bimap`        | `EitherAsync<T, U>`   |
| `tap`          | `EitherAsync<L, R>`   |
| `tapLeft`      | `EitherAsync<L, R>`   |
| `ensure`       | `EitherAsync<L\|T, R>` |

### Execution

```ts
// Returns Promise<Either<L, R>>
const either = await pipeline.run()

// Returns Promise<T> directly
const result = await pipeline.fold(
  err => handleError(err),
  val => handleSuccess(val),
)

// Extract with defaults
const value = await pipeline.getOrElse(defaultValue)
const value = await pipeline.getOrThrow()  // throws if Left
```

### Chaining example

```ts
const final = await getUser(id)
  .flatMap(user => saveAuditLog(user))
  .tap(saved => console.log("Saved:", saved.id))
  .ensure((u): u is User => u.active, () => "Inactive user")
  .fold(
    err => ({ status: "error", message: err }),
    user => ({ status: "ok", user }),
  )
```

## License

MIT
