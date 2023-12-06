const fetch = require("node-fetch");
const Client = require("./index");

let client;

beforeAll(async () => {
  const pass = process.env.USE_FILE ? process.env.RIDT_PASSWORD : process.env.JWT_PASSWORD;
  const url = process.env.USE_FILE ? "https://database-test-ridt.util.repl.co" : "https://database-test-jwt.util.repl.co";
  const resp = await fetch(url, {
    headers: {
      Authorization: "Basic " + btoa("test:" + pass),
    },
  });
  const token = await resp.text();
  client = new Client(token);
  await client.empty();
});

afterEach(async () => {
  await client.empty();
});

test("create a client with a key", async () => {
  expect(client).toBeTruthy();
  expect(typeof client.key).toBe("string");
});

test("sets a value", async () => {
  expect(await client.set("key", "value")).toEqual(client);
  expect(await client.setAll({ key: "value", second: "secondThing" })).toEqual(
    client
  );
});

test("list keys", async () => {
  await client.setAll({
    key: "value",
    second: "secondThing",
  });

  const result = await client.list();
  const expected = ["key", "second"]
  expect(result).toEqual(expect.arrayContaining(expected));

});

test("gets a value", async () => {
  await client.setAll({
    key: "value",
  });

  expect(await client.getAll()).toEqual({ key: "value" });
});

test("delete a value", async () => {
  await client.setAll({
    key: "value",
    deleteThis: "please",
    somethingElse: "in delete multiple",
    andAnother: "again same thing",
  });

  expect(await client.delete("deleteThis")).toEqual(client);
  expect(await client.deleteMultiple("somethingElse", "andAnother")).toEqual(
    client
  );
  expect(await client.list()).toEqual(["key"]);
  expect(await client.empty()).toEqual(client);
  expect(await client.list()).toEqual([]);
});

test("list keys with newline", async () => {
  await client.setAll({
    "key\nwit": "first",
    keywidout: "second",
  });

  const expected = ["keywidout", "key\nwit"];
  const result = await client.list();

  expect(result).toEqual(expect.arrayContaining(expected));
});

test("ensure that we escape values when setting", async () => {
  expect(await client.set("a", "1;b=2")).toEqual(client);
  expect(await client.list()).toEqual(["a"])
  expect(await client.get("a")).toEqual("1;b=2")
});
