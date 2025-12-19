import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";


const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default withWorkflow(nextConfig); 