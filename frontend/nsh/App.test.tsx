import { expect, open, test } from "nsh/test";

test("renders the overview and switches chart modes", async () => {
  const app = await open("./App.tsx");
  expect(app.texts()).toContain("月均订阅支出");
  expect(app.texts()).toContain("Spotify");
  await app.press("label:分块");
  await app.wait(50);
  expect(app.texts()).toContain("月均支出构成");
});
