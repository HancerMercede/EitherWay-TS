import { describe, it, expect } from "vitest"
import { Either, EitherAsync, Left, Right } from "../src/index.js"

// ---- Construction ----

describe("EitherAsync.fromEither", () => {
  it("wraps a Right Either", async () => {
    const result = await EitherAsync.fromEither(Either.right(42)).run()
    expect(result.isRight()).toBe(true)
  })

  it("wraps a Left Either", async () => {
    const result = await EitherAsync.fromEither(Either.left("err")).run()
    expect(result.isLeft()).toBe(true)
  })
})

describe("EitherAsync.fromPromise", () => {
  it("wraps a Promise<Either>", async () => {
    const result = await EitherAsync.fromPromise(
      Promise.resolve(Either.right(42)),
    ).run()
    expect(result.isRight()).toBe(true)
  })
})

describe("EitherAsync.right", () => {
  it("creates an async Right", async () => {
    const result = await EitherAsync.right(42).run()
    result.fold(
      () => expect.fail(),
      val => expect(val).toBe(42),
    )
  })
})

describe("EitherAsync.left", () => {
  it("creates an async Left", async () => {
    const result = await EitherAsync.left("err").run()
    result.fold(
      err => expect(err).toBe("err"),
      () => expect.fail(),
    )
  })
})

// ---- map ----

describe("EitherAsync.map", () => {
  it("transforms Right value", async () => {
    const result = await EitherAsync.right(21)
      .map(x => x * 2)
      .run()
    result.fold(
      () => expect.fail(),
      val => expect(val).toBe(42),
    )
  })

  it("skips transformation on Left", async () => {
    const result = await EitherAsync.left("err")
      .map((x: number) => x * 2)
      .run()
    result.fold(
      err => expect(err).toBe("err"),
      () => expect.fail(),
    )
  })
})

// ---- flatMap ----

describe("EitherAsync.flatMap", () => {
  it("chains Right computations", async () => {
    const result = await EitherAsync.right(21)
      .flatMap(async x => Either.right(x * 2))
      .run()
    result.fold(
      () => expect.fail(),
      val => expect(val).toBe(42),
    )
  })

  it("short-circuits on Left", async () => {
    let side = ""
    const result = await EitherAsync.left("err")
      .flatMap(async x => {
        side = "executed"
        return Either.right(x)
      })
      .run()
    expect(side).toBe("")
    expect(result.isLeft()).toBe(true)
  })
})

// ---- mapLeft ----

describe("EitherAsync.mapLeft", () => {
  it("transforms Left value", async () => {
    const result = await EitherAsync.left(10)
      .mapLeft(x => x * 2)
      .run()
    result.fold(
      err => expect(err).toBe(20),
      () => expect.fail(),
    )
  })

  it("skips on Right", async () => {
    const result = await EitherAsync.right(42)
      .mapLeft((x: number) => x * 2)
      .run()
    expect(result.isRight()).toBe(true)
  })
})

// ---- flatMapLeft ----

describe("EitherAsync.flatMapLeft", () => {
  it("chains Left transformations", async () => {
    const result = await EitherAsync.left("too small")
      .flatMapLeft(async err => Either.left(err.toUpperCase()))
      .run()
    result.fold(
      err => expect(err).toBe("TOO SMALL"),
      () => expect.fail(),
    )
  })

  it("recover from Left to Right", async () => {
    const result = await EitherAsync.left("err")
      .flatMapLeft(async () => Either.right(42))
      .run()
    expect(result.isRight()).toBe(true)
  })
})

// ---- bimap ----

describe("EitherAsync.bimap", () => {
  it("maps Left value", async () => {
    const result = await EitherAsync.left("err")
      .bimap(
        l => l.length,
        r => (r as string).toUpperCase(),
      )
      .run()
    result.fold(
      err => expect(err).toBe(3),
      () => expect.fail(),
    )
  })

  it("maps Right value", async () => {
    const result = await EitherAsync.right("hello")
      .bimap(
        l => (l as string).length,
        r => r.toUpperCase(),
      )
      .run()
    result.fold(
      () => expect.fail(),
      val => expect(val).toBe("HELLO"),
    )
  })
})

// ---- tap ----

describe("EitherAsync.tap", () => {
  it("executes side effect on Right", async () => {
    let side = ""
    const result = await EitherAsync.right(42)
      .tap(x => {
        side = `got ${x}`
      })
      .run()
    expect(side).toBe("got 42")
    expect(result.isRight()).toBe(true)
  })

  it("skips side effect on Left", async () => {
    let side = ""
    const result = await EitherAsync.left("err")
      .tap(x => {
        side = `got ${x}`
      })
      .run()
    expect(side).toBe("")
    expect(result.isLeft()).toBe(true)
  })
})

