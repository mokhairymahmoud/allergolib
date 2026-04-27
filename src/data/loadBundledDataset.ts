import datasetJson from "./generated/dataset.json";
import manifestJson from "./generated/manifest.json";

import type { Dataset, DatasetManifest } from "../types";

export const bundledDataset = datasetJson as Dataset;
export const bundledManifest = manifestJson as DatasetManifest;
