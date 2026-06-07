export class Left<L, R> {
  readonly _tag = "Left" as const
  constructor(readonly value: L) {}

  fold<T>(leftFn: (l: L) => T, _rightFn: (r: R) => T): T {
    return leftFn(this.value)
  }

  isRight(): this is Right<L, R> {
    return false
  }

  isLeft(): this is Left<L, R> {
    return true
  }

  map<T>(_fn: (r: R) => T): Either<L, T> {
    return new Left<L, T>(this.value)
  }

  flatMap<T>(_fn: (r: R) => Either<L, T>): Either<L, T> {
    return new Left<L, T>(this.value)
  }

  mapLeft<T>(fn: (l: L) => T): Either<T, R> {
    return new Left<T, R>(fn(this.value))
  }

  flatMapLeft<T>(fn: (l: L) => Either<T, R>): Either<T, R> {
    return fn(this.value)
  }

  bimap<T, U>(leftFn: (l: L) => T, _rightFn: (r: R) => U): Either<T, U> {
    return new Left<T, U>(leftFn(this.value))
  }

  tap(_fn: (r: R) => void): Either<L, R> {
    return this
  }

  tapLeft(fn: (l: L) => void): Either<L, R> {
    fn(this.value)
    return this
  }

  ensure<T>(_predicate: (r: R) => boolean, _errorFn: () => T): Either<L | T, R> {
    return new Left<L | T, R>(this.value as L | T)
  }

  getOrElse(defaultValue: R): R {
    return defaultValue
  }

  getOrThrow(): R {
    throw this.value
  }

  orElse(fn: (l: L) => Either<L, R>): Either<L, R> {
    return fn(this.value)
  }
}

export class Right<L, R> {
  readonly _tag = "Right" as const
  constructor(readonly value: R) {}

  fold<T>(_leftFn: (l: L) => T, rightFn: (r: R) => T): T {
    return rightFn(this.value)
  }

  isRight(): this is Right<L, R> {
    return true
  }

  isLeft(): this is Left<L, R> {
    return false
  }

  map<T>(fn: (r: R) => T): Either<L, T> {
    return new Right<L, T>(fn(this.value))
  }

  flatMap<T>(fn: (r: R) => Either<L, T>): Either<L, T> {
    return fn(this.value)
  }

  mapLeft<T>(_fn: (l: L) => T): Either<T, R> {
    return new Right<T, R>(this.value)
  }

  flatMapLeft<T>(_fn: (l: L) => Either<T, R>): Either<T, R> {
    return new Right<T, R>(this.value)
  }

  bimap<T, U>(_leftFn: (l: L) => T, rightFn: (r: R) => U): Either<T, U> {
    return new Right<T, U>(rightFn(this.value))
  }

  tap(fn: (r: R) => void): Either<L, R> {
    fn(this.value)
    return this
  }

  tapLeft(_fn: (l: L) => void): Either<L, R> {
    return this
  }

  ensure<T>(predicate: (r: R) => boolean, errorFn: () => T): Either<L | T, R> {
    return predicate(this.value)
      ? new Right<L | T, R>(this.value)
      : new Left<L | T, R>(errorFn())
  }

  getOrElse(_defaultValue: R): R {
    return this.value
  }

  getOrThrow(): R {
    return this.value
  }

  orElse(_fn: (l: L) => Either<L, R>): Either<L, R> {
    return this
  }
}

/**
 * Discriminated union: an Either is either Left (error) or Right (success).
 *
 * - Left holds the error value.
 * - Right holds the success value.
 */
export type Either<L, R> = Left<L, R> | Right<L, R>

// ---- Factories ----

export const Either = {
  /**
   * Constructs a Right (success) Either.
   *
   * ```ts
   * const ok = Either.right(42)
   * ok.isRight() // true
   * ```
   */
  right<R>(value: R): Either<never, R> {
    return new Right<never, R>(value)
  },

  /**
   * Constructs a Left (error) Either.
   *
   * ```ts
   * const err = Either.left("something went wrong")
   * err.isLeft() // true
   * ```
   */
  left<L>(value: L): Either<L, never> {
    return new Left<L, never>(value)
  },

  /**
   * Alias for `Either.right`. Useful at the end of a pipeline.
   *
   * ```ts
   * const ok = Either.of(42)
   * ```
   */
  of<R>(value: R): Either<never, R> {
    return Either.right(value)
  },

  /**
   * Wraps a function that might throw.
   * The error type is `unknown` — refine it with `mapLeft`.
   *
   * ```ts
   * const result = Either.try(() => JSON.parse(input))
   *   .mapLeft(err => `Failed to parse: ${(err as Error).message}`)
   * ```
   */
  try<T>(fn: () => T): Either<unknown, T> {
    try {
      return Either.right(fn())
    } catch (err) {
      return Either.left(err)
    }
  },
}
