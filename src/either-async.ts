import { Either, Right, Left } from "./either"

/**
 * An async version of Either that wraps a lazy `Promise<Either<L, R>>`.
 *
 * Instead of executing immediately, it defers execution until `run()` is called,
 * making it safe to compose pipelines without triggering side effects early.
 */
export class EitherAsync<L, R> {
  private constructor(
    private readonly promiseValue: () => Promise<Either<L, R>>,
  ) {}

  // ---- Functor ----

  /**
   * Transforms the Right value when the Either is Right.
   * Left passes through unchanged.
   *
   * ```ts
   * const result = await EitherAsync
   *   .fromEither(Either.right(21))
   *   .map(x => x * 2)
   *   .run()
   * result.fold(
   *   () => "should never happen",
   *   val => val, // 42
   * )
   * ```
   */
  map<T>(fn: (r: R) => T): EitherAsync<L, T> {
    return this.flatMap(async r => Either.right(fn(r)))
  }

  // ---- Monad ----

  /**
   * Chains another async Either operation that depends on the Right value.
   *
   * ```ts
   * const result = await getUser(id)
   *   .flatMap(user => saveAuditLog(user))
   *   .run()
   * ```
   */
  flatMap<T>(fn: (right: R) => Promise<Either<L, T>>): EitherAsync<L, T> {
    return new EitherAsync<L, T>(async () => {
      const value = await this.promiseValue()
      return value.fold(
        leftValue => Promise.resolve(new Left<L, T>(leftValue)),
        rightValue => fn(rightValue),
      )
    })
  }

  // ---- Bifunctor ----

  /**
   * Transforms the Left value when the Either is Left.
   * Right passes through unchanged.
   */
  mapLeft<T>(fn: (l: L) => T): EitherAsync<T, R> {
    return this.flatMapLeft(async l => Either.left(fn(l)))
  }

  /**
   * Chains another async Either operation from the Left value.
   * Useful for error recovery or error transformation pipelines.
   */
  flatMapLeft<T>(fn: (left: L) => Promise<Either<T, R>>): EitherAsync<T, R> {
    return new EitherAsync<T, R>(async () => {
      const value = await this.promiseValue()
      return value.fold(
        leftValue => fn(leftValue),
        async rightValue =>
          new Right<T, R>(rightValue) as Either<T, R>,
      )
    })
  }

  /**
   * Maps both sides of the Either simultaneously.
   */
  bimap<T, U>(leftFn: (l: L) => T, rightFn: (r: R) => U): EitherAsync<T, U> {
    return new EitherAsync<T, U>(async () => {
      const value = await this.promiseValue()
      return value.bimap(leftFn, rightFn)
    })
  }

  // ---- Side effects ----

  /**
   * Runs a side effect when the Either is Right.
   * Returns the original value unchanged.
   *
   * ```ts
   * await fetchUser(id)
   *   .tap(user => console.log("loaded:", user.name))
   *   .run()
   * ```
   */
  tap(fn: (r: R) => void): EitherAsync<L, R> {
    return new EitherAsync<L, R>(async () => {
      const value = await this.promiseValue()
      return value.tap(fn)
    })
  }

  /**
   * Runs a side effect when the Either is Left.
   */
  tapLeft(fn: (l: L) => void): EitherAsync<L, R> {
    return new EitherAsync<L, R>(async () => {
      const value = await this.promiseValue()
      return value.tapLeft(fn)
    })
  }

  // ---- Validation ----

  /**
   * Validates the Right value. If the predicate fails, the Either turns into a Left
   * with the error produced by `errorFn`.
   *
   * ```ts
   * const result = await EitherAsync
   *   .fromEither(Either.right(150))
   *   .ensure(n => n < 100, () => "too large")
   *   .run()
   * result.fold(
   *   err => err,        // "too large"
   *   n => n,
   * )
   * ```
   */
  ensure<T>(predicate: (r: R) => boolean, error: T): EitherAsync<L | T, R>
  ensure<T>(predicate: (r: R) => boolean, errorFn: (r: R) => T): EitherAsync<L | T, R>
  ensure<T>(predicate: (r: R) => boolean, errorFn: () => T): EitherAsync<L | T, R>
  ensure<T>(predicate: (r: R) => boolean, errorOrFn: T | ((r: R) => T) | (() => T)): EitherAsync<L | T, R> {
    return new EitherAsync<L | T, R>(async () => {
      const value = await this.promiseValue()
      return value.ensure(predicate, errorOrFn as any)
    })
  }

