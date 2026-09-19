// @ts-check
import { module } from "@prisma/composer";
import apiService from "./apps/api/service.mjs";

export default module("bakbak", ({ provision }) => {
  provision(apiService);
});
