// 1. Export the exact types the frontend is looking for (using the correct generated name!)
export type {
  HeartbeatResponse,
  ListSitesResponse as SitesResponse,
} from "./generated/api";

// 2. Export all the Zod validation schemas and everything else from the generated file
export * from "./generated/api";
