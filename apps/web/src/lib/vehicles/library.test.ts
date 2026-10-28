import { describe, expect, it } from "vitest";
import { getVehicle, SCAN_AREAS } from "./catalog";
import { AREA_LABELS, carTitle, offersFor, SCAN_AREA_PRICE_CENTS } from "./library";

describe("library offers", () => {
  const miata = getVehicle("mazda-mx5-na")!;

  it("lists every area, pricing only those with a scan", () => {
    const offers = offersFor(miata, SCAN_AREAS);
    expect(offers).toHaveLength(SCAN_AREAS.length);
    const dash = offers.find((o) => o.area === "dash")!;
    expect(dash).toMatchObject({ available: true, priceCents: SCAN_AREA_PRICE_CENTS, includedInPro: true });
    const trunk = offers.find((o) => o.area === "trunk")!;
    expect(trunk).toMatchObject({ available: false, priceCents: null, includedInPro: false });
  });

  it("has a label for every area and a readable title", () => {
    for (const a of SCAN_AREAS) expect(AREA_LABELS[a]).toBeTruthy();
    expect(carTitle(miata)).toBe("Mazda MX-5 Miata (NA, 1989 to 1997)");
  });
});
