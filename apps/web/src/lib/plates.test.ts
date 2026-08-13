import { describe, expect, it } from "vitest"
import { voyages } from "../content/voyages.ts"
import { PLATES, plateById, platesFor } from "./plates.ts"

describe("the Echt-oder-Fake plates", () => {
  it("resolves every plate the curriculum asks for", () => {
    // The content names plates by id and the drawings live in code, so this
    // is the seam where a rename shows up as an empty station rather than a
    // type error. It has to be a test.
    const asked = voyages()
      .flatMap((voyage) => voyage.stations)
      .filter((station) => station.type === "echt")
      .flatMap((station) => (station.type === "echt" ? station.plateIds : []))

    expect(asked.length).toBeGreaterThan(0)
    for (const id of asked) {
      expect(plateById(id), id).toBeDefined()
    }
    expect(platesFor(asked)).toHaveLength(asked.length)
  })

  it("keeps enough sound plates that guessing 'fake' loses", () => {
    // Six plates where five are flawed teaches her to answer "fake" every
    // time and score well, which is the opposite of the lesson.
    const sound = PLATES.filter((plate) => !plate.flawed).length
    expect(sound).toBeGreaterThanOrEqual(2)
    expect(sound).toBeLessThan(PLATES.length - 1)
  })

  it("gives a flawed plate its tells and a sound plate none", () => {
    for (const plate of PLATES) {
      if (plate.flawed) {
        expect(plate.tells.length, plate.id).toBeGreaterThan(0)
      } else {
        expect(plate.tells, plate.id).toHaveLength(0)
      }
      expect(plate.lesson.length, plate.id).toBeGreaterThan(20)
      expect(plate.alt.length, plate.id).toBeGreaterThan(20)
    }
  })

  it("places every tell marker inside the plate", () => {
    for (const plate of PLATES) {
      for (const tell of plate.tells) {
        expect(tell.x, `${plate.id} x`).toBeGreaterThan(0)
        expect(tell.x, `${plate.id} x`).toBeLessThan(100)
        expect(tell.y, `${plate.id} y`).toBeGreaterThan(0)
        expect(tell.y, `${plate.id} y`).toBeLessThan(100)
      }
    }
  })
})
