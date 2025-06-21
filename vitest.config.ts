import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config();

// This is a precaution to ensure that any production database URL is not used
// in tests. The DATABASE_URL environment variable will be dynamically set by
// `makeNeonTesting()()` in the test environment.
delete process.env.DATABASE_URL;

export default defineConfig({});
