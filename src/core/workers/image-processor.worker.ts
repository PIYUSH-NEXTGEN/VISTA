import { expose } from "comlink";
import { createImageProcessor } from "@/core/workers/image-processor";

expose(createImageProcessor());
