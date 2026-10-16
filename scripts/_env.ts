import { config } from "dotenv";

// Next loads .env.local; plain tsx scripts need to do it themselves.
config({ path: [".env.local", ".env"], quiet: true });
