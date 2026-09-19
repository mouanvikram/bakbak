// @ts-check
import node from "@prisma/composer/node";
import { compute } from "@prisma/composer-prisma-cloud";

export default compute({
  name: "api",
  deps: {},
  build: node({ module: import.meta.url, dir: "dist", entry: "index.js" }),
});
