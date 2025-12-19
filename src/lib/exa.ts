import { Exa } from "exa-js";

export const exa = new Exa(process.env.EXA_API_KEY!);

export const founderResearchSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "Schema for founder research",
  type: "object",
  properties: {
    founders: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
          },
          bio: {
            type: "string",
          },
          linkedin: {
            type: "string",
          },
        },
        required: ["name", "bio"],
      },
    },
  },
  required: ["founders"],
};