  // ---- Extraction ----

  /**
   * Executes the lazy promise and returns the raw Either.
   *
   * ```ts
   * const either = await pipeline.run()
   * ```
   */
  run(): Promise<Either<L, R>> {
    return this.promiseValue()
  }

  /**
   * Returns the Right value or a default.
   */
  async getOrElse(defaultValue: R): Promise<R> {
    const value = await this.promiseValue()
    return value.getOrElse(defaultValue)
  }

  /**
   * Returns the Right value or throws the Left value.
   */
  async getOrThrow(): Promise<R> {
    const value = await this.promiseValue()
    return value.getOrThrow()
  }

  // ---- Pattern matching (async) ----

  /**
   * Pattern match on the Either, returning a Promise of the result.
   *
   * ```ts
   * const msg = await pipeline.fold(
   *   err => `Error: ${err}`,
   *   ok  => `Success: ${ok}`,
   * )
   * ```
   */
  async fold<T>(leftFn: (l: L) => T, rightFn: (r: R) => T): Promise<T> {
    const value = await this.promiseValue()
    return value.fold(leftFn, rightFn)
  }

  // ---- Static constructors ----

  /**
   * Wraps a resolved Either into EitherAsync.
   *
   * ```ts
   * const async = EitherAsync.fromEither(Either.right(42))
   * ```
   */
  static fromEither<L, R>(value: Either<L, R>): EitherAsync<L, R> {
    return new EitherAsync<L, R>(() => Promise.resolve(value))
  }

  /**
   * Wraps a Promise of Either into EitherAsync.
   *
   * ```ts
   * const result = EitherAsync.fromPromise(fetchData())
   * ```
   */
  static fromPromise<L, R>(value: Promise<Either<L, R>>): EitherAsync<L, R> {
    return new EitherAsync<L, R>(() => value)
  }

  /**
   * Constructs an EitherAsync that resolves to a Right.
   *
   * ```ts
   * const ok = EitherAsync.right(42)
   * ```
   */
  static right<R>(value: R): EitherAsync<never, R> {
    return EitherAsync.fromEither(Either.right(value))
  }

  /**
   * Constructs an EitherAsync that resolves to a Left.
   *
   * ```ts
   * const err = EitherAsync.left("failed")
   * ```
   */
  static left<L>(value: L): EitherAsync<L, never> {
    return EitherAsync.fromEither(Either.left(value))
  }

  /**
   * Wraps an async function that might throw.
   *
   * ```ts
   * const result = await EitherAsync
   *   .try(() => fetch("/api/users"))
   *   .mapLeft(err => `Request failed: ${(err as Error).message}`)
   *   .run()
   * ```
   */
  static try<T>(fn: () => Promise<T>): EitherAsync<unknown, T>
  static try<T, E>(fn: () => Promise<T>, error: E): EitherAsync<E, T>
  static try<T, E>(fn: () => Promise<T>, handler: (error: unknown) => E): EitherAsync<E, T>
  static try<T, E>(
    fn: () => Promise<T>,
    errorOrHandler?: E | ((error: unknown) => E),
  ): EitherAsync<unknown | E, T> {
    return new EitherAsync<unknown | E, T>(async () => {
      try {
        const value = await fn()
        return Either.right(value)
      } catch (err) {
        if (errorOrHandler === undefined) {
          return Either.left(err)
        }
        if (typeof errorOrHandler === "function") {
          return Either.left((errorOrHandler as (error: unknown) => E)(err))
        }
        return Either.left(errorOrHandler)
      }
    })
  }
}
