import { mountWelcome } from "./welcome";

const root = document.getElementById("root");
if (root) mountWelcome(root, () => window.close());
