import { describe, it, expect } from "vitest"
import { Either, Left, Right } from "../src/either"
import type { Either as EitherType } from "../src/either"

// ---- Construction ----

describe("Either.right", () => {
  it("creates a Right", () => {
    const r = Either.right(42)
    expect(r.isRight()).toBe(true)
    expect(r.isLeft()).toBe(false)
    r.fold(
      () => expect.fail("should not be Left"),
      val => expect(val).toBe(42),
    )
  })

  it("infers never for Left", () => {
    const r = Either.right("ok")
    const _typeCheck: EitherType<never, string> = r
    expect(_typeCheck.isRight()).toBe(true)
  })
})

describe("Either.left", () => {
  it("creates a Left", () => {
    const l = Either.left("error")
    expect(l.isLeft()).toBe(true)
    expect(l.isRight()).toBe(false)
    l.fold(
      err => expect(err).toBe("error"),
      () => expect.fail("should not be Right"),
    )
  })

  it("infers never for Right", () => {
    const l = Either.left("err")
    const _typeCheck: EitherType<string, never> = l
    expect(_typeCheck.isLeft()).toBe(true)
  })
})

describe("Either.of", () => {
  it("creates a Right", () => {
    const r = Either.of("value")
    expect(r.isRight()).toBe(true)
  })
})

// ---- fold ----

describe("fold", () => {
  it("maps Left value with leftFn", () => {
    const result = Either.left(10).fold(
      l => l * 2,
      () => 0,
    )
    expect(result).toBe(20)
  })

  it("maps Right value with rightFn", () => {
    const result = Either.right(10).fold(
      () => 0,
      r => r * 2,
    )
    expect(result).toBe(20)
  })
})

// ---- map ----

describe("map", () => {
  it("transforms Right value", () => {
    const result = Either.right(21).map(x => x * 2)
    expect(result.isRight()).toBe(true)
    result.fold(
      () => {},
      val => expect(val).toBe(42),
    )
  })

  it("skips transformation on Left", () => {
    const result = Either.left("err").map((x: number) => x * 2)
    expect(result.isLeft()).toBe(true)
    result.fold(
      err => expect(err).toBe("err"),
      () => expect.fail(),
    )
  })
})

// ---- flatMap ----

describe("flatMap", () => {
  it("chains Right computations", () => {
    const result = Either.right(21).flatMap(x => Either.right(x * 2))
    expect(result.isRight()).toBe(true)
    result.fold(
      () => {},
      val => expect(val).toBe(42),
    )
  })

  it("short-circuits on Left", () => {
    const result = Either.left("err").flatMap((x: number) =>
      Either.right(x * 2),
    )
    expect(result.isLeft()).toBe(true)
  })
})

// ---- mapLeft ----

describe("mapLeft", () => {
  it("transforms Left value", () => {
    const result = Either.left(10).mapLeft(x => x * 2)
    expect(result.isLeft()).toBe(true)
    result.fold(err => expect(err).toBe(20), () => expect.fail())
  })

  it("skips transformation on Right", () => {
    const result = Either.right(42).mapLeft(x => (x as number) * 2)
    expect(result.isRight()).toBe(true)
  })
})

// ---- flatMapLeft ----

describe("flatMapLeft", () => {
  it("chains Left transformations", () => {
    const result = Either.left("too small").flatMapLeft(err =>
      Either.left(err.toUpperCase()),
    )
    expect(result.isLeft()).toBe(true)
    result.fold(err => expect(err).toBe("TOO SMALL"), () => expect.fail())
  })

  it("recover from Left to Right", () => {
    const result = Either.left("err").flatMapLeft(() => Either.right(42))
    expect(result.isRight()).toBe(true)
  })

  it("skips on Right", () => {
    const result = Either.right(42).flatMapLeft(() => Either.left("recovered"))
    expect(result.isRight()).toBe(true)
  })
})

// ---- bimap ----

describe("bimap", () => {
  it("maps Left value with leftFn", () => {
    const result = Either.left("err").bimap(
      l => l.length,
      r => (r as string).toUpperCase(),
    )
    expect(result.isLeft()).toBe(true)
    result.fold(err => expect(err).toBe(3), () => expect.fail())
  })

  it("maps Right value with rightFn", () => {
    const result = Either.right("hello").bimap(
      l => (l as string).length,
      r => r.toUpperCase(),
    )
    expect(result.isRight()).toBe(true)
    result.fold(() => expect.fail(), val => expect(val).toBe("HELLO"))
  })
})

