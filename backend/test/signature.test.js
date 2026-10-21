/* ============================================================
   SIGNATURE TESTS — the exact MD5 algorithms the gateways sign
   with. Locks the sort order, empty-value exclusion, sign-field
   exclusion and the case (QwackPay UPPER / OKPay lower).
   ============================================================ */
const { test } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");

const qwack = require("../services/qwackpay");
const okpay = require("../services/okpay");

const md5 = (s, upper) =>
  (upper
    ? crypto.createHash("md5").update(s, "utf8").digest("hex").toUpperCase()
    : crypto.createHash("md5").update(s, "utf8").digest("hex").toLowerCase());

test("qwackpay generateSign: ASCII sort, excludes sign + empties, UPPERCASE", () => {
  const params = { b: "2", a: "1", sign: "TAMPER", empty: "", skip: null, amount: "500" };
  // ASCII ascending: a, amount, b  (empty + null + sign excluded)
  const expected = md5("a=1&amount=500&b=2&key=KEY123", true);
  assert.equal(qwack.generateSign(params, "KEY123"), expected);
});

test("okpay generateSign: ASCII sort, excludes sign + empties, lowercase", () => {
  const params = { mchId: "M1", money: "500", status: "1", sign: "tamper", note: "" };
  const expected = md5("mchId=M1&money=500&status=1&key=KEY456", false);
  assert.equal(okpay.generateSign(params, "KEY456"), expected);
});

test("sign changes when any value changes (tamper detection basis)", () => {
  const a = qwack.generateSign({ amount: "500", order: "A1" }, "K");
  const b = qwack.generateSign({ amount: "501", order: "A1" }, "K");
  const c = qwack.generateSign({ amount: "500", order: "A2" }, "K");
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  // different key → different sign
  assert.notEqual(a, qwack.generateSign({ amount: "500", order: "A1" }, "K2"));
});
