import "server-only";

import { cache } from "react";
import { getBriefBySlug } from "@/db/queries";
import { getContractAddress } from "@/lib/deployment";

export const getSharedBrief = cache(async (slug: string) =>
  getBriefBySlug(slug, getContractAddress()),
);