// ---- tapLeft ----

describe("EitherAsync.tapLeft", () => {
  it("executes side effect on Left", async () => {
    let side = ""
    const result = await EitherAsync.left("err")
      .tapLeft(x => {
        side = `err: ${x}`
      })
      .run()
    expect(side).toBe("err: err")
    expect(result.isLeft()).toBe(true)
  })

  it("skips side effect on Right", async () => {
    let side = ""
    const result = await EitherAsync.right(42)
      .tapLeft(x => {
        side = `err: ${x}`
      })
      .run()
    expect(side).toBe("")
    expect(result.isRight()).toBe(true)
  })
})

// ---- ensure ----

describe("EitherAsync.ensure", () => {
  it("passes when predicate is true", async () => {
    const result = await EitherAsync.right(50)
      .ensure(n => n < 100, () => "too large")
      .run()
    expect(result.isRight()).toBe(true)
  })

  it("fails when predicate is false", async () => {
    const result = await EitherAsync.right(150)
      .ensure(n => n < 100, () => "too large")
      .run()
    expect(result.isLeft()).toBe(true)
    result.fold(
      err => expect(err).toBe("too large"),
      () => expect.fail(),
    )
  })

  it("fails with direct error value", async () => {
    const result = await EitherAsync.right(150)
      .ensure(n => n < 100, "too large" as const)
      .run()
    expect(result.isLeft()).toBe(true)
    result.fold(
      err => expect(err).toBe("too large"),
      () => expect.fail(),
    )
  })
})

// ---- fold ----

describe("EitherAsync.fold", () => {
  it("unwraps Right value", async () => {
    const msg = await EitherAsync.right(42).fold(
      () => "error",
      val => `success: ${val}`,
    )
    expect(msg).toBe("success: 42")
  })

  it("unwraps Left value", async () => {
    const msg = await EitherAsync.left("failed").fold(
      err => `error: ${err}`,
      () => "success",
    )
    expect(msg).toBe("error: failed")
  })
})

// ---- getOrElse ----

describe("EitherAsync.getOrElse", () => {
  it("returns Right value", async () => {
    const val = await EitherAsync.right(42).getOrElse(0)
    expect(val).toBe(42)
  })

  it("returns default for Left", async () => {
    const val = await EitherAsync.left("err").getOrElse(0)
    expect(val).toBe(0)
  })
})

// ---- getOrThrow ----

describe("EitherAsync.getOrThrow", () => {
  it("returns Right value", async () => {
    const val = await EitherAsync.right(42).getOrThrow()
    expect(val).toBe(42)
  })

  it("throws Left value", async () => {
    await expect(EitherAsync.left("err").getOrThrow()).rejects.toThrow("err")
  })
})

// ---- EitherAsync.try ----

describe("EitherAsync.try", () => {
  it("returns Right for successful promise", async () => {
    const result = await EitherAsync.try(async () => "data").run()
    expect(result.isRight()).toBe(true)
    result.fold(
      () => expect.fail(),
      val => expect(val).toBe("data"),
    )
  })

  it("returns Left for rejected promise", async () => {
    const result = await EitherAsync.try(async () => {
      throw new Error("nope")
    }).run()
    expect(result.isLeft()).toBe(true)
    result.fold(
      err => expect(err).toBeInstanceOf(Error),
      () => expect.fail(),
    )
  })

  it("returns Left with direct error value on rejection", async () => {
    const result = await EitherAsync.try(async () => {
      throw new Error("nope")
    }, "custom error").run()
    expect(result.isLeft()).toBe(true)
    result.fold(
      err => expect(err).toBe("custom error"),
      () => expect.fail(),
    )
  })

  it("returns Left with mapped error via handler", async () => {
    const result = await EitherAsync.try(async () => {
      throw new Error("nope")
    }, err => `mapped: ${(err as Error).message}`).run()
    expect(result.isLeft()).toBe(true)
    result.fold(
      err => expect(err).toBe("mapped: nope"),
      () => expect.fail(),
    )
  })
})

// ---- Lazy evaluation ----

describe("lazy evaluation", () => {
  it("does not execute until run() is called", async () => {
    let called = false
    const async = EitherAsync.try(async () => {
      called = true
      return 42
    })
    expect(called).toBe(false)
    await async.run()
    expect(called).toBe(true)
  })
})
