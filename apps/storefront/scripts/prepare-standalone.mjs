import { prepareStandaloneOutput, getAppRoot } from "./standalone-utils.mjs";

prepareStandaloneOutput(getAppRoot(import.meta.url));
