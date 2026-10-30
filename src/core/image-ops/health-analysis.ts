import type { ImageRecord } from "@/core/storage/models";

export interface DuplicateGroup {
  kind: "exact" | "similar";
  images: ImageRecord[];
}

interface BkNode<T> {
  hash: bigint;
  value: T;
  children: Map<number, BkNode<T>>;
}

export function groupExactDuplicates(images: ImageRecord[]): DuplicateGroup[] {
  const byHash = new Map<string, ImageRecord[]>();
  for (const image of images) {
    const group = byHash.get(image.contentHash) ?? [];
    group.push(image);
    byHash.set(image.contentHash, group);
  }
  return [...byHash.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({ kind: "exact", images: group }));
}

/** BK-tree candidate search keeps comparisons local to the requested Hamming radius. */
export function groupNearDuplicates(
  images: ImageRecord[],
  maxDistance = 6,
): DuplicateGroup[] {
  if (!Number.isInteger(maxDistance) || maxDistance < 0 || maxDistance > 64)
    throw new RangeError("Hash distance must be from 0 to 64.");
  const candidates = images.filter((image) => image.perceptualHash !== undefined);
  const roots: BkNode<number>[] = [];
  const parent = candidates.map((_, index) => index);
  const find = (index: number): number => {
    const p = parent[index] ?? index;
    if (p === index) return index;
    parent[index] = find(p);
    return parent[index] ?? index;
  };
  const join = (left: number, right: number) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };

  for (let index = 0; index < candidates.length; index += 1) {
    const image = candidates[index];
    if (!image?.perceptualHash || !/^[0-9a-f]{16}$/i.test(image.perceptualHash)) continue;
    const hash = BigInt(`0x${image.perceptualHash}`);
    for (const root of roots) {
      for (const match of queryTree(root, hash, maxDistance)) join(index, match);
    }
    const node: BkNode<number> = { hash, value: index, children: new Map() };
    const root = roots[0];
    if (root === undefined) roots.push(node);
    else insertTree(root, node);
  }

  const groups = new Map<number, ImageRecord[]>();
  for (let index = 0; index < candidates.length; index += 1) {
    const image = candidates[index];
    if (!image?.perceptualHash || !/^[0-9a-f]{16}$/i.test(image.perceptualHash)) continue;
    const root = find(index);
    const group = groups.get(root) ?? [];
    group.push(image);
    groups.set(root, group);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({ kind: "similar", images: group }));
}

export function imageHealthFlags(image: ImageRecord): string[] {
  const flags: string[] = [];
  if (image.width < 1280 || image.height < 720) flags.push("Low resolution");
  if (image.quality && image.quality.brightness < 55) flags.push("Dark");
  if (image.quality && image.quality.focusScore < 25) flags.push("Possibly blurry");
  return flags;
}

function insertTree(root: BkNode<number>, node: BkNode<number>): void {
  const distance = hammingDistance(root.hash, node.hash);
  const child = root.children.get(distance);
  if (child) insertTree(child, node);
  else root.children.set(distance, node);
}

function queryTree(node: BkNode<number>, hash: bigint, radius: number): number[] {
  const distance = hammingDistance(node.hash, hash);
  const matches = distance <= radius ? [node.value] : [];
  for (const [edge, child] of node.children) {
    if (edge >= distance - radius && edge <= distance + radius)
      matches.push(...queryTree(child, hash, radius));
  }
  return matches;
}

function hammingDistance(left: bigint, right: bigint): number {
  let bits = left ^ right;
  let count = 0;
  while (bits > BigInt(0)) {
    bits &= bits - BigInt(1);
    count += 1;
  }
  return count;
}
