import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/seo/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Adhira flowers",
    description: "Flowers, gifts and plant setups for offices, events and celebrations across the UAE.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafbfa",
    theme_color: "#0e7c5a",
  };
}
