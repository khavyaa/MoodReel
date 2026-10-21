import { describe, expect, it } from "vitest";
import { explicitSsl, isDroppedConnection } from "@/lib/db";

describe("database connection", () => {
  it("says verify-full outright for Neon's sslmode=require, and leaves other URLs alone", () => {
    expect(explicitSsl("postgres://u:p@ep-x.neon.tech/db?sslmode=require")).toBe("postgres://u:p@ep-x.neon.tech/db?sslmode=verify-full");
    expect(explicitSsl("postgres://u:p@h/db?sslmode=require&channel_binding=require")).toBe(
      "postgres://u:p@h/db?sslmode=verify-full&channel_binding=require",
    );
    expect(explicitSsl("postgres://moodreel:moodreel@localhost:5433/moodreel_test")).toBe("postgres://moodreel:moodreel@localhost:5433/moodreel_test");
  });

  it("retries a dropped or timed-out connection, never a bad query", () => {
    expect(isDroppedConnection(new Error("Connection terminated unexpectedly"))).toBe(true);
    expect(isDroppedConnection(new Error("Failed query: select 1", { cause: new Error("Connection terminated due to connection timeout") }))).toBe(true);
    expect(isDroppedConnection(new Error("timeout exceeded when trying to connect"))).toBe(true);
    expect(isDroppedConnection(new Error('relation "nope" does not exist'))).toBe(false);
  });
});
