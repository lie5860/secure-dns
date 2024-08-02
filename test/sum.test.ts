import { describe, expect, it } from "vitest";
import DohResolver from "../src/DohResolver";

describe("DohResolver", () => {
  const dohResolver = new DohResolver();
  it("should be a class", () => {
    expect(DohResolver).toBeInstanceOf(Function);
  });
  it("test resolver url", async () => {
    expect(await dohResolver.resolverUrl("http://local.saki.cc/test")).toEqual(
      "http://127.0.0.1/test"
    );
  });
  it("test resolver url6", async () => {
    expect(
      await dohResolver.resolverUrl6("http://nas6.lie5860.top/test")
    ).toEqual("http://[2408:8248:201:1d20:211:32ff:fe12:3457]/test");
  });
  it("test get host", async () => {
    expect(await dohResolver.resolver("local.saki.cc")).toEqual(["127.0.0.1"]);
  });
  it("test disabled doh", async () => {
    const dohResolver = new DohResolver();
    dohResolver.setDOHEnable(false);
    expect(await dohResolver.resolverUrl("http://local.saki.cc/")).toEqual(
      "http://local.saki.cc/"
    );
  });
});