// ---- tap ----

describe("tap", () => {
  it("executes side effect on Right", () => {
    let side = ""
    const result = Either.right(42).tap(x => {
      side = `got ${x}`
    })
    expect(side).toBe("got 42")
    expect(result.isRight()).toBe(true)
  })

  it("skips side effect on Left", () => {
    let side = ""
    const result = Either.left("err").tap(x => {
      side = `got ${x}`
    })
    expect(side).toBe("")
    expect(result.isLeft()).toBe(true)
  })
})

// ---- tapLeft ----

describe("tapLeft", () => {
  it("executes side effect on Left", () => {
    let side = ""
    const result = Either.left("err").tapLeft(x => {
      side = `err: ${x}`
    })
    expect(side).toBe("err: err")
    expect(result.isLeft()).toBe(true)
  })

  it("skips side effect on Right", () => {
    let side = ""
    const result = Either.right(42).tapLeft(x => {
      side = `err: ${x}`
    })
    expect(side).toBe("")
    expect(result.isRight()).toBe(true)
  })
})

// ---- ensure ----

describe("ensure", () => {
  it("passes when predicate is true", () => {
    const result = Either.right(50).ensure(n => n < 100, () => "too large")
    expect(result.isRight()).toBe(true)
  })

  it("fails when predicate is false", () => {
    const result = Either.right(150).ensure(n => n < 100, () => "too large")
    expect(result.isLeft()).toBe(true)
    result.fold(err => expect(err).toBe("too large"), () => expect.fail())
  })

  it("returns Left unchanged", () => {
    const result = Either.left("err").ensure(
      (n: number) => n < 100,
      () => "too large",
    )
    expect(result.isLeft()).toBe(true)
    result.fold(err => expect(err).toBe("err"), () => expect.fail())
  })
})

// ---- getOrElse ----

describe("getOrElse", () => {
  it("returns the Right value", () => {
    expect(Either.right(42).getOrElse(0)).toBe(42)
  })

  it("returns the default value for Left", () => {
    expect(Either.left("err").getOrElse(0)).toBe(0)
  })
})

// ---- getOrThrow ----

describe("getOrThrow", () => {
  it("returns the Right value", () => {
    expect(Either.right(42).getOrThrow()).toBe(42)
  })

  it("throws the Left value", () => {
    expect(() => Either.left("err").getOrThrow()).toThrow("err")
  })
})

// ---- orElse ----

describe("orElse", () => {
  it("returns the same Right", () => {
    const result = Either.right(42).orElse(() => Either.right(0))
    result.fold(() => expect.fail(), val => expect(val).toBe(42))
  })

  it("recover from Left", () => {
    const result = Either.left("err").orElse(() => Either.right(99))
    result.fold(() => expect.fail(), val => expect(val).toBe(99))
  })
})

// ---- isRight / isLeft type narrowing ----

describe("type narrowing", () => {
  it("narrows with isRight and isLeft", () => {
    const either = Either.right("hello") as EitherType<string, string>

    if (either.isRight()) {
      const _val: string = either.value
      expect(_val).toBe("hello")
    } else {
      expect.fail("should be Right")
    }

    const either2 = Either.left("error") as EitherType<string, string>
    if (either2.isLeft()) {
      const _val: string = either2.value
      expect(_val).toBe("error")
    } else {
      expect.fail("should be Left")
    }
  })
})

// ---- Left and Right class access (direct) ----

describe("Left class", () => {
  it("holds a value with _tag Left", () => {
    const l = new Left("error", {} as never)
    expect(l._tag).toBe("Left")
    expect(l.value).toBe("error")
  })
})

describe("Right class", () => {
  it("holds a value with _tag Right", () => {
    const r = new Right<never, number>(42)
    expect(r._tag).toBe("Right")
    expect(r.value).toBe(42)
  })
})

// ---- Either.try ----

describe("Either.try", () => {
  it("returns Right for successful function", () => {
    const result = Either.try(() => JSON.parse('{"a":1}'))
    expect(result.isRight()).toBe(true)
    result.fold(
      () => expect.fail(),
      val => expect(val).toEqual({ a: 1 }),
    )
  })

  it("returns Left for throwing function", () => {
    const result = Either.try(() => JSON.parse("invalid"))
    expect(result.isLeft()).toBe(true)
    result.fold(
      err => expect(err).toBeInstanceOf(Error),
      () => expect.fail(),
    )
  })
})